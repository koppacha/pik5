"""Activity-first comparison of Central opening reserves, issuance and a provisional shop."""
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
spec=importlib.util.spec_from_file_location('central_activity_parent',HERE/'study-tricks-central.py')
c=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=c
spec.loader.exec_module(c)
m=c.m

CONFIGS={
 'old_pot_control':{'control':True},
 'opening0':{'opening':0},
 'opening96':{'opening':96},
 'opening288':{'opening':288},
 'opening960':{'opening':960},
 'issue1':{'mint':1},
 'issue3':{'mint':3},
 'issue10':{'mint':10},
 'opening288_border1.5':{'opening':288,'multiplier':1.5},
 'opening288_shop1':{'opening':288,'shop_price':1},
 'opening0_shop1':{'shop_price':1},
 'opening288_shop2':{'opening':288,'shop_price':2},
}
ACTIONS=['draw','take','initial_post','update','paid_extension','return_to_deck']


class ActivityMeasure:
 def _start_activity_measure(self):
  self.activity=collections.Counter()
  self.activity_bands={b:collections.Counter() for b in ['upper','middle','lower']}
  self.activity_rows=[]
  self.cash_transactions=0
  self.tax_bands=collections.Counter()
  self.grant_bands=collections.Counter()
  self.wealth_at=None
  self.wealth_previous=0
  self.wealth_integral=0

 def _measure_activity_record(self,event,actor,details):
  if self.wealth_at is not None:
   self.wealth_integral+=(self.now-self.wealth_at).total_seconds()/3600*self.wealth_previous
  self.wealth_at=self.now
  values=[max(0,p.points+len(p.hand)) for p in self.players.values() if p.joined]
  self.wealth_previous=c.r.gini(values) if values else 0
  if event in ACTIONS and actor in self.players:
   self.activity[event]+=1
   self.activity_bands[c.r.band(actor)][event]+=1
   self.activity_rows.append({'hour':(self.now-self.start_at).total_seconds()/3600,'event':event})
   if event=='draw' or details.get('cost',0)>0:self.cash_transactions+=1
  if event=='central_tax':
   self.cash_transactions+=len(details['taxed'])
   for row in details['taxed']:self.tax_bands[c.r.band(row['player'])]+=row['amount']
  elif event=='wealth_tax':
   self.cash_transactions+=len(details['taxed'])
   for row in details['taxed']:self.tax_bands[c.r.band(row['player'])]+=1
  elif event=='subsidy':
   self.cash_transactions+=len(details['paid'])
   for name in details['paid']:self.grant_bands[c.r.band(name)]+=1
  elif event=='empty_field_floor_grant':
   self.cash_transactions+=len(details['grants'])
   for name,amount in details['grants'].items():self.grant_bands[c.r.band(name)]+=amount
  elif event=='instant_subsidy':
   self.cash_transactions+=1
   self.grant_bands[c.r.band(actor)]+=1
  elif event=='collect':
   rew=details['rewards']
   self.cash_transactions+=sum(v>0 for v in rew['rank_distribution'].values())+len(rew.get('remainder_distribution',{}))

 def _activity_result(self,row,shop_receipts=0):
  metrics=row['metrics']
  hours=(self.end_at-self.start_at).total_seconds()/3600
  self.wealth_integral+=(self.now-self.wealth_at).total_seconds()/3600*self.wealth_previous
  metrics.update(takes=self.activity['take'],updates=self.activity['update'],extensions=self.activity['paid_extension'],
                 useful_actions=self.activity['take']+self.activity['initial_post']+self.activity['update'],
                 game_actions=sum(self.activity.values()),cash_transactions=self.cash_transactions,
                 resource_gini_time=self.wealth_integral/hours,
                 resource_gini_end=c.r.gini([max(0,p.points+len(p.hand)) for p in self.players.values() if p.joined]),
                 distinct_posters=sum(p.actions.get('initial_post',0)>0 for p in self.players.values()))
  # Each directed move counts once: escrow payments and later rewards are separate moves.
  fees=sum(card.paid_points_total for card in self.cards.values())
  tax=sum(self.tax_bands.values())
  grants=sum(self.grant_bands.values())
  payments=metrics['draws']+fees+self.return_to_deck_count*m.RETURN_TO_DECK_COST+tax+shop_receipts
  metrics.update(payment_points=payments,redistribution_points=grants,
                 gross_flow_points=payments+grants+metrics['total'],field_payment_points=fees)
  row['bands']={b:{'actions':dict(self.activity_bands[b]),'tax':self.tax_bands[b],'grants':self.grant_bands[b],
                   'active_budget_hours':sum(p.total_active_minutes()/60 for name,p in self.players.items() if c.r.band(name)==b)} for b in self.activity_bands}
  for b,data in row['bands'].items():
   useful=sum(data['actions'].get(k,0) for k in ['take','initial_post','update'])
   metrics[b+'_useful_actions']=useful
   metrics[b+'_useful_per_budget_hour']=useful/max(1,data['active_budget_hours'])
   metrics[b+'_tax']=data['tax'];metrics[b+'_grants']=data['grants']
  cumulative=[]
  for h in range(49):
   counts=collections.Counter(r['event'] for r in self.activity_rows if r['hour']<=min(h,hours))
   cumulative.append({'draws':counts['draw'],'takes':counts['take'],'posts':counts['initial_post'],
                      'updates':counts['update'],'useful':sum(counts[k] for k in ['take','initial_post','update'])})
  row['hourly_activity']=cumulative
  return row


