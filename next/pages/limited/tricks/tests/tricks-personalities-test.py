"""Regression tests for empirical personalities; no DB or user credentials."""
import importlib.util
import json
import math
import statistics
import sys
import unittest
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
spec = importlib.util.spec_from_file_location('tricks_empirical', ROOT/'lab/tricks_rule_simulation.py')
m = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = m
spec.loader.exec_module(m)


def simulation(seed=261009, **kwargs):
    return m.Simulation(seed, Path('/private/tmp/tricks-personality-tests'), write_outputs=False, rule_version="v19", **kwargs)


class EmpiricalPersonalitiesTest(unittest.TestCase):
    def test_fifteen_players_and_named_activity_budgets_across_seeds(self):
        for seed in range(261009,261059):
            sim = simulation(seed)
            self.assertFalse(sim.invariant_errors)
            self.assertEqual(len(sim.players),15)
            for i,kind in enumerate(['Ko','A','T','Ku','G'],1):
                p=sim.players[f'player_{i:02d}']
                self.assertEqual(p.display_name,kind)
                lo,hi=m.EMPIRICAL_PROFILES[kind]['active_hours_range']
                self.assertTrue(lo<=p.total_active_minutes()/60<=hi)
            self.assertEqual(sum(p.personality=='中位プレイヤー' for p in sim.players.values()),5)
            self.assertEqual(sum(p.personality=='下位プレイヤー' for p in sim.players.values()),5)
            t=sim.players['player_03']
            self.assertTrue(all(t.total_active_minutes()>p.total_active_minutes() for p in sim.players.values() if p!=t))
            for kind in ['中位プレイヤー','下位プレイヤー']:
                self.assertEqual(len({p.profile_source for p in sim.players.values() if p.personality==kind}),5)

    def prepare_challenge(self, kind, series=2):
        sim=simulation()
        for p in sim.players.values():
            p.joined=True
        player=next(p for p in sim.players.values() if p.personality==kind)
        sim.now=next(a for a,b in player.active_sessions if (b-a)>=timedelta(minutes=60))
        card=sim.cards[1]
        card.series=series
        card.state='_field'
        card.difficulty=1
        card.stack_count=4
        card.rarity=1
        card.taken_at=sim.now-timedelta(minutes=40)
        card.limit_at=sim.now+timedelta(minutes=5)
        card.taker=player.name
        card.scores={player.name:100.0,'player_15':200.0}
        card.posted_players=set(card.scores)
        card.paid_players=set(card.scores)
        sim.field=[1]
        player.points=10
        return sim,player,card

    def test_a_extends_only_when_below_first_and_prioritizes_extension(self):
        sim,a,card=self.prepare_challenge('A')
        self.assertIsNotNone(sim._extension_plan(a,card))
        self.assertEqual(sim._choose_action(a)['type'],'extend')
        card.scores[a.name]=300
        self.assertIsNone(sim._extension_plan(a,card))

    def test_ku_restricts_posts_and_challenge_extensions_by_series(self):
        sim,ku,card=self.prepare_challenge('Ku',3)
        self.assertIsNotNone(sim._extension_plan(ku,card))
        card.series=4
        self.assertIsNotNone(sim._extension_plan(ku,card))
        for series in [1,2]:
            card.series=series
            self.assertIsNone(sim._extension_plan(ku,card))
        for series in [1,2]:
            card.series=series
            self.assertFalse(any(a.get('card_id')==card.id and a['type'] in {'initial_post','update','extend'} for a in sim._legal_actions(ku)))
        card.series=3
        card.scores[ku.name]=300
        self.assertIsNone(sim._extension_plan(ku,card))

    def test_extension_payment_preserves_total_activity_budget(self):
        sim,a,card=self.prepare_challenge('A')
        minutes=a.total_active_minutes()
        limit=card.limit_at
        sim._buy_card_extension(a,card.id,1)
        self.assertEqual(a.points,9)
        self.assertEqual(card.limit_at,limit+timedelta(minutes=15))
        self.assertEqual(a.total_active_minutes(),minutes)

    def test_ko_selects_opening_post_over_existing_stage_and_draw(self):
        sim,ko,old=self.prepare_challenge('Ko')
        fresh=sim.cards[2]
        fresh.series=2
        fresh.difficulty=1
        fresh.rarity=1
        fresh.stack_count=4
        fresh.state='_field'
        fresh.limit_at=sim.now+timedelta(hours=1)
        sim.field.append(2)
        options=[{'type':'draw'}, {'type':'initial_post','card_id':1,'duration':10}, {'type':'initial_post','card_id':2,'duration':20}]
        sim._legal_actions=lambda _p:options
        self.assertEqual(sim._choose_action(ko)['card_id'],2)

    def test_bt_trial_pair_odds_and_series_specialist(self):
        sim=simulation()
        ko,a,ku,g=[sim.players[f'player_{i:02d}'] for i in [1,2,4,5]]
        card=sim.cards[1]
        card.series=2
        wins=0
        for _ in range(12000):
            wins += sim._run_score_trial(ko,card,0)['candidate_score']>sim._run_score_trial(a,card,0)['candidate_score']
        expected=1/(1+math.exp(a.series_strength[2]-ko.series_strength[2]))
        self.assertAlmostEqual(wins/12000,expected,delta=0.02)
        card.series=3
        self.assertGreater(sim._expected_card_score(ku,card),sim._expected_card_score(ko,card))
        self.assertGreater(sim._expected_card_score(g,card),sim._expected_card_score(ku,card))
        self.assertIsNone(m.EMPIRICAL_PROFILES['G']['source'])

    def test_complete_tournaments_and_disabled_extension_scenario(self):
        results=[]
        for seed in range(261009,261014):
            sim=simulation(seed)
            result=sim.run()
            self.assertFalse(result['invariant_errors'])
            self.assertEqual(result['configured_player_count'],15)
            for key,tests in result.items():
                if key.startswith('fixed_'):
                    self.assertTrue(all(t['ok'] for t in tests),key)
            ku=sim.players['player_04']
            self.assertTrue(all(c.series in {3,4} for c in sim.cards.values() if ku.name in c.posted_players))
            self.assertTrue(all(c.series in {3,4} for c in sim.cards.values() if ku.name in c.extension_players))
            self.assertTrue(all(p.total_active_minutes()==p.active_budget_minutes for p in sim.players.values()))
            results.append({'seed':seed,'collections':result['collections'],'extensions':result['paid_extensions']['count'],
                            'players':[{k:p[k] for k in ['display_name','rank_points','total_active_hours','draw_count','actions']} for p in result['players']]})
        baseline=simulation(261009,player_extension_enabled=False).run()
        self.assertFalse(baseline['invariant_errors'])
        self.assertEqual(baseline['paid_extensions']['count'],0)
        # A's behavior should actually use extension in generated tournaments.
        self.assertGreater(sum(p['actions'].get('paid_extension',0) for r in results for p in r['players'] if p['display_name']=='A'),0)
        output=Path(__file__).resolve().parents[1]/'docs/studies/tricks-personality-validation-2026-10-13.json'
        output.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')

    def test_historical_population_and_mid_event_replenishment(self):
        sim=simulation(historical_tournament=True)
        self.assertEqual(sim.players['player_05'].display_name,'実測P04')
        self.assertFalse(any(p.display_name=='G' for p in sim.players.values()))
        self.assertEqual(len(sim.cards),160)
        sim.run()
        self.assertEqual(len(sim.cards),320)
        self.assertEqual((sim.end_at-sim.start_at).total_seconds(),47*3600+59*60)
        self.assertFalse(sim.invariant_errors)

    def test_preparation_extension_and_draft_policy(self):
        sim,a,card=self.prepare_challenge('A')
        card.posted_players.remove(a.name)
        del card.scores[a.name]
        self.assertIsNotNone(sim._extension_plan(a,card))
        ko=sim.players['player_01']
        self.assertFalse(sim._should_withhold_initial_score(ko,card,{'candidate_score':1,'expected_score':100}))
        # An aspiration is allowed to stay unmet; it must not mint resources.
        ko.points=0
        before=ko.points
        sim._behavior_need(ko,'draw')
        self.assertEqual(ko.points,before)

    def test_observed_post_cutoff_draw_respects_resource_guards(self):
        sim=simulation()
        sim.now=sim.end_at-timedelta(minutes=30)
        ku=sim.players['player_04']
        ku.joined=True
        ku.active_sessions=[(sim.now,sim.end_at)]
        ku.points=2
        other=sim.players['player_15']
        other.joined=True
        other.points=10
        self.assertTrue(any(a['type']=='draw' for a in sim._legal_actions(ku)))
        sim._draw(ku)
        self.assertEqual(ku.points,1)
        ku.points=0
        self.assertFalse(any(a['type']=='draw' for a in sim._legal_actions(ku)))
        ko=sim.players['player_01']
        ko.joined=True
        ko.active_sessions=[(sim.now,sim.end_at)]
        ko.points=2
        self.assertFalse(any(a['type']=='draw' for a in sim._legal_actions(ko)))


if __name__=='__main__':
    unittest.main()
