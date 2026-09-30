#!/usr/bin/env python3
"""前回のレア度案を基準に、レア度4・5のスタックボーナス変更を比較する。"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
import statistics
import sys
from pathlib import Path


STUDY_PATH = Path(__file__).with_name("tricks-take-rule-study.py")


def load_study():
    spec = importlib.util.spec_from_file_location("tricks_take_rule_study", STUDY_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load study: {STUDY_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def bonus_for(card, revise_four: bool, revise_five: bool) -> int:
    rarity = card.rarity or 1
    units = card.stack_count // 3
    if rarity == 4 and revise_four:
        return 2 * units + 7
    if rarity == 5 and revise_five:
        return 3 * units + 15
    return units + {2: 1, 3: 4, 4: 7, 5: 15}[rarity] if rarity >= 2 else 0


def make_simulation_type(study, simulator):
    base = study.make_simulation_type(simulator)

    class HighRaritySimulation(base):
        def __init__(self, *args, revise_four=False, revise_five=False, **kwargs):
            super().__init__(*args, rarity_bonus=True, **kwargs)
            self.revise_four = revise_four
            self.revise_five = revise_five
            self.take_events_by_rarity = {4: 0, 5: 0}

        def _with_bonus(self, card, operation):
            bonus = bonus_for(card, self.revise_four, self.revise_five)
            card.stack_count += bonus
            try:
                return operation()
            finally:
                card.stack_count -= bonus

        def _record(self, event_type, actor, details):
            super()._record(event_type, actor, details)
            if event_type == "take":
                rarity = self.cards[details["card_id"]].rarity
                if rarity in self.take_events_by_rarity:
                    self.take_events_by_rarity[rarity] += 1

    return HighRaritySimulation


def metrics(simulation, summary):
    players = summary["players"]
    rarities = [card.rarity for card in simulation.cards.values() if card.rarity is not None]
    initial_posts = sum(player["actions"].get("initial_post", 0) for player in players)
    updates = sum(player["actions"].get("update", 0) for player in players)
    return {
        "takes": sum(player["take_count"] for player in players),
        "posts": initial_posts + updates,
        "initial_posts": initial_posts,
        "updates": updates,
        "rank_points": sum(player["rank_points"] for player in players),
        "collection_rewards": summary["economy"]["collection_rewards"],
        "unique_rarity4": rarities.count(4),
        "unique_rarity5": rarities.count(5),
        "draw_events_rarity4": summary["rarity_draw_counts"][4],
        "draw_events_rarity5": summary["rarity_draw_counts"][5],
        "take_events_rarity4": simulation.take_events_by_rarity[4],
        "take_events_rarity5": simulation.take_events_by_rarity[5],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-seed", type=int, default=312000)
    parser.add_argument("--runs", type=int, default=100)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.runs < 1:
        parser.error("--runs must be positive")

    study = load_study()
    simulator = study.load_simulator()
    simulation_type = make_simulation_type(study, simulator)
    scenarios = {
        "previous_rarity_bonus": (False, False),
        "rarity4_revised": (True, False),
        "rarity5_revised": (False, True),
        "both_revised": (True, True),
    }
    rows = {name: [] for name in scenarios}
    original_weights = simulator.RARITY_DISTRIBUTION
    original_initial_rate = simulator.RARITY_INITIAL_RATE
    try:
        simulator.RARITY_DISTRIBUTION = study.NEW_RARITY_WEIGHTS
        simulator.RARITY_INITIAL_RATE = 13.0
        for seed in range(args.start_seed, args.start_seed + args.runs):
            for name, (revise_four, revise_five) in scenarios.items():
                simulation = simulation_type(
                    seed=seed,
                    output_dir=Path("/tmp"),
                    write_outputs=False,
                    revise_four=revise_four,
                    revise_five=revise_five,
                )
                summary = simulation.run()
                if summary["invariant_errors"]:
                    raise RuntimeError(f"seed={seed} scenario={name}: {summary['invariant_errors'][:3]}")
                rows[name].append(metrics(simulation, summary))
    finally:
        simulator.RARITY_DISTRIBUTION = original_weights
        simulator.RARITY_INITIAL_RATE = original_initial_rate

    means = {
        name: {key: round(statistics.mean(row[key] for row in values), 3) for key in values[0]}
        for name, values in rows.items()
    }
    baseline = rows["previous_rarity_bonus"]
    deltas = {}
    paired_ci95 = {}
    for name, values in rows.items():
        if name == "previous_rarity_bonus":
            continue
        deltas[name] = {}
        paired_ci95[name] = {}
        for key in ("takes", "posts", "rank_points", "collection_rewards"):
            differences = [row[key] - control[key] for row, control in zip(values, baseline)]
            mean = statistics.mean(differences)
            margin = 1.96 * statistics.stdev(differences) / math.sqrt(len(differences)) if len(differences) > 1 else 0
            deltas[name][key] = round(mean, 3)
            paired_ci95[name][key] = [round(mean - margin, 3), round(mean + margin, 3)]

    rarity4 = [row["unique_rarity4"] for row in baseline]
    rarity5 = [row["unique_rarity5"] for row in baseline]
    report = {
        "start_seed": args.start_seed,
        "runs_per_scenario": args.runs,
        "python_hash_seed": os.environ["PYTHONHASHSEED"],
        "event_hours": simulator.EVENT_HOURS,
        "participants": simulator.PLAYER_COUNT,
        "rarity_initial_weights_percent": dict(study.NEW_RARITY_WEIGHTS),
        "rarity_growth": "rare total grows exponentially from 13% to 100% by hour 46; relative proportions of tiers 2-5 remain fixed",
        "previous_bonus": "rarity 2-5: floor(stack/3) + [1,4,7,15] points respectively",
        "revised_bonus": "rarity 4: 2*floor(stack/3)+7, rarity 5: 3*floor(stack/3)+15; rarity 1-3 unchanged",
        "unique_rarity4_or_5_mean": round(statistics.mean(a+b for a,b in zip(rarity4, rarity5)), 3),
        "unique_rarity4_or_5_median": statistics.median(a+b for a,b in zip(rarity4, rarity5)),
        "unique_rarity4_or_5_max": max(a+b for a,b in zip(rarity4, rarity5)),
        "runs_with_no_unique_rarity4_or_5": sum(a+b == 0 for a,b in zip(rarity4, rarity5)),
        "means": means,
        "delta_from_previous": deltas,
        "paired_approximate_95ci": paired_ci95,
        "invariant_errors": 0,
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    if os.environ.get("PYTHONHASHSEED") != "0":
        os.execvpe(sys.executable, [sys.executable, *sys.argv], {**os.environ, "PYTHONHASHSEED": "0"})
    main()