class FundsSimulation(ActivityMeasure,c.CentralSimulation):
 def __init__(self,seed,opening=0,mint=0,multiplier=2,shop_price=0,debt_step=15):
  self.opening=opening;self.mint=mint;self.minted=0
  self.shop_price=shop_price
  self.shop_receipts=0;self.shop_sales=0;self.shop_nominal_discount=0
  self.shop_used=set();self.pricing_actor=None
  self._start_activity_measure()
  super().__init__(seed,multiplier,debt_step)
  if opening:
   self.initial_issuance+=opening
   self._central_change(opening,'opening')

 def _handle_subsidy(self):
  if self.mint:
   self.initial_issuance+=self.mint
   self.minted+=self.mint
   self._central_change(self.mint,'issuance')
  super()._handle_subsidy()

 def _shop_eligible(self,player,card):
  normal=m.Simulation._update_post_cost(self,card)
  return (self.shop_price>0 and normal>self.shop_price and (player.name,card.id) not in self.shop_used
          and player.points>=self.shop_price
          and player.points+len(player.hand)-self.shop_price>=self._required_take_hand(player))

 def _choose_action(self,player):
  old=self.pricing_actor;self.pricing_actor=player
  try:return super()._choose_action(player)
  finally:self.pricing_actor=old

 def _complete_update(self,player_name,card_id,duration,*args,**kwargs):
  old=self.pricing_actor;self.pricing_actor=self.players[player_name]
  try:return super()._complete_update(player_name,card_id,duration,*args,**kwargs)
  finally:self.pricing_actor=old

 def _update_post_cost(self,card):
  if self.pricing_actor is not None and self._shop_eligible(self.pricing_actor,card):
   return self.shop_price
  return super()._update_post_cost(card)

 def _record(self,event,actor,details):
  if event=='update' and self.shop_price and details['cost']==self.shop_price:
   p=self.players[actor];card=self.cards[details['card_id']]
   normal=m.Simulation._update_post_cost(self,card)
   if normal>self.shop_price and (actor,card.id) not in self.shop_used:
    # Root charged this cost once; re-route escrow to Central, without refund/mint.
    card.paid_points_total-=self.shop_price
    card.paid_points_by_player[actor]-=self.shop_price
    self._central_change(self.shop_price,'shop')
    self.shop_used.add((actor,card.id))
    self.shop_sales+=1;self.shop_receipts+=self.shop_price
    self.shop_nominal_discount+=normal-self.shop_price
    details={**details,'shop_item':'one_update_discount','ordinary_cost':normal,'field_fee':0}
  self._measure_activity_record(event,actor,details)
  super()._record(event,actor,details)

 def measure(self):
  row=super().measure() # Includes independent currency conservation, with all external issuance.
  row['metrics'].update(opening_reserve=self.opening,minted_points=self.minted,
                        shop_sales=self.shop_sales,shop_receipts=self.shop_receipts,shop_nominal_discount=self.shop_nominal_discount)
  assert row['metrics']['central_end']==self.opening+self.minted+row['metrics']['tax_points']+row['metrics']['return_received']+row['metrics']['tied_received']+self.shop_receipts-row['metrics']['periodic_paid']-row['metrics']['guarantee_paid']-row['metrics']['emergency_paid']
  return self._activity_result(row,self.shop_receipts)


