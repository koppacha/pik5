"""Audit an event-only archive and export anonymous tournament aggregates.

Never export raw contexts, user IDs, record contents or request metadata.
Run: python3 analyze-tricks-tournament.py ARCHIVE --output NEW_DIRECTORY
"""
import argparse
import collections as co
import csv
import datetime as dt
import hashlib
import json
import statistics as st
from pathlib import Path

INCOME = ['reward', 'instant_take', 'instant_free_post', 'periodic', 'initial', 'join_bonus', 'other_income']
EXPENSE = ['taker_initial', 'update', 'draw', 'return', 'extension', 'tax', 'other_expense']
OPERATIONS = {'draw', 'take', 'record_posted', 'record_updated', 'return_to_deck', 'player_extension'}


def obj(value):
    return json.loads(value) if isinstance(value, str) else value or {}


def time(value):
    return dt.datetime.fromisoformat(value)


def bonus(s, rarity):
    g = s // 3
    return [0, 0, g + 1, g + 4, 2 * g + 7, 3 * g + 15][rarity]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    raw = args.archive.read_bytes()
    tables = json.loads(raw)['tables']
    event = tables['trick_events'][0]
    assert event['state'] == 'ended'
    start, end = time(event['start_at']), time(event['ended_at'])
    logs = sorted(tables['limit_logs'], key=lambda r: r['id'])
    assert len({r['id'] for r in logs}) == len(logs)
    assert all(time(a['created_at']) <= time(b['created_at']) for a, b in zip(logs, logs[1:]))
    final = sorted(tables['players'], key=lambda r: (-r['rank_points'], r['id']))
    assert len(final) == 15 and len({r['rank_points'] for r in final}) == 15
    aliases = {r['name']: f'P{i + 1:02}' for i, r in enumerate(final)}
    groups = {r['name']: ['上位', '中位', '下位'][i // 5] for i, r in enumerate(final)}
    money = {r['name']: co.Counter() for r in final}
    counts = {r['name']: co.Counter() for r in final}
    balances, rp, hand = {}, co.Counter(), co.Counter()
    minimum, maximum, debt_hours, low_hours = {}, co.Counter(), co.Counter(), co.Counter()
    operation_times = {r['name']: [] for r in final}
    cards = {r['id']: r for r in tables['trick_event_cards']}
    taken, take_intervals, collections = {}, [], []
    last_take, previous_post, payment_logs, reward_logs = {}, {}, co.Counter(), co.Counter()
    hours = [co.Counter() for _ in range(int((end - start).total_seconds() // 3600) + 1)]
    hourly_actors = [set() for _ in hours]
    field = set()
    audit = co.Counter()
    pot = 0
    last_at = start

    def integrate(until):
        nonlocal last_at
        at = last_at
        while at < until:
            index = min(int((at - start).total_seconds() // 3600), len(hours) - 1)
            stop = min(until, start + dt.timedelta(hours=index + 1))
            duration = (stop - at).total_seconds() / 3600
            hours[index]['field_hours'] += len(field) * duration
            hours[index]['joined_hours'] += len(balances) * duration
            hours[index]['balance_hours'] += sum(balances.values()) * duration
            hours[index]['empty_field_hours'] += (not field) * duration
            for user, points in balances.items():
                debt_hours[user] += (points < 0) * duration
                low_hours[user] += (points + hand[user] < 3) * duration
            at = stop
        last_at = until

    for row in logs:
        at = time(row['created_at'])
        assert start <= at <= end
        integrate(at)
        hour_index = min(int((at - start).total_seconds() // 3600), len(hours) - 1)
        h = hours[hour_index]
        ev, actor, cid = row['event'], row['actor_name'], row['event_card_id']
        ctx = obj(row['context'])
        target = row['affected_player_name'] or actor
        if ev in OPERATIONS:
            counts[actor][ev] += 1
            h[ev] += 1
            hourly_actors[hour_index].add(actor)
            operation_times[actor].append(at)
        if ev == 'join':
            assert len(balances) == ctx['existing_players_bonus'] and actor not in balances
            for user in balances:
                balances[user] += 1
                money[user]['join_bonus'] += 1
            balances[actor] = 5
            money[actor]['initial'] += 5
            assert obj(row['player_snapshot'])['draw_points'] == 5
        elif ev == 'collect':
            total = 0
            for key, kind in [('distribution', 'distribution'), ('taker_remainder', 'taker_remainder')]:
                for user, points in (ctx.get(key) or {}).items():
                    balances[user] += points
                    money[user]['reward'] += points
                    total += points
                    if points:
                        reward_logs[(cid, user, kind)] += points
                    if key == 'taker_remainder':
                        counts[user]['remainder_points'] += points
            for ranking in ctx['rankings']:
                rp[ranking['user_id']] += ranking['rps']
            snap = obj(taken[cid]['card_snapshot'])
            s, rarity = int(snap['stack_count']), int(snap['rarity'])
            n = len(ctx['rankings'])
            c = sum(r['points_paid'] for r in tables['trick_card_payments'] if r['event_card_id'] == cid)
            p = int(ctx.get('pot_points_used') or 0)
            assert total == (s + bonus(s, rarity) + c + p if n else 0)
            pot -= p
            assert pot >= 0
            h['reward'] += total
            h['collect'] += 1
            field.remove(cid)
            t = time(taken[cid]['created_at'])
            collections.append(dict(card_id=cid, difficulty=snap['difficulty'], rarity=rarity, stack=s,
                                    participants=n, reward=total, payments=c, pot=p,
                                    base=s if n else 0, rarity_bonus=bonus(s, rarity) if n else 0,
                                    unpaid_base=s if not n else 0, unpaid_bonus=bonus(s, rarity) if not n else 0,
                                    life_minutes=(at-t).total_seconds()/60, take_at=t.isoformat(), collect_at=at.isoformat(),
                                    forced_at_end=at == end,
                                    extensions=sum(r['event_card_id'] == cid and r['event'] == 'player_extension' for r in logs)))
        elif row['points_delta'] is not None:
            delta = int(row['points_delta'])
            before = balances[target]
            if ev == 'instant_subsidy_paid':
                assert before + hand[target] < 5 and delta == 1
                audit['instant_eligibility_checks'] += 1
            elif ev == 'subsidy_paid':
                assert before + hand[target] < 3 and delta == 1
                audit['periodic_eligibility_checks'] += 1
            elif ev == 'balance_tax_collected':
                assert before == ctx['points_before'] and before > ctx['threshold'] and delta == -1
                audit['tax_eligibility_checks'] += 1
            balances[target] += delta
            if ev == 'instant_subsidy_paid':
                key = {'take': 'instant_take', 'free_post': 'instant_free_post'}[ctx['reason']]
            elif ev == 'subsidy_paid':
                key = 'periodic'
            elif ev in ['record_posted', 'record_updated']:
                rid = ctx['record_id']
                matches = [r for r in tables['trick_card_payments'] if r['record_id'] == rid and r['event_card_id'] == cid and r['player_name'] == actor]
                assert len(matches) == 1
                payment = matches[0]
                key = 'update' if payment['payment_type'] == 'score_update' else 'taker_initial'
                if key == 'taker_initial' and delta < 0:
                    assert cards[cid]['taker'] == actor
                payment_logs[(cid, actor, payment['payment_type'], rid, -delta)] += 1
                if delta < 0:
                    counts[actor][key + '_count'] += 1
                else:
                    counts[actor]['free_initial'] += 1
                if (cid, actor) in previous_post:
                    counts[actor]['update_gap_seconds'] += (at-previous_post[cid, actor]).total_seconds()
                    counts[actor]['update_gap_count'] += 1
                previous_post[cid, actor] = at
            else:
                key = {'draw': 'draw', 'return_to_deck': 'return', 'player_extension': 'extension', 'balance_tax_collected': 'tax'}.get(ev, 'other_income' if delta > 0 else 'other_expense')
            money[target][key] += abs(delta)
            if ev in ['return_to_deck', 'balance_tax_collected']:
                pot -= delta
            h['points_' + key] += abs(delta)
            if ev == 'player_extension':
                payment_logs[(cid, actor, 'player_extension', None, -delta)] += 1
        if ev == 'draw':
            hand[actor] += 1
            if row['hand_count'] is not None:
                assert hand[actor] == row['hand_count']
        elif ev == 'return_to_deck':
            hand[actor] -= 1
            if row['hand_count'] is not None:
                assert hand[actor] == row['hand_count']
        elif ev == 'take':
            assert hand[actor] == row['hand_count']
            assert len(obj(row['stacked_card_ids'])) + 1 == hand[actor]
            if actor in last_take:
                take_intervals.append(dict(player=aliases[actor], minutes=(at-last_take[actor]).total_seconds()/60, before_exemption=at < end-dt.timedelta(minutes=150)))
            last_take[actor] = at
            hand[actor] = 0
            taken[cid] = row
            field.add(cid)
        if row['remaining_draw_points'] is not None:
            assert balances[target] == row['remaining_draw_points']
            audit['remaining_balance_checks'] += 1
        for user, points in balances.items():
            minimum[user] = min(minimum.get(user, points), points)
            maximum[user] = max(maximum[user], points)
    integrate(end)
    payments = co.Counter((r['event_card_id'], r['player_name'], r['payment_type'], r['record_id'], r['points_paid']) for r in tables['trick_card_payments'])
    assert payment_logs == payments
    rewards = co.Counter()
    for r in tables['trick_collection_rewards']:
        rewards[(r['event_card_id'], r['player_name'], 'taker_remainder' if r['reward_type'] == 'taker_remainder' else 'distribution')] += r['points_delta']
    assert rewards == reward_logs
    assert pot == event['pot_points']
    player_rows = []
    for rank, r in enumerate(final, 1):
        user = r['name']
        m, cs = money[user], counts[user]
        income, expense = sum(m[k] for k in INCOME), sum(m[k] for k in EXPENSE)
        assert income - expense == balances[user] == r['draw_points']
        assert rp[user] == r['rank_points'] and cs['take'] == r['take_count'] and hand[user] == r['card_count']
        ts = operation_times[user]
        # Descriptive action-burst proxy only; no claim to recover actual play hours.
        bursts = 0 if not ts else 1 + sum((b-a).total_seconds() > 1800 for a,b in zip(ts,ts[1:]))
        joined_hours = (end-time(r['created_at'])).total_seconds()/3600
        player_rows.append(dict(player=aliases[user], band=groups[user], rank=rank, rank_points=r['rank_points'],
                                final_points=r['draw_points'], final_hand=hand[user],
                                **{k:m[k] for k in INCOME + EXPENSE}, income=income, expense=expense,
                                **{k:cs[k] for k in ['take','record_posted','record_updated','free_initial','taker_initial_count','update_count','draw','return_to_deck','player_extension','remainder_points'] if k != 'draw'},
                                min_points=minimum[user], max_points=maximum[user],
                                joined_hours=joined_hours, debt_hours=debt_hours[user], low_resource_hours=low_hours[user],
                                debt_percent=100*debt_hours[user]/joined_hours, low_resource_percent=100*low_hours[user]/joined_hours,
                                action_bursts=bursts, first_action=ts[0].isoformat() if ts else None,
                                last_action=ts[-1].isoformat() if ts else None,
                                mean_update_gap_minutes=cs['update_gap_seconds']/60/cs['update_gap_count'] if cs['update_gap_count'] else None))
    band_rows = []
    for band in ['上位','中位','下位']:
        ps = [r for r in player_rows if r['band'] == band]
        keys = INCOME + EXPENSE + ['income','expense','final_points','rank_points','take','record_posted','record_updated','free_initial','debt_hours','low_resource_hours','joined_hours']
        band_rows.append(dict(band=band, players=len(ps),
                              mean={k:sum(r[k] for r in ps)/len(ps) for k in keys},
                              median={k:st.median(r[k] for r in ps) for k in keys},
                              total={k:sum(r[k] for r in ps) for k in keys}))
    hour_rows = []
    for i,h in enumerate(hours):
        duration = min(1, (end-(start+dt.timedelta(hours=i))).total_seconds()/3600)
        hour_rows.append(dict(hour=i, start=(start+dt.timedelta(hours=i)).isoformat(), duration_hours=duration,
                              **dict(h), operation_players=len(hourly_actors[i]),
                              mean_field=h['field_hours']/duration,
                              mean_points_per_joined_player=h['balance_hours']/h['joined_hours'] if h['joined_hours'] else 0))
    summary = dict(event_id=event['event_id'], start=start.isoformat(), end=end.isoformat(),
                   duration_hours=(end-start).total_seconds()/3600,
                   source_sha256=hashlib.sha256(raw).hexdigest(),
                   events=dict(co.Counter(r['event'] for r in logs)),
                   audit=dict(audit, payment_rows_matched=len(tables['trick_card_payments']), reward_rows_matched=len(tables['trick_collection_rewards']),
                              player_balance_matches=len(final), player_rp_matches=len(final), player_hand_matches=len(final), collection_formula_matches=len(collections), final_pot=pot),
                   totals={k:sum(r[k] for r in player_rows) for k in INCOME+EXPENSE+['income','expense','final_points','rank_points']},
                   bands=band_rows, players=player_rows, cards=collections, hourly=hour_rows,
                   take_intervals=take_intervals,
                   participant_distribution=dict(sorted(co.Counter(c['participants'] for c in collections).items())),
                   difficulty_distribution=dict(sorted(co.Counter(c['difficulty'] for c in collections).items())),
                   resource_sources={**{k:sum(c[k] for c in collections) for k in ['base','rarity_bonus','payments','pot','unpaid_base','unpaid_bonus']},
                                     'paid_into_reward':sum(c['payments'] for c in collections if c['participants']),
                                     'unpaid_payments':sum(c['payments'] for c in collections if not c['participants'])})
    args.output.mkdir(parents=True, exist_ok=False)
    (args.output/'results.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n')
    for name, rows in [('players',player_rows),('cards',collections),('hourly',hour_rows)]:
        keys = list(dict.fromkeys(k for row in rows for k in row))
        with (args.output/f'{name}.csv').open('w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(rows)
    print(json.dumps({'event_id':event['event_id'], 'audit':summary['audit'], 'totals':summary['totals'], 'participant_distribution':summary['participant_distribution'], 'resource_sources':summary['resource_sources']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
