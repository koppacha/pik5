#!/usr/bin/env python3
"""Synthetic paired economy comparison; never reads the application database."""
import argparse
import importlib.util
import json
import statistics
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--runs', type=int, default=100)
    parser.add_argument('--stress-runs', type=int, default=20)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[6]
    spec = importlib.util.spec_from_file_location('tricks_sim', repo / 'lab/tricks_rule_simulation.py')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    rows = []
    scenarios = [('normal', 48, 160, args.runs, 306000),
                 ('scarce_deck', 48, 24, args.stress_runs, 307000),
                 ('long_event', 240, 160, args.stress_runs, 307000)]
    for scenario, hours, deck_size, count, first_seed in scenarios:
        module.EVENT_HOURS = hours
        for index in range(count):
            row = {'scenario': scenario, 'seed': first_seed + index}
            for policy in ['legacy', 'low_resources']:
                sim = module.Simulation(row['seed'], args.output.parent, write_outputs=False,
                                        subsidy_policy=policy, deck_size=deck_size)
                result = sim.run()
                inventory = [sum(p['points'] for p in s['players'].values()) + s['field']['pot_points']
                             for s in result['half_hour_snapshots']]
                row[policy] = {**result['economy'], 'collections': result['collections'],
                               'errors': len(result['invariant_errors']),
                               'fixed_failures': sum(not t['ok'] for k, tests in result.items()
                                                     if k.startswith('fixed_') for t in tests),
                               'inventory_24h': inventory[min(48, len(inventory)-1)],
                               'inventory_peak': max(inventory),
                               'last_day_min': min(inventory[-48:]),
                               'last_day_max': max(inventory[-48:])}
            rows.append(row)
        print(f'{scenario}: {count} pairs completed', flush=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    keys = ['ending_points', 'tournament_max_player_points', 'subsidy_payments',
            'instant_subsidy_payments', 'draw_costs', 'post_fees', 'extension_costs',
            'return_costs', 'collections', 'errors', 'fixed_failures']
    for scenario, *_ in scenarios:
        for policy in ['legacy', 'low_resources']:
            selected = [row[policy] for row in rows if row['scenario'] == scenario]
            if selected:
                print(scenario, policy, {k: round(statistics.mean(r.get(k, 0) for r in selected), 3)
                                         for k in keys})


if __name__ == '__main__':
    main()
