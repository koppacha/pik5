"""Fit anonymous, series-aware strengths and behavior from the 261009 archive.

Raw identities, scores, record contents and audit metadata are never exported.
Bradley-Terry uses within-card rank comparisons; solo posts are not victories.
"""
import argparse
import collections as co
import csv
import datetime as dt
import hashlib
import json
import math
import statistics as st
from pathlib import Path

OPS = {'draw', 'take', 'record_posted', 'record_updated', 'player_extension', 'return_to_deck'}


def obj(value):
    return json.loads(value) if isinstance(value, str) else value or {}


def fit(names, matches, prior, ridge):
    values = dict(prior)
    for _ in range(500):
        change = 0.0
        for name in names:
            gradient = -ridge * (values[name] - prior[name])
            curvature = ridge
            for a, b, outcome, weight in matches:
                if name not in (a, b):
                    continue
                p = 1 / (1 + math.exp(max(-30, min(30, values[b] - values[a]))))
                gradient += weight * (outcome-p) * (1 if name == a else -1)
                curvature += weight * p * (1-p)
            step = max(-0.5, min(0.5, gradient / curvature))
            values[name] += step
            change = max(change, abs(step))
        if change < 1e-9:
            break
    return values


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('archive', type=Path)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--stages', type=Path, required=True)
    p.add_argument('--deck', type=Path, required=True)
    args = p.parse_args()
    raw = args.archive.read_bytes()
    tables = json.loads(raw)['tables']
    logs = sorted(tables['limit_logs'], key=lambda r: r['id'])
    players = sorted(tables['players'], key=lambda r: (-r['rank_points'], r['id']))
    aliases = {r['name']: f'P{i+1:02}' for i,r in enumerate(players)}
    names = list(aliases.values())
    with args.stages.open() as f:
        series = {int(r['stage_id']): int(r['series']) for r in csv.DictReader(f)}
    # Generic composite stage IDs are absent from stages.csv.
    series.update({200: 2, 300: 3})
    event_series = {r['stage_id']: int(r['series']) for r in tables['stages']}
    decks = {r['id']: r for r in tables['decks']}
    card_series = {r['id']: event_series.get(decks[r['deck_id']]['stage_id'], series.get(decks[r['deck_id']]['origin_stage_id'])) for r in tables['trick_event_cards']}
    assert set(card_series.values()) <= {1,2,3,4}
    matches = {s: [] for s in range(1,5)}
    performance = {n: {s: co.Counter() for s in range(1,5)} for n in names}
    counters = {n: co.Counter() for n in names}
    blocks = {n: set() for n in names}
    time_bins = {n: [0]*48 for n in names}
    posts = {n: co.Counter() for n in names}
    first_seen = set()
    start = dt.datetime.fromisoformat(tables['trick_events'][0]['start_at'])
    extension_ranks = {n: co.Counter() for n in names}
    current_ranks = {}
    for row in logs:
        ev, actor, cid = row['event'], row['actor_name'], row['event_card_id']
        n = aliases.get(actor)
        ctx = obj(row['context'])
        if n and ev in OPS:
            counters[n][ev] += 1
            at = dt.datetime.fromisoformat(row['created_at'])
            bucket = int((at-start).total_seconds() // 1800)
            blocks[n].add(bucket)
            time_bins[n][min(47,bucket//2)] += 1
        if ev in ['record_posted', 'record_updated']:
            current_ranks[cid, n] = ctx['rank']
            if ev == 'record_posted':
                posts[n][card_series[cid]] += 1
                if cid not in first_seen:
                    counters[n]['opening_post'] += 1
                    first_seen.add(cid)
        if ev == 'player_extension':
            # Only the latest actor's recorded rank; not a fully rebuilt ranking.
            extension_ranks[n]['last_own_post_rank_2plus' if current_ranks.get((cid,n),1)>1 else 'other_or_unknown'] += 1
        if ev == 'collect':
            rs = ctx['rankings']
            s = card_series[cid]
            for r in rs:
                key = aliases[r['user_id']]
                performance[key][s]['cards'] += 1
                performance[key][s]['rank_sum'] += r['rank']
                performance[key][s]['first'] += r['rank'] == 1
                performance[key][s]['solo'] += len(rs) == 1
            for i,a in enumerate(rs):
                for b in rs[i+1:]:
                    outcome = 0.5 if a['rank']==b['rank'] else float(a['rank']<b['rank'])
                    matches[s].append((aliases[a['user_id']],aliases[b['user_id']],outcome,1/(len(rs)-1)))
    global_matches = [m for ms in matches.values() for m in ms]
    global_fit = fit(names, global_matches, dict.fromkeys(names,0.0), 1.0)
    by_series = {s:fit(names,matches[s],global_fit,4.0) for s in matches}
    economy = json.loads((Path(__file__).resolve().parents[1]/'studies/tricks-tournament-261009-data/results.json').read_text())
    eco = {r['player']:r for r in economy['players']}

    def donor(n):
        e = eco[n]
        paid = {k:e[k] for k in ['draw','taker_initial','update','return','extension','tax']}
        denominator = sum(paid[k] for k in ['draw','taker_initial','update','return','extension'])
        post_total = sum(posts[n].values())
        joined = dt.datetime.fromisoformat(next(r for r in players if aliases[r['name']]==n)['created_at'])
        considered = sum(r['event']=='collect' and dt.datetime.fromisoformat(r['created_at'])>=joined
                         and (n!='P05' or card_series[r['event_card_id']] in {3,4}) for r in logs)
        strength = {str(s):round(by_series[s][n],6) for s in by_series}
        return dict(source=n, strength=strength, global_strength=round(global_fit[n],6),
                    join_offset_minutes=(dt.datetime.fromisoformat(next(r for r in players if aliases[r['name']]==n)['created_at'])-start).total_seconds()/60,
                    performance={str(s):dict(performance[n][s]) for s in performance[n]},
                    series_preference={str(s):(posts[n][s]+1)/(post_total+4) for s in range(1,5)},
                    action_counts=dict(counters[n]), points_spent=paid,
                    spend_shares={k:round(paid[k]/denominator,6) if denominator else 0 for k in paid if k!='tax'},
                    active_hours_proxy=len(blocks[n])*0.5, hourly_action_counts=time_bins[n],
                    update_ratio=counters[n]['record_updated']/max(1,counters[n]['record_posted']),
                    participation_base=min(0.95,(post_total+1)/(considered+2)),
                    opening_ratio=counters[n]['opening_post']/max(1,counters[n]['record_posted']))

    profiles = {key:donor(n) for key,n in [('Ko','P01'),('A','P02'),('T','P03'),('Ku','P05')]}
    # Series 3 has only six pair comparisons, so it cannot establish elite
    # cross-series superiority. Keep the fit and the user's scenario prior apart.
    for v in profiles.values():
        v['fitted_strength'] = dict(v['strength'])
    profiles['Ku']['strength']['3'] = round(max(profiles['Ko']['strength']['2'], profiles['A']['strength']['2']) + 0.9, 6)
    profiles['Ku']['scenario_adjustment'] = 'User requires unmatched series-3 specialist; elite series-2 fitted maximum + 0.9. Not identified by six series-3 pairs.'
    bounds={'Ko':[20,24],'A':[24,30],'T':[34,38],'Ku':[24,30],'G':[12,24]}
    profiles['G']=dict(source=None, strength={str(s):round(max([by_series[s][n] for n in names]+[v['strength'][str(s)] for v in profiles.values()])+1.25,6) for s in by_series},
                       global_strength=max(global_fit.values())+1.25,
                       series_preference=dict.fromkeys(map(str,range(1,5)),0.25),
                       spend_shares={'draw':0.80,'taker_initial':0.10,'update':0.08,'extension':0.02,'return':0.0},
                       update_ratio=0.15, opening_ratio=0.25, hourly_action_counts=profiles['Ko']['hourly_action_counts'],
                       participation_base=profiles['Ko']['participation_base'],
                       assumption='Unobserved: user-specified elite potential; strongest fitted series strength + 1.25 log-odds; draw bias assumed')
    for key in bounds:
        profiles[key]['active_hours_range']=bounds[key]
    for key,ns in [('中位プレイヤー',names[5:10]),('下位プレイヤー',names[10:15])]:
        donors=[donor(n) for n in ns]
        profiles[key]=dict(donors=donors,source=ns,
                           strength={str(s):round(st.mean(d['strength'][str(s)] for d in donors),6) for s in range(1,5)},
                           active_hours_range=[min(d['active_hours_proxy'] for d in donors)*0.8,max(d['active_hours_proxy'] for d in donors)*1.2])
    with args.deck.open() as f:
        template=[dict(series=series[int(r['origin_stage_id'])],difficulty=int(r['difficulty'])) for r in csv.DictReader(f)]
    result=dict(version='261009-personalities-v1',source_sha256=hashlib.sha256(raw).hexdigest(),
                fitting=dict(method='card-weighted Bradley-Terry',global_ridge=1.0,series_ridge=4.0,
                             pair_count=len(global_matches),pairs_by_series={str(s):len(ms) for s,ms in matches.items()},
                             solo_posts_are_not_wins=True,score_units='relative log-odds, not raw game scores',
                             active_hours_proxy='number of 30-minute relative-start bins containing successful user actions / 2; not actual play time',
                             unsampled_series='shrink toward player global fit; no evidence of series-specific ability'),
                counts=dict(Ko=1,A=1,T=1,Ku=1,G=1,中位プレイヤー=5,下位プレイヤー=5),
                profiles=profiles,deck_template=template,
                observed_players={n:donor(n) for n in names})
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'fitting':result['fitting'],'strengths':{k:v['strength'] for k,v in profiles.items()},
                      'opening_posts':{k:v.get('action_counts',{}).get('opening_post') for k,v in profiles.items()},
                      'cohort_hours_proxy':{k:[d['active_hours_proxy'] for d in profiles[k]['donors']] for k in ['中位プレイヤー','下位プレイヤー']}},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
