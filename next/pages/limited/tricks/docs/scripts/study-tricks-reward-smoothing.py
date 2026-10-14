"""Anonymous fixed-log sensitivity and paired simulation of experimental rewards.
Does not modify the production rules or calibrated simulator.
"""
import argparse
import collections
import hashlib
import importlib.util
import json
import math
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[6]
SIM_PATH = ROOT/'lab/tricks_rule_simulation.py'
spec = importlib.util.spec_from_file_location('reward_study_sim', SIM_PATH)
m = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = m
frozen=Path(__file__).resolve().parent.parent/'studies/tricks-simulator-before-v20.py.gz'
if frozen.exists():
    import gzip
    m.__file__=str(SIM_PATH)
    source_bytes=gzip.decompress(frozen.read_bytes())
    exec(compile(source_bytes,str(frozen),'exec'),m.__dict__)
else:
    source_bytes=SIM_PATH.read_bytes()
    spec.loader.exec_module(m)
SIMULATOR_SOURCE_SHA256=hashlib.sha256(source_bytes).hexdigest()
VARIANTS = ['current', 'smooth', 'bonus_cap8', 'compressed']


def total_points(s, b, c, p, n, variant):
    if not n:
        return 0, 0
    if variant == 'compressed':
        base = min(s, 6) + (max(0, s-6)+1)//2 + min(b, 6)
    elif variant == 'bonus_cap8':
        base = s + min(b, 8)
    else:
        base = s+b
    raw = base+c+p
    topup = max(0, n-raw) if variant != 'current' else 0
    return raw+topup, topup


