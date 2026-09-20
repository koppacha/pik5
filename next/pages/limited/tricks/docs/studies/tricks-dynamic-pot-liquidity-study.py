"""Compare legacy and adjusted liquidity, with and without an X hoarder."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import statistics
import sys
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime
from pathlib import Path


HERE = Path(__file__).resolve().parent
SOURCE = Path(__file__).resolve().parents[6] / "lab/tricks_rule_simulation.py"
X_NAME = "player_01"
SCENARIOS = ("legacy", "adjusted", "legacy_x_hoarder", "adjusted_x_hoarder")


def load_model():
    name = f"tricks_dynamic_pot_model_{id(object())}"
    spec = importlib.util.spec_from_file_location(name, SOURCE)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def hoarding_class(base):
    class HoardingSimulation(base):
        def _choose_action(self, player):
            if player.name != X_NAME:
                return super()._choose_action(player)
            free_posts = [
                action for action in self._legal_actions(player)
                if action["type"] == "initial_post"
                and self._initial_post_cost(self.cards[action["card_id"]], player) == 0
                and action.get("expected_point_net", 0) > 0
            ]
            if free_posts:
                return max(free_posts, key=lambda action: (
                    action["expected_point_net"] / max(1, action["duration"]),
                    action["expected_point_net"],
                ))
            return {"type": "wait", "reason": "x_hoards_points"}

    return HoardingSimulation


def run_one(task):
    seed, scenario = task
    model = load_model()
    adjusted = scenario.startswith("adjusted")
    klass = hoarding_class(model.Simulation) if scenario.endswith("x_hoarder") else model.Simulation
    sim = klass(
        seed=seed,
        output_dir=Path("/tmp/tricks-dynamic-pot-study"),
        write_outputs=False,
        allow_post_debt=adjusted,
        dynamic_wealth_tax_pot=adjusted,
        dynamic_hand_limit=adjusted,
    )
    summary = sim.run()
    economy = summary["economy"]
    active_points = []
    other_active_points = []
    x_points = []
    for snapshot in summary["half_hour_snapshots"]:
        at = datetime.fromisoformat(snapshot["timestamp"])
        for name, player in sim.players.items():
            if player.is_active(at):
                points = snapshot["players"][name]["points"]
                active_points.append(points)
                if name != X_NAME:
                    other_active_points.append(points)
        if at >= sim.players[X_NAME].join_at:
            x_points.append(snapshot["players"][X_NAME]["points"])
    pot = economy.get("pot", {})
    spending = economy["draw_costs"] + economy["field_payments"] + economy["return_costs"]
    return {
        "seed": seed,
        "scenario": scenario,
        "total_spending": spending,
        "collection_rewards": economy["collection_rewards"],
        "organic_collection_rewards": economy.get("organic_collection_rewards", economy["collection_rewards"]),
        "pot_inflow": pot.get("tax_inflow", 0) + pot.get("return_inflow", 0),
        "pot_distributed": pot.get("distributed_points", 0),
        "pot_ending": pot.get("ending_points", 0),
        "tax_points": pot.get("tax_inflow", 0),
        "return_points_to_pot": pot.get("return_inflow", 0),
        "collections": summary["collections"],
        "initial_posts": sum(p.actions.get("initial_post", 0) for p in sim.players.values()),
        "updates": sum(p.actions.get("update", 0) for p in sim.players.values()),
        "draws": sum(p.actions.get("draw", 0) for p in sim.players.values()),
        "takes": sum(len(p.take_times) for p in sim.players.values()),
        "rank_points": economy["confirmed_rank_points"],
        "ending_points": economy["ending_points"],
        "active_mean_points": statistics.mean(active_points),
        "active_nonpositive_rate": sum(p <= 0 for p in active_points) / len(active_points),
        "active_negative_rate": sum(p < 0 for p in active_points) / len(active_points),
        "active_under_two_rate": sum(p < 2 for p in active_points) / len(active_points),
        "other_active_mean_points": statistics.mean(other_active_points),
        "other_active_nonpositive_rate": sum(p <= 0 for p in other_active_points) / len(other_active_points),
        "other_active_negative_rate": sum(p < 0 for p in other_active_points) / len(other_active_points),
        "other_active_under_two_rate": sum(p < 2 for p in other_active_points) / len(other_active_points),
        "x_mean_points": statistics.mean(x_points),
        "x_ending_points": sim.players[X_NAME].points,
        "x_max_points": sim.players[X_NAME].max_points,
        "max_player_points": economy["tournament_max_player_points"],
        "max_hand": max(len(p.hand) for p in sim.players.values()),
        "invariant_errors": summary["invariant_errors"],
    }


def aggregate(rows):
    metrics = [key for key, value in rows[0].items() if key not in {"seed", "scenario", "invariant_errors"} and isinstance(value, (int, float))]
    result = {}
    for scenario in SCENARIOS:
        selected = [row for row in rows if row["scenario"] == scenario]
        result[scenario] = {key: statistics.mean(row[key] for row in selected) for key in metrics}
        result[scenario]["invariant_error_runs"] = sum(bool(row["invariant_errors"]) for row in selected)
    for before, after, label in (
        ("legacy", "adjusted", "adjusted_minus_legacy"),
        ("legacy_x_hoarder", "adjusted_x_hoarder", "adjusted_x_hoarder_minus_legacy_x_hoarder"),
    ):
        by_seed = {(row["seed"], row["scenario"]): row for row in rows}
        seeds = sorted({row["seed"] for row in rows})
        result[label] = {
            key: statistics.mean(by_seed[(seed, after)][key] - by_seed[(seed, before)][key] for seed in seeds)
            for key in metrics
        }
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=100)
    parser.add_argument("--seed", type=int, default=287000)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--output", type=Path, default=HERE / "tricks-dynamic-pot-liquidity-results.json")
    args = parser.parse_args()
    tasks = [(seed, scenario) for seed in range(args.seed, args.seed + args.runs) for scenario in SCENARIOS]
    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        rows = list(executor.map(run_one, tasks))
    payload = {
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "seeds": [args.seed, args.seed + args.runs - 1],
        "runs_per_scenario": args.runs,
        "aggregate": aggregate(rows),
        "rows": rows,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(payload["aggregate"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
