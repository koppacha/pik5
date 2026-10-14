import importlib.util,sys,unittest,gzip,types
from pathlib import Path
from datetime import timedelta
ROOT=Path(__file__).resolve().parents[5]
spec=importlib.util.spec_from_file_location('v20_test',ROOT/'lab/tricks_rule_simulation.py');m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
def sim(**kw):return m.Simulation(262500,Path('/private/tmp/tricks-v20-tests'),write_outputs=False,**kw)
class V20Tests(unittest.TestCase):
 def test_costs_and_subsidy_boundaries(self):
  s=sim();p=next(iter(s.players.values()));card=next(iter(s.cards.values()));card.taker=p.name
  for d in range(1,6):
   card.difficulty=d;self.assertEqual(s._initial_post_cost(card,p),0);self.assertEqual(s._update_post_cost(card),1)
  p.take_times=[s.now]*16;p.points=2;p.hand=[1,2,3];self.assertTrue(s._recurring_eligible(p))
  p.points=3;self.assertFalse(s._recurring_eligible(p))
 def test_stage_diminishing_across_duplicate_cards_and_players(self):
  s=sim();a,b=list(s.players.values())[:2];x,y=list(s.cards.values())[:2];x.stage_key=y.stage_key=42
  for count,minutes in enumerate([15,10,5,5]):
   s.stage_extension_counts[(a.name,42)]=count;self.assertEqual(s._extension_minutes(a,x),minutes);self.assertEqual(s._extension_minutes(a,y),minutes)
  self.assertEqual(s._extension_minutes(b,x),15)
 def test_positive_tied_rewards_and_conservation(self):
  s=sim();card=next(iter(s.cards.values()));card.stack_count=2;card.rarity=1;names=list(s.players)[:5];card.posted_players=set(names);card.taker=names[0]
  result=s._apply_collection_rewards(card,[{'rank':1,'players':names[:2]},{'rank':3,'players':names[2:]}])
  self.assertTrue(all(result['rank_distribution'].get(n,0)>=1 for n in names));self.assertEqual(sum(result['rank_distribution'].values())+result['taker_remainder'],5)
  self.assertEqual(s.reward_floor_topups,3)
 def test_free_initial_extension_is_fifteen_for_any_order(self):
  s=sim();s.now=s.start_at+timedelta(hours=2)
  card=next(iter(s.cards.values()));card.state='_field';card.stack_count=3;card.rarity=1;card.limit_at=s.now+timedelta(minutes=10);card.taken_at=s.now;s.field=[card.id]
  a,b=list(s.players.values())[:2]
  for p in [a,b]:
   p.joined=True;p.points=20
   before=card.limit_at;s._complete_initial_post(p.name,card.id,10)
   self.assertEqual((card.limit_at-before).total_seconds()/60,15)
 def test_bonus_is_once_and_unposted_is_refunded(self):
  s=sim(difficulty_take_fee_scale=1);a,b=list(s.players.values())[:2];card=next(iter(s.cards.values()));a.joined=b.joined=True;a.points=b.points=10
  card.take_bonus_escrow=3;card.stack_count=3;card.limit_at=s.now+timedelta(hours=1)
  s._record('initial_post',b.name,{'card_id':card.id,'participant_order':1});self.assertEqual(b.points,13);self.assertEqual(card.take_bonus_escrow,0)
  s._record('initial_post',b.name,{'card_id':card.id,'participant_order':1});self.assertEqual(b.points,13)
  card.take_bonus_escrow=4;card.taker=a.name;card.posted_players=set()
  s._record('collect',a.name,{'card_id':card.id});self.assertEqual(a.points,14);self.assertEqual(s.take_bonus_refunded,4)
 def test_conditional_cap_uses_joined_count(self):
  s=sim(field_cap_policy='min8');self.assertEqual(s._field_cap(),8)
  for p in s.players.values():p.joined=True
  self.assertEqual(s._field_cap(),14)
 def test_cash_take_fee_has_resource_sufficiency_trap(self):
  s=sim(difficulty_take_fee_scale=1,field_cap_policy='min8')
  for i,p in enumerate(s.players.values()):
   p.joined=True;p.points=0;p.hand=list(range(i*3+1,i*3+4))
   for cid in p.hand:s.cards[cid].difficulty=2;s.cards[cid].state='_hand'
  p=next(iter(s.players.values()));self.assertFalse(s._can_take(p));self.assertFalse(s._recurring_eligible(p))
  s._handle_subsidy();self.assertEqual(sum(p.points for p in s.players.values()),0)
  s.difficulty_take_fee_scale=0;self.assertTrue(s._can_take(p))
 def test_defaults_do_not_enable_central_or_shop(self):
  s=sim();self.assertEqual(s.rule_version,'v20');self.assertEqual(s.field_cap_policy,'min8');self.assertEqual(s.difficulty_take_fee_scale,0);self.assertEqual(s.pot_points,0)
  self.assertFalse(hasattr(s,'central'));self.assertFalse(hasattr(s,'shop_used'))
if __name__=='__main__':unittest.main()
