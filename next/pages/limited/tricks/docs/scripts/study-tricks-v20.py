"""Compare confirmed v20 changes and conditional adoption; production is untouched."""
import argparse,collections,hashlib,importlib.util,json,statistics,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[6]
spec=importlib.util.spec_from_file_location('v20_live',ROOT/'lab/tricks_rule_simulation.py')
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
CASES={'v19':{'rule_version':'v19'},'confirmed1':{'uniform_update_cost':1,'field_cap_policy':'legacy'},'confirmed2':{'uniform_update_cost':2,'field_cap_policy':'legacy'},'fee1':{'difficulty_take_fee_scale':1,'field_cap_policy':'legacy'},'fee2':{'difficulty_take_fee_scale':2,'field_cap_policy':'legacy'},'cap8':{'field_cap_policy':'min8'},'combined':{'difficulty_take_fee_scale':1,'field_cap_policy':'min8'}}
class Measure(m.Simulation):
 def __init__(self,*a,**kw):
  self.issue=0;self.join_issue=0;self.unposted_sink=0;self.last=None;self.prev_assets=0;self.assets_area=0
  self.first_delays=[];self.early_takes=0;self.turnover=0;self.cash_payment=0;self.low_actions=collections.Counter();self.zero_rewards=0
  super().__init__(*a,**kw)
 def _record(self,event,actor,details):
  if self.last is not None:self.assets_area+=(self.now-self.last).total_seconds()/3600*self.prev_assets
  self.last=self.now;self.prev_assets=sum(p.points+len(p.hand) for p in self.players.values() if p.joined)
  if event=='join':self.join_issue+=5+details['existing_players_bonus']
  if event in {'draw','initial_post','update','paid_extension','return_to_deck'}:
   paid=1 if event=='draw' else details.get('cost',0);self.cash_payment+=paid;self.turnover+=paid
  if event=='take':
   self.cash_payment+=details.get('take_bonus_cost',0);self.turnover+=details.get('take_bonus_cost',0)
   self.early_takes+=(self.now-self.start_at).total_seconds()<3600*3
  if event=='initial_post' and details['participant_order']==1:self.first_delays.append((self.now-self.cards[details['card_id']].taken_at).total_seconds()/60)
  if actor in self.players and actor.endswith(tuple(f'{i:02}' for i in range(11,16))) and event in {'take','draw','initial_post','update'}:self.low_actions[event]+=1
  if event=='collect':
   card=self.cards[details['card_id']]
   if card.posted_players:self.issue+=card.stack_count+m.rarity_stack_bonus(card.rarity,card.stack_count)
   else:self.unposted_sink+=card.paid_points_total
   self.turnover+=sum(details['rewards']['rank_distribution'].values())+details['rewards'].get('taker_remainder',0)
   if self.rule_version=='v20' and details['ranking']:
    self.zero_rewards+=sum(details['rewards']['rank_distribution'].get(n,0)==0 for g in details['ranking'] for n in g['players'])
  if event=='subsidy':self.turnover+=len(details['paid'])
  if event=='instant_subsidy':self.turnover+=1
  if event=='wealth_tax':self.cash_payment+=len(details['taxed']);self.turnover+=len(details['taxed'])
  super()._record(event,actor,details)
  self.prev_assets=sum(p.points+len(p.hand) for p in self.players.values() if p.joined)
 def measured(self):
  s=self.run();assert not s['invariant_errors'];assert all(t['ok'] for k,ts in s.items() if k.startswith('fixed_') for t in ts)
  e=s['economy'];actions=collections.Counter()
  for p in self.players.values():actions.update(p.actions)
  bonuses=e['take_bonus'];assert bonuses['collected']==bonuses['paid_to_first']+bonuses['refunded_unposted']+bonuses['escrow']
  # Transfer of take fees is not issuance; minting floor is separate.
  expected=self.join_issue+self.issue+self.subsidy_payments+self.instant_subsidy_payments+self.empty_field_floor_grant_points+self.reward_floor_topups-e['draw_costs']-self.unposted_sink
  actual=e['ending_points']+self.pot_points+bonuses['escrow']
  assert actual==expected,(actual,expected)
  assert self.zero_rewards==0 if self.rule_version=='v20' else True
  out={k:actions[k] for k in ['draw','take','initial_post','update','paid_extension']}
  out.update(low_posts=self.low_actions['initial_post'],low_takes=self.low_actions['take'],low_draws=self.low_actions['draw'],
             ending_assets=e['ending_points']+sum(len(p.hand) for p in self.players.values()),
             mean_assets=self.assets_area/((self.end_at-self.start_at).total_seconds()/3600),
             issuance=self.issue+self.subsidy_payments+self.instant_subsidy_payments+self.reward_floor_topups,
             ending_points=e['ending_points'],turnover=self.turnover+self.take_bonus_paid+self.take_bonus_refunded,
             paid_points=self.cash_payment,subsidies=self.subsidy_payments+self.instant_subsidy_payments,
             unposted=self.collection_participant_counts.get(0,0),collections=self.collections,
             first_post_delay=statistics.mean(self.first_delays) if self.first_delays else 0,
             early_takes=self.early_takes,bonus_fees=bonuses['collected'],bonus_paid=bonuses['paid_to_first'],bonus_refunded=bonuses['refunded_unposted'],
             floor_topups=self.reward_floor_topups,depletion_minutes=s['deck_trash_depletion']['duration_minutes'],
             book_error=actual-expected,stage_minutes=self.actual_extension_minutes)
  return out

def main():
 p=argparse.ArgumentParser();p.add_argument('--runs',type=int,default=20);p.add_argument('--seed',type=int,default=262500);p.add_argument('--historical',action='store_true');p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 x={'source_sha256':hashlib.sha256((ROOT/'lab/tricks_rule_simulation.py').read_bytes()).hexdigest(),'mode':'historical' if a.historical else 'G_normal','seeds':list(range(a.seed,a.seed+a.runs)),'cases':{k:[] for k in CASES}}
 for seed in x['seeds']:
  for name,opts in CASES.items():x['cases'][name].append(Measure(seed,Path('/private/tmp/tricks-v20-compare'),write_outputs=False,historical_tournament=a.historical,**opts).measured())
  print('seed',seed,'complete',flush=True)
 x['means']={name:{k:statistics.mean(r[k] for r in rows) for k in rows[0]} for name,rows in x['cases'].items()}
 a.output.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n');print('comparison saved',flush=True)
if __name__=='__main__':main()
