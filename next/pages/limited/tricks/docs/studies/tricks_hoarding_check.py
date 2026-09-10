"""Construct a reachable shortage using real simulator join/draw transitions."""
import importlib.util
import json
import sys
from datetime import timedelta
from pathlib import Path

source = Path(__file__).resolve().parents[6] / 'lab/tricks_rule_simulation.py'
spec = importlib.util.spec_from_file_location('hoarding_sim', source)
model = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = model
spec.loader.exec_module(model)
sim = model.Simulation(275000, Path('/tmp/tricks-hoarding'), True, False, True)
players = list(sim.players.values())
for i, player in enumerate(players):
    sim.now = sim.start_at + timedelta(minutes=i + 1)
    player.join_at = sim.now
    player.active_sessions = [(sim.now, sim.end_at)]
    sim._handle_join(player.name)
issued = sum(p.points for p in players)
sim.now = sim.start_at + timedelta(minutes=20)
for player in players:
    while player.points > 0 and sim.deck_or_trash_available():
        sim._draw(player)
assert issued == 200
assert sum(len(p.hand) for p in players) == 200
assert not sim.deck and not sim.trash and not sim.field
sim.now = sim.start_at + timedelta(minutes=30)
sim._handle_subsidy()
eligible = sum(p.points > 0 for p in players)
before = sum(len(p.hand) for p in players)
for player in players:
    if player.points > 0:
        sim._draw(player)
assert before == sum(len(p.hand) for p in players)
assert not sim.invariant_errors
print(json.dumps({'initial_and_late_join_points': issued, 'locked_hand_cards': before,
                  'deck': len(sim.deck), 'trash': len(sim.trash), 'field': len(sim.field),
                  'players_with_points_but_unable_to_draw_after_subsidy': eligible,
                  'invariant_errors': sim.invariant_errors}, indent=2))
