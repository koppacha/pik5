"""Experimental Central treasury; no production or calibrated-model mutation."""
import argparse
import bisect
import collections
import hashlib
import importlib.util
import json
import math
import statistics
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('central_reward_study',HERE/'study-tricks-reward-smoothing.py')
r=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=r
spec.loader.exec_module(r)
m=r.m

SCREEN={
    'pot_smooth':None,
    'central_fixed_2x':(2,None),
    'central_1.5x_d15':(1.5,15),
    'central_1.75x_d15':(1.75,15),
    'central_2x_d15':(2,15),
    'central_3x_d15':(3,15),
    'central_1.5x_d30':(1.5,30),
    'central_2x_d30':(2,30),
    'central_3x_d30':(3,30),
}


def tax_terms(points, multiplier, central, debt_step):
    mean=statistics.mean(points) if points else 0
    border=max(0,mean)*multiplier
    rate=1+(math.ceil(max(0,-central)/debt_step) if debt_step else 0)
    # One snapshot; no cascading mean/rate or dependence on player iteration order.
    deductions=[min(rate,max(0,p-math.floor(border))) if p>border else 0 for p in points]
    return mean,border,rate,deductions


class CentralSimulation(r.Experiment):
    def __init__(self,seed,multiplier=2,debt_step=15,historical=True,behavior_tuning=None):
        self.multiplier=multiplier
        self.debt_step=debt_step
        self.central=0
        self.central_flows=collections.Counter()
        self.central_journal=[]
        self.central_debt_hours=0
        self.central_area=0
        self.central_integrated_at=None
        self.max_tax_rate=1
        self.tax_border_rows=[]
        self.initial_issuance=0
        self.card_issuance=0
        self.destroyed_unposted_fees=0
        self.take_shortage_hours=collections.Counter()
        self.resource_measure_at=None
        self.resource_previous={}
        self.last_zero_violations=0
        self.funding_errors=[]
        super().__init__(seed,'smooth')
        if not historical:
            raise ValueError('This study fixes the observed roster and deck replenishment')
        if behavior_tuning is not None:
            self.behavior_tuning=behavior_tuning
        self.dynamic_wealth_tax_pot=False
        self.central_integrated_at=self.start_at
        self.central_journal=[{'hour':0.0,'central':0,'flow':'initial','delta':0}]

    def _integrate_central(self):
        dt=(self.now-self.central_integrated_at).total_seconds()/3600
        self.central_debt_hours+=dt*(self.central<0)
        self.central_area+=dt*self.central
        self.central_integrated_at=self.now

    def _central_change(self,amount,kind):
        self._integrate_central()
        self.central+=amount
        self.central_flows[kind]+=amount
        self.central_journal.append({'hour':(self.now-self.start_at).total_seconds()/3600,
                                     'central':self.central,'flow':kind,'delta':amount})
        assert self.central==sum(self.central_flows.values())

    def _handle_join(self,name):
        if not self.players[name].joined:
            self.initial_issuance+=m.INITIAL_POINTS+self.participant_count()
        super()._handle_join(name)

    def _grant_instant_subsidy(self,player,reason):
        # Explicit abolition: parent take/post code can call this hook without minting.
        return

    def _handle_subsidy(self):
        paid=[]
        for player in self.players.values():
            if not player.joined or player.last_subsidy_paid_slot_at==self.now:
                continue
            if player.points+len(player.hand)>=self._required_take_hand(player):
                continue
            player.points+=1
            player.last_subsidy_paid_slot_at=self.now
            self.subsidy_payments+=1
            paid.append(player.name)
        if paid:
            self._central_change(-len(paid),'periodic')
            self._record('subsidy',None,{'paid':paid,'payer':'central','points_each':1})
        players=[p for p in self.players.values() if p.joined]
        mean,border,rate,deductions=tax_terms([p.points for p in players],self.multiplier,self.central,self.debt_step)
        self.max_tax_rate=max(self.max_tax_rate,rate)
        self.tax_border_rows.append({'hour':(self.now-self.start_at).total_seconds()/3600,
                                    'mean':mean,'border':border,'nominal_tax':rate,'taxed_count':sum(v>0 for v in deductions)})
        taxed=[]
        for player,amount in zip(players,deductions):
            if amount:
                before=player.points
                player.points-=amount
                assert before-player.points==amount and player.points>=math.floor(border)
                self.wealth_tax_events+=1
                taxed.append({'player':player.name,'amount':amount})
        if taxed:
            self._central_change(sum(deductions),'tax')
            self._record('central_tax',None,{'taxed':taxed,'mean':mean,'border':border,'nominal_tax':rate})

    def _apply_empty_field_floor_grant(self):
        if self.field or self.now>=self.end_at:
            return
        players=[p for p in self.players.values() if p.joined]
        if not players or any(p.points+len(p.hand)>=self._required_take_hand(p) for p in players):
            return
        grants={p.name:self._required_take_hand(p)-p.points-len(p.hand) for p in players}
        for p in players:p.points+=grants[p.name]
        total=sum(grants.values())
        self.empty_field_floor_grant_events+=1
        self.empty_field_floor_grant_points+=total
        self._central_change(-total,'emergency')
        self._record('empty_field_floor_grant',None,{'grants':grants,'total_points':total,'payer':'central','floor':'individual_take_cost'})

    def _q(self,card,n,cost=0,pot=True):
        # Treasury assets/liabilities do not become a collection jackpot.
        return max(n,card.stack_count+m.rarity_stack_bonus(card.rarity,card.stack_count)+card.paid_points_total+cost) if n else 0

    def _apply_collection_rewards(self,card,ranking):
        n=sum(len(g['players']) for g in ranking)
        if not n:
            self.destroyed_unposted_fees+=card.paid_points_total
            return {'total_reward':0,'rank_distribution':{},'taker_remainder':0}
        base=card.stack_count+m.rarity_stack_bonus(card.rarity,card.stack_count)
        self.card_issuance+=base
        raw=base+card.paid_points_total
        topup=max(0,n-raw)
        if topup:self._central_change(-topup,'guarantee')
        q=max(n,raw)
        dist,residue=r.allocation(ranking,q,'smooth')
        assert min(dist.values())>=1
        for name,amount in dist.items():
            self.players[name].points+=amount
            card.reward_log.append({'player':name,'points':amount,'type':'rank_distribution'})
        if residue:self._central_change(residue,'tied_residue')
        assert sum(dist.values())+residue==raw+topup
        return {'total_reward':q,'rank_distribution':dist,'taker_remainder':0,'carried_residue':residue}

    def _record(self,event,actor,details):
        if self.resource_measure_at is not None:
            dt=(self.now-self.resource_measure_at).total_seconds()/3600
            for name,short in self.resource_previous.items():self.take_shortage_hours[name]+=dt*short
        self.resource_measure_at=self.now
        self.resource_previous={name:p.points+len(p.hand)<self._required_take_hand(p) for name,p in self.players.items() if p.joined}
        if event=='return_to_deck':
            self._central_change(details['cost'],'return')
        super()._record(event,actor,details)

    def measure(self):
        metrics=super().measure()
        self._integrate_central()
        # Terminal conservation: initial/card issuance, draw sink, unposted fee sink.
        expected=self.initial_issuance+self.card_issuance-metrics['draws']-self.destroyed_unposted_fees
        actual=sum(p.points for p in self.players.values())+self.central
        assert actual==expected,(actual,expected)
        assert not self.instant_subsidy_payments
        assert self.pot_points==0 and self.pot_distributed_points==0
        assert self.central==sum(self.central_flows.values())
        hours=(self.end_at-self.start_at).total_seconds()/3600
        values=[row['central'] for row in self.central_journal]
        times=[row['hour'] for row in self.central_journal]
        hourly=[self.central_journal[bisect.bisect_right(times,min(h,hours))-1]['central'] for h in range(49)]
        first_debt=next((row['hour'] for row in self.central_journal if row['central']<0),None)
        recovery=next((row['hour'] for row in self.central_journal if first_debt is not None and row['hour']>first_debt and row['central']>=0),None)
        metrics.update(central_end=self.central,central_min=min(values),central_max=max(values),
                       central_debt_hours=self.central_debt_hours,central_time_mean=self.central_area/hours,
                       central_first_debt=first_debt,central_first_recovery=recovery,
                       tax_points=self.central_flows['tax'],periodic_paid=-self.central_flows['periodic'],
                       guarantee_paid=-self.central_flows['guarantee'],emergency_paid=-self.central_flows['emergency'],
                       return_received=self.central_flows['return'],tied_received=self.central_flows['tied_residue'],
                       max_tax_rate=self.max_tax_rate,take_shortage_hours=sum(self.take_shortage_hours.values()),
                       lower_take_shortage_hours=sum(v for name,v in self.take_shortage_hours.items() if r.band(name)=='lower'),
                       conservation_error=actual-expected)
        return {'metrics':metrics,'hourly_central':hourly,'central_journal':self.central_journal,
                'tax_slots':self.tax_border_rows,'players':{p.display_name if i<5 else f'P{i+1:02}':{'points':p.points,'rank_points':p.rank_points,'take_cost':self._required_take_hand(p),'hand':len(p.hand)} for i,p in enumerate(self.players.values())}}


