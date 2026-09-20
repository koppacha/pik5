"""Measure liquidity impact when the top-skill X player hoards points."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import statistics
import sys
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
SOURCE = Path(__file__).resolve().parents[6] / "lab/tricks_rule_simulation.py"
POLICIES = ("baseline", "x_hoarder")
X_NAME = "player_01"


def load_model():
    name = "tricks_x_hoarding_model"
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
            options = self._legal_actions(player)
            free_posts = [
                action
                for action in options
                if action["type"] == "initial_post"
                and self._initial_post_cost(self.cards[action["card_id"]], player) == 0
                and action.get("expected_point_net", 0) > 0
            ]
            if free_posts:
                # 無料還元の期待値を所要時間で割り、残高増加効率が最大の場札を選ぶ。
                return max(
                    free_posts,
                    key=lambda action: (
                        action["expected_point_net"] / max(1, action["duration"]),
                        action["expected_point_net"],
                        -action["duration"],
                    ),
                )
            return {"type": "wait", "reason": "x_hoards_points"}

    return HoardingSimulation


def snapshot_metrics(sim, snapshots: list[dict[str, Any]]) -> dict[str, float]:
    x = sim.players[X_NAME]
    joined = []
    active = []
    x_shares = []
    rest_stocks = []
    other_active_points: list[int] = []
    for snapshot in snapshots:
        at = datetime.fromisoformat(snapshot["timestamp"])
        players = snapshot["players"]
        if at < x.join_at:
            continue
        x_points = players[X_NAME]["points"]
        total = sum(row["points"] for row in players.values())
        joined.append(x_points)
        rest_stocks.append(total - x_points)
        if total > 0:
            x_shares.append(x_points / total)
        if x.is_active(at):
            active.append(x_points)
        for name, other in sim.players.items():
            if name != X_NAME and other.is_active(at):
                other_active_points.append(players[name]["points"])
    return {
        "x_mean_points_joined": statistics.mean(joined),
        "x_mean_points_active": statistics.mean(active),
        "x_mean_stock_share": statistics.mean(x_shares),
        "rest_mean_stock": statistics.mean(rest_stocks),
        "other_active_mean_points": statistics.mean(other_active_points),
        "other_active_zero_rate": sum(p <= 0 for p in other_active_points) / len(other_active_points),
        "other_active_under_two_rate": sum(p < 2 for p in other_active_points) / len(other_active_points),
    }


def run_one(args: tuple[int, str]) -> dict[str, Any]:
    seed, policy = args
    model = load_model()
    klass = model.Simulation if policy == "baseline" else hoarding_class(model.Simulation)
    sim = klass(
        seed=seed,
        output_dir=Path("/tmp/tricks-x-hoarding-study"),
        write_outputs=False,
    )
    summary = sim.run()
    x = sim.players[X_NAME]
    x_rewards = sum(
        entry["points"]
        for card in sim.cards.values()
        for entry in card.reward_log
        if entry["player"] == X_NAME
    )
    economy = summary["economy"]
    snapshots = snapshot_metrics(sim, summary["half_hour_snapshots"])
    other_players = [player for name, player in sim.players.items() if name != X_NAME]
    return {
        "seed": seed,
        "policy": policy,
        "x_personality": x.personality,
        "x_ending_points": x.points,
        "x_max_points": x.max_points,
        "x_rank_points": x.rank_points,
        "x_rewards": x_rewards,
        "x_initial_posts": x.actions.get("initial_post", 0),
        "x_updates": x.actions.get("update", 0),
        "x_draws": x.actions.get("draw", 0),
        "x_takes": len(x.take_times),
        "x_spending": (
            x.actions.get("draw", 0)
            + sum(card.paid_points_by_player.get(X_NAME, 0) for card in sim.cards.values())
            + x.actions.get("return_to_deck", 0)
        ),
        **snapshots,
        "other_ending_points": statistics.mean(player.points for player in other_players),
        "other_rank_points": statistics.mean(player.rank_points for player in other_players),
        "collections": summary["collections"],
        "total_spending": economy["draw_costs"] + economy["field_payments"] + economy["return_costs"],
        "draw_costs": economy["draw_costs"],
        "field_payments": economy["field_payments"],
        "return_costs": economy["return_costs"],
        "collection_rewards": economy["collection_rewards"],
        "subsidy_payments": economy["subsidy_payments"],
        "ending_points": economy["ending_points"],
        "confirmed_rank_points": economy["confirmed_rank_points"],
        "initial_posts": sum(player.actions.get("initial_post", 0) for player in sim.players.values()),
        "updates": sum(player.actions.get("update", 0) for player in sim.players.values()),
        "draws": sum(player.actions.get("draw", 0) for player in sim.players.values()),
        "takes": sum(len(player.take_times) for player in sim.players.values()),
        "invariant_errors": summary["invariant_errors"],
    }


def mean(rows: list[dict[str, Any]], key: str) -> float:
    return statistics.mean(row[key] for row in rows)


def aggregate(rows: list[dict[str, Any]]) -> dict[str, Any]:
    metrics = (
        "x_ending_points", "x_max_points", "x_rank_points", "x_rewards",
        "x_initial_posts", "x_updates", "x_draws", "x_takes", "x_spending",
        "x_mean_points_joined", "x_mean_points_active", "x_mean_stock_share",
        "rest_mean_stock", "other_active_mean_points", "other_active_zero_rate",
        "other_active_under_two_rate", "other_ending_points", "other_rank_points",
        "collections", "total_spending", "draw_costs", "field_payments", "return_costs",
        "collection_rewards", "subsidy_payments", "ending_points", "confirmed_rank_points",
        "initial_posts", "updates", "draws", "takes",
    )
    result: dict[str, Any] = {}
    for policy in POLICIES:
        selected = [row for row in rows if row["policy"] == policy]
        result[policy] = {key: mean(selected, key) for key in metrics}
        result[policy]["x_max_points_observed"] = max(row["x_max_points"] for row in selected)
        result[policy]["invariant_error_runs"] = sum(bool(row["invariant_errors"]) for row in selected)

    by_seed = {(row["seed"], row["policy"]): row for row in rows}
    seeds = sorted({row["seed"] for row in rows})
    paired = {}
    for key in metrics:
        differences = [
            by_seed[(seed, "x_hoarder")][key] - by_seed[(seed, "baseline")][key]
            for seed in seeds
        ]
        average = statistics.mean(differences)
        margin = 1.984 * statistics.stdev(differences) / math.sqrt(len(differences))
        paired[key] = {
            "mean_difference": average,
            "ci95": [average - margin, average + margin],
        }
    result["x_hoarder_minus_baseline"] = paired
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=100)
    parser.add_argument("--seed", type=int, default=285000)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument(
        "--output",
        type=Path,
        default=HERE / "tricks-x-hoarding-results.json",
    )
    args = parser.parse_args()
    tasks = [
        (seed, policy)
        for seed in range(args.seed, args.seed + args.runs)
        for policy in POLICIES
    ]
    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        rows = list(executor.map(run_one, tasks))
    payload = {
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "seeds": [args.seed, args.seed + args.runs - 1],
        "runs_per_policy": args.runs,
        "aggregate": aggregate(rows),
        "rows": rows,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(payload["aggregate"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