def positional(q, n):
    if n == 1:
        return [q]
    assert q >= n
    # Reserve 1P each; distribute the remainder with weights from 2 to 1.
    weights = [2*(n-1)-i for i in range(n)]
    denominator = sum(weights)
    numerators = [(q-n)*w for w in weights]
    amounts = [1+v//denominator for v in numerators]
    remainder = q-sum(amounts)
    order = sorted(range(n), key=lambda i: (-(numerators[i]%denominator), i))
    for i in order[:remainder]:
        amounts[i] += 1
    assert sum(amounts) == q and min(amounts) >= 1
    assert all(a >= b for a,b in zip(amounts, amounts[1:]))
    return amounts


def official_positional(q,n):
    if n<=1:
        return [q] if n else []
    base=m.minimum_proposed_distribution(n)
    equal=[False]+[a==b for a,b in zip(base,base[1:])]
    out=base[:]
    while sum(out)>q:
        for i in range(n-1 if n==2 else n-2,-1,-1):
            if out[i]>0:
                out[i]-=1
                break
    while sum(out)<q:
        target=0
        for i in range(1,n-1):
            gap=2 if i==1 else (0 if equal[i] else 1)
            if out[i-1]-out[i]>gap:
                target=i
                break
        out[target]+=1
    return out


def allocation(ranking, q, variant):
    n = sum(len(g['players']) for g in ranking)
    slots = official_positional(q,n) if variant=='current' else positional(q,n)
    result = {}
    residue = cursor = 0
    for group in ranking:
        size = len(group['players'])
        per, rem = divmod(sum(slots[cursor:cursor+size]), size)
        result.update({name:per for name in group['players']})
        residue += rem
        cursor += size
    # Equal scores receive equal integer points; unallocatable units carry to pot.
    assert sum(result.values())+residue == q
    return result, residue


def band(name):
    return ['upper','middle','lower'][(int(name[-2:])-1)//5]


def gini(values):
    if not sum(values):
        return 0
    return sum(abs(a-b) for a in values for b in values)/(2*len(values)*sum(values))


def describe_cards(rows, rewards):
    paid = [r for r in rows if r['n']]
    last = [v for r in paid if r['n']>1 for v in r['last']]
    upper = sum(v for name,v in rewards.items() if band(name)=='upper')
    return dict(total=sum(rewards.values()), gini=round(gini(list(rewards.values())),4),
                band_per_player={b:round(sum(v for name,v in rewards.items() if band(name)==b)/5,3) for b in ['upper','middle','lower']},
                upper_share=round(upper/sum(rewards.values()),4),
                last_zero=sum(v==0 for v in last), last_count=len(last), last_mean=round(statistics.mean(last),3),
                pool_min=min(r['q'] for r in paid), pool_max=max(r['q'] for r in paid),
                pool_mean=round(statistics.mean(r['q'] for r in paid),3),
                single_rewards=sum(r['paid'] for r in paid if r['n']==1),
                legendary_pools=[r['q'] for r in paid if r['rarity']==5],
                topups=sum(r['topup'] for r in rows), residue=sum(r['residue'] for r in rows))


def fixed_log(archive):
    # Never export raw contexts, names, IDs, scores or request metadata.
    tables=json.loads(archive.read_bytes())['tables']
    aliases={r['name']:f'P{i+1:02}' for i,r in enumerate(sorted(tables['players'],key=lambda p:-p['rank_points']))}
    safe=json.loads((ROOT/'next/pages/limited/tricks/docs/studies/tricks-tournament-261009-data/results.json').read_text())
    cards={c['card_id']:c for c in safe['cards']}
    takers={r['event_card_id']:aliases[r['actor_name']] for r in tables['limit_logs'] if r['event']=='take'}
    collect=[]
    for log in sorted(tables['limit_logs'],key=lambda r:r['id']):
        if log['event']!='collect':
            continue
        ctx=log['context'];ctx=json.loads(ctx) if isinstance(ctx,str) else ctx
        groups=[]
        for row in sorted(ctx['rankings'],key=lambda r:r['rank']):
            if not groups or groups[-1]['rank']!=row['rank']:
                groups.append({'rank':row['rank'],'players':[]})
            groups[-1]['players'].append(aliases[row['user_id']])
        observed=collections.Counter()
        for key in ['distribution','taker_remainder']:
            for name,value in (ctx.get(key) or {}).items(): observed[aliases[name]]+=value
        collect.append((cards[log['event_card_id']],groups,takers[log['event_card_id']],observed))
    output={}
    for variant in VARIANTS:
        rewards=collections.Counter({name:0 for name in aliases.values()})
        rows=[]
        for card,groups,taker,observed in collect:
            n=card['participants']
            q,topup=total_points(card['stack'],card['rarity_bonus'],card['payments'],card['pot'],n,variant)
            dist,residue=allocation(groups,q,variant) if n else ({},0)
            if variant=='current':
                dist=collections.Counter(dist);dist[taker]+=residue
                assert +dist == +observed
            rewards.update(dist)
            rows.append(dict(n=n,q=q,paid=sum(dist.values()),topup=topup,residue=residue,rarity=card['rarity'],
                             last=[dist.get(name,0) for name in groups[-1]['players']] if groups else []))
        if variant=='current':
            assert all(rewards[p['player']]==p['reward'] for p in safe['players'])
        output[variant]=dict(metrics=describe_cards(rows,rewards),players=dict(rewards),cards=rows)
    return output


class Experiment(m.Simulation):
    def __init__(self,seed,variant,expectation='native'):
        self.variant=variant
        self.expectation=expectation
        self.collection_rows=[]
        self.receipts=collections.Counter()
        self.low_hours=collections.Counter()
        self.debt_hours=collections.Counter()
        self.last_measure=None
        super().__init__(seed,Path('/private/tmp/tricks-reward-study'),historical_tournament=True,write_outputs=False)

    def _q(self,card,n,cost=0,pot=True):
        return total_points(card.stack_count,m.rarity_stack_bonus(card.rarity,card.stack_count),
                            card.paid_points_total+cost,card.pot_bonus_points if pot else 0,n,self.variant)[0]

    def _total_reward_points(self,card):
        return self._q(card,len(card.posted_players))

    def _field_reward_potential(self,card_id):
        return self._q(self.cards[card_id],max(1,len(self.cards[card_id].posted_players)),pot=False)

    def _expected_initial_post_point_net(self,player,card,duration):
        n=self._forecast_field_participants(card,player.name)
        rank=self._forecast_rank_after_future_posts(player,card,duration,n)
        cost=self._initial_post_cost(card,player)
        slots=official_positional(self._q(card,n,cost,pot=False),n) if self.variant=='current' else positional(self._q(card,n,cost,pot=False),n)
        return slots[max(0,min(n-1,rank-1))]-cost

    def _post_expected_utility(self,player,card,duration):
        if self.expectation=='native':
            return super()._post_expected_utility(player,card,duration)
        n=self._forecast_field_participants(card,player.name)
        rank=self._forecast_rank_after_future_posts(player,card,duration,n)
        q=self._q(card,n,pot=False)
        distribution=official_positional(q,n) if self.variant=='current' else positional(q,n)
        reward=distribution[max(0,min(n-1,rank-1))]
        return self._rank_points_for(rank,n,card.stack_count)+reward*.35-self._initial_post_cost(card,player)-m.play_time_cost(duration)-self._practice_risk_penalty(card)

    def _apply_collection_rewards(self,card,ranking):
        if not ranking:
            return {'total_reward':0,'rank_distribution':{},'taker_remainder':0}
        q=self._total_reward_points(card)
        dist,residue=allocation(ranking,q,self.variant)
        for name,value in dist.items():
            self.players[name].points+=value
            card.reward_log.append({'player':name,'points':value,'type':'rank_distribution'})
        if self.variant=='current' and residue:
            self.players[card.taker].points+=residue
            card.reward_log.append({'player':card.taker,'points':residue,'type':'taker_remainder'})
            return {'total_reward':q,'rank_distribution':dist,'taker_remainder':residue,'remainder_distribution':{card.taker:residue}}
        self.pot_points+=residue
        return {'total_reward':q,'rank_distribution':dist,'taker_remainder':0,'carried_residue':residue}

    def _record(self,event,actor,details):
        if self.last_measure is not None:
            dt=(self.now-self.last_measure).total_seconds()/3600
            for name,(low,debt) in self.previous_resources.items():
                self.low_hours[name]+=dt*low
                self.debt_hours[name]+=dt*debt
        self.last_measure=self.now
        self.previous_resources={name:(p.points+len(p.hand)<3,p.points<0) for name,p in self.players.items() if p.joined}
        if event=='collect':
            card=self.cards[details['card_id']]
            rank=details['ranking'];n=sum(len(g['players']) for g in rank)
            reward=details['rewards'];dist=collections.Counter(reward['rank_distribution'])
            if self.variant=='current' and reward['taker_remainder']:
                for name,v in reward.get('remainder_distribution',{}).items():dist[name]+=v
            self.receipts.update({f'P{int(name[-2:]):02}':v for name,v in dist.items()})
            _,topup=total_points(card.stack_count,m.rarity_stack_bonus(card.rarity,card.stack_count),card.paid_points_total,card.pot_bonus_points,n,self.variant)
            self.collection_rows.append(dict(n=n,q=reward['total_reward'],paid=sum(dist.values()),rarity=card.rarity,topup=topup,
                                            residue=reward.get('carried_residue',0),last=[dist.get(name,0) for name in rank[-1]['players']] if rank else []))
        super()._record(event,actor,details)

    def measure(self):
        summary=self.run()
        assert not summary['invariant_errors']
        assert all(t['ok'] for key,tests in summary.items() if key.startswith('fixed_') for t in tests)
        self.receipts.update({f'P{i:02}':0 for i in range(1,16)})
        metrics=describe_cards(self.collection_rows,self.receipts)
        metrics.update(collections=summary['collections'],posts=sum(p.actions.get('initial_post',0) for p in self.players.values()),
                       lower_posts=sum(p.actions.get('initial_post',0) for name,p in self.players.items() if band(name)=='lower'),
                       draws=summary['economy']['draw_costs'],ending_points=summary['economy']['ending_points'],
                       zero_cards=sum(r['n']==0 for r in self.collection_rows),
                       low_resource_hours=sum(self.low_hours.values()),lower_low_hours=sum(v for name,v in self.low_hours.items() if band(name)=='lower'),
                       debt_hours=sum(self.debt_hours.values()),subsidies=summary['economy']['subsidy_payments']+summary['economy']['instant_subsidy_payments'],
                       depletion_minutes=summary['deck_trash_depletion']['duration_minutes'])
        return metrics


def validate():
    for n in range(1,16):
        for q in range(n,201):positional(q,n)
    for n in range(1,16):
        groups=[{'rank':1,'players':[f'P{i:02}' for i in range(1,n+1)]}]
        for q in range(n,n+50):
            d,r=allocation(groups,q,'smooth')
            assert len(set(d.values()))==1 and min(d.values())>=1 and sum(d.values())+r==q
    for v in VARIANTS[1:]:
        for n in range(1,16):
            q,t=total_points(2,0,0,0,n,v);assert q>=n and t==max(0,n-2)
    return 'positivity, monotonicity, integer conservation, tied equality and minimum topup passed'


def summarize_runs(rows):
    keys=[k for k,v in rows[0].items() if isinstance(v,(float,int))]
    return {k:round(statistics.mean(r[k] for r in rows),4) for k in keys}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--archive',type=Path,required=True)
    p.add_argument('--runs',type=int,default=20)
    p.add_argument('--seed',type=int,default=261800)
    p.add_argument('--output',type=Path,required=True)
    args=p.parse_args()
    result={'formula_validation':validate(),'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'parameters_sha256':hashlib.sha256(m.CALIBRATION_PATH.with_name('tricks-behavior-parameters-261009.json').read_bytes()).hexdigest(),'simulator_sha256':SIMULATOR_SOURCE_SHA256,'static':fixed_log(args.archive),'experiments':{}}
    for expectation in ['native','rank_sensitive']:
        runs={v:[] for v in VARIANTS}
        for seed in range(args.seed,args.seed+args.runs):
            for variant in VARIANTS:runs[variant].append(Experiment(seed,variant,expectation).measure())
            print(f'{expectation} seed {seed} complete',flush=True)
        means={v:summarize_runs(rows) for v,rows in runs.items()}
        # Paired seed differences, not independent-sample intervals.
        deltas={}
        for v in VARIANTS[1:]:
            deltas[v]={}
            for key in ['posts','lower_posts','draws','collections','low_resource_hours','lower_low_hours','total','gini']:
                values=[a[key]-b[key] for a,b in zip(runs[v],runs['current'])]
                mean=statistics.mean(values);margin=2.093*statistics.stdev(values)/math.sqrt(len(values)) if len(values)>1 else 0
                deltas[v][key]={'mean':round(mean,4),'approx95_interval':[round(mean-margin,4),round(mean+margin,4)]}
        result['experiments'][expectation]={'seeds':list(range(args.seed,args.seed+args.runs)),'means':means,'paired_deltas':deltas,'runs':runs}
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print('study saved',flush=True)

if __name__=='__main__':main()