class PotControl(r.Experiment):
    def __init__(self,seed):
        self.take_shortage_hours=collections.Counter()
        self.resource_measure_at=None
        self.resource_previous={}
        super().__init__(seed,'smooth')

    def _record(self,event,actor,details):
        if self.resource_measure_at is not None:
            dt=(self.now-self.resource_measure_at).total_seconds()/3600
            for name,short in self.resource_previous.items():self.take_shortage_hours[name]+=dt*short
        self.resource_measure_at=self.now
        self.resource_previous={name:p.points+len(p.hand)<self._required_take_hand(p) for name,p in self.players.items() if p.joined}
        super()._record(event,actor,details)

    def measure(self):
        metrics=super().measure()
        metrics.update(take_shortage_hours=sum(self.take_shortage_hours.values()),
                       lower_take_shortage_hours=sum(v for name,v in self.take_shortage_hours.items() if r.band(name)=='lower'))
        return metrics


def validate():
    assert tax_terms([10,20],2,0,15)[3]==[0,0]
    assert tax_terms([0,20],1.5,0,15)[3]==[0,1]
    assert tax_terms([0,20],1.5,-1,15)[2]==2
    assert tax_terms([0,20],1.5,-16,15)[2]==3
    assert tax_terms([-10,2],2,-100,15)[3]==[0,2]
    assert tax_terms([0,20],1.5,-1000,15)[3]==[0,5]
    r.validate()
    # Minimal contract fixture; dedicated synthetic state, no live user data.
    a=CentralSimulation(262000,2,15)
    p=next(iter(a.players.values()));p.joined=True;p.points=1;p.hand=[];p.take_times=[]
    card=next(iter(a.cards.values()))
    card.state='_field';card.stack_count=2;card.limit_at=a.now+m.timedelta(hours=1)
    a.field=[card.id]  # valid synthetic field prevents emergency fill
    a._handle_subsidy()
    assert p.points==2 and a.central==-1 and a.central_flows['periodic']==-1
    before=p.points;a._grant_instant_subsidy(p,'take');assert p.points==before
    q=next(iter(a.cards.values()));q.stack_count=2;q.rarity=1;q.paid_points_total=0
    names=list(a.players)[:3]
    result=a._apply_collection_rewards(q,[{'rank':i+1,'players':[name]} for i,name in enumerate(names)])
    assert result['total_reward']==3 and a.central==-2 and min(result['rank_distribution'].values())==1
    assert not a.invariant_errors
    b=CentralSimulation(262001,2,15)
    pp=next(iter(b.players.values()));pp.joined=True;pp.points=0;pp.hand=[]
    b._apply_empty_field_floor_grant()
    assert pp.points==b._required_take_hand(pp) and b.central==-b._required_take_hand(pp)
    return 'tax snapshots/boundaries, negative-mean fallback, funded grants/guarantees, no instant grant, reward invariants passed'