class OldControl(ActivityMeasure,c.PotControl):
 def __init__(self,seed):
  self._start_activity_measure();super().__init__(seed)
 def _record(self,event,actor,details):
  self._measure_activity_record(event,actor,details);super()._record(event,actor,details)
 def measure(self):
  return self._activity_result({'metrics':super().measure()})


def validate():
 c.validate()
 # Opening funds and issuance do not reach wallets directly.
 a=FundsSimulation(262200,opening=96,mint=3)
 assert a.central==96 and a.initial_issuance==96
 before=sum(p.points for p in a.players.values())
 a._handle_subsidy()
 assert a.central==99 and a.minted==3 and sum(p.points for p in a.players.values())==before
 # Dedicated synthetic shop fixture checks a real successful-payment reroute.
 b=FundsSimulation(262201,opening=288,shop_price=1)
 p=next(iter(b.players.values()));p.joined=True;p.points=10
 card=next(iter(b.cards.values()));card.difficulty=3;card.paid_points_total=1;card.paid_points_by_player[p.name]=1
 p.points-=1
 b._record('update',p.name,{'card_id':card.id,'cost':1})
 assert b.shop_receipts==1 and b.central==289 and card.paid_points_total==0 and p.points==9
 assert not b._shop_eligible(p,card) and not b.invariant_errors
 return 'parent rules, positive reserve/mint ledger, no direct wallet issuance, shop reroute/no double charge and one-per-card cap passed'


def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--runs',type=int,default=20)
 p.add_argument('--seed',type=int,default=262200)
 p.add_argument('--cases',nargs='+',choices=list(CONFIGS),default=list(CONFIGS))
 p.add_argument('--output',type=Path,required=True)
 args=p.parse_args()
 x={'tests':validate(),'objective':'game activity, player-directed payments and redistribution; treasury deficit is NOT a failure criterion',
    'source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'central_source_sha256':hashlib.sha256((HERE/'study-tricks-central.py').read_bytes()).hexdigest(),
    'simulator_sha256':c.r.SIMULATOR_SOURCE_SHA256,
    'parameters_sha256':hashlib.sha256(m.CALIBRATION_PATH.with_name('tricks-behavior-parameters-261009.json').read_bytes()).hexdigest(),
    'seeds':list(range(args.seed,args.seed+args.runs)),
    'policies':{name:CONFIGS[name] for name in args.cases},'cases':{name:[] for name in args.cases}}
 for seed in x['seeds']:
  for name in args.cases:
   cfg=CONFIGS[name]
   sim=OldControl(seed) if cfg.get('control') else FundsSimulation(seed,**cfg)
   x['cases'][name].append(sim.measure())
  print(f'seed {seed} complete',flush=True)
 x['means']={name:c.means(rows) for name,rows in x['cases'].items()}
 x['curves']={name:{k:[round(statistics.mean(row['hourly_activity'][h][k] for row in rows),3) for h in range(49)] for k in ['draws','takes','posts','updates','useful']} for name,rows in x['cases'].items()}
 x['paired_deltas']={}
 reference=x['cases'].get('opening0')
 if reference:
  for name,rows in x['cases'].items():
   if name=='opening0':continue
   x['paired_deltas'][name]={}
   for key in ['draws','takes','posts','updates','useful_actions','payment_points','gross_flow_points','lower_useful_actions','resource_gini_time']:
    values=[a['metrics'][key]-b['metrics'][key] for a,b in zip(rows,reference)]
    mean=statistics.mean(values);margin=2.093*statistics.stdev(values)/(len(values)**.5) if len(values)>1 else 0
    x['paired_deltas'][name][key]={'mean':mean,'approx95_interval':[mean-margin,mean+margin]}
 args.output.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
 print('Liquidity comparison saved',flush=True)

if __name__=='__main__':main()