def means(rows):
    keys=[k for k,v in rows[0]['metrics'].items() if isinstance(v,(int,float)) and k not in ['central_first_debt','central_first_recovery']]
    out={k:round(statistics.mean(row['metrics'][k] for row in rows),5) for k in keys}
    return out


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--runs',type=int,default=5)
    p.add_argument('--seed',type=int,default=262000)
    p.add_argument('--cases',nargs='+',choices=list(SCREEN),default=list(SCREEN))
    p.add_argument('--output',type=Path,required=True)
    args=p.parse_args()
    result={'tests':validate(),'source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'simulator_sha256':r.SIMULATOR_SOURCE_SHA256,
            'reward_script_sha256':hashlib.sha256((HERE/'study-tricks-reward-smoothing.py').read_bytes()).hexdigest(),
            'parameters_sha256':hashlib.sha256(m.CALIBRATION_PATH.with_name('tricks-behavior-parameters-261009.json').read_bytes()).hexdigest(),
            'mode':'historical; rarity cap OFF; native action utility fixed; treasury opening=0',
            'seeds':list(range(args.seed,args.seed+args.runs)),'cases':{name:[] for name in args.cases}}
    for seed in result['seeds']:
        for name in args.cases:
            policy=SCREEN[name]
            if policy is None:
                metrics=PotControl(seed).measure()
                row={'metrics':metrics}
            else:
                row=CentralSimulation(seed,*policy).measure()
            result['cases'][name].append(row)
        print(f'seed {seed} complete',flush=True)
    result['means']={name:means(rows) for name,rows in result['cases'].items()}
    result['treasury_curves']={name:{'mean':[round(statistics.mean(row['hourly_central'][h] for row in rows),3) for h in range(49)],
                                         'min':[min(row['hourly_central'][h] for row in rows) for h in range(49)],
                                         'max':[max(row['hourly_central'][h] for row in rows) for h in range(49)]}
                              for name,rows in result['cases'].items() if name!='pot_smooth'}
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result['means'],ensure_ascii=False),flush=True)

if __name__=='__main__':main()
