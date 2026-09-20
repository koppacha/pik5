"""Compare legacy and rank-point-rational paid update decisions."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import statistics
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
DEFAULT_SOURCE = Path(__file__).resolve().parents[6] / "lab/tricks_rule_simulation.py"
POLICIES = ("legacy", "rank_point_roi")


def load_model(source: Path):
    name = f"tricks_paid_update_{source.stat().st_mtime_ns}_{source.stat().st_size}"
    spec = importlib.util.spec_from_file_location(name, source)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def run_one(args: tuple[int, str, str]) -> dict[str, Any]:
    seed, policy, source_text = args
    model = load_model(Path(source_text))
    sim = model.Simulation(
        seed=seed,
        output_dir=Path("/tmp/tricks-paid-update-study"),
        write_outputs=False,
        paid_update_policy=policy,
    )
    summary = sim.run()
    players = summary["players"]
    return {
        "seed": seed,
        "policy": policy,
        "collections": summary["collections"],
        "ending_points": summary["economy"]["ending_points"],
        "confirmed_rank_points": summary["economy"]["confirmed_rank_points"],
        "post_fees": summary["economy"]["post_fees"],
        "tournament_max_player_points": summary["economy"]["tournament_max_player_points"],
        "tournament_max_point_players": summary["economy"]["tournament_max_point_players"],
        "invariant_errors": summary["invariant_errors"],
        "fixed_prediction_failures": [
            row for row in summary["fixed_prediction_tests"] if not row["ok"]
        ],
        "players": [
            {
                "name": player["name"],
                "personality": player["personality"],
                "points": player["points"],
                "max_points": player["max_points"],
                "rank_points": player["rank_points"],
                "updates": player["actions"].get("update", 0),
                "update_points_spent": player["actions"].get("update_points_spent", 0),
                "update_forecast_rank_point_gain": player["actions"].get(
                    "update_forecast_rank_point_gain", 0
                ),
                "withheld_update_rank_value": player["actions"].get(
                    "update_score_withheld_rank_value", 0
                ),
                "updates_without_rank_point_gain": player["actions"].get(
                    "update_paid_without_rank_point_gain", 0
                ),
                "updates_below_point_roi": player["actions"].get(
                    "update_paid_below_point_roi", 0
                ),
            }
            for player in players
        ],
    }


def mean(rows: list[dict[str, Any]], key: str) -> float:
    return statistics.mean(row[key] for row in rows)


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    index = (len(ordered) - 1) * fraction
    lower = math.floor(index)
    upper = math.ceil(index)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower)


def aggregate(rows: list[dict[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for policy in POLICIES:
        selected = [row for row in rows if row["policy"] == policy]
        players = [player for row in selected for player in row["players"]]
        max_points = [row["tournament_max_player_points"] for row in selected]
        personalities = sorted({player["personality"] for player in players})
        result[policy] = {
            "runs": len(selected),
            "event": {
                "collections": mean(selected, "collections"),
                "ending_points": mean(selected, "ending_points"),
                "confirmed_rank_points": mean(selected, "confirmed_rank_points"),
                "post_fees": mean(selected, "post_fees"),
                "tournament_max_player_points_mean": statistics.mean(max_points),
                "tournament_max_player_points_median": statistics.median(max_points),
                "tournament_max_player_points_p95": percentile(max_points, 0.95),
                "tournament_max_player_points_max": max(max_points),
                "tournament_max_player_points_min": min(max_points),
            },
            "all_players": {
                "updates": mean(players, "updates"),
                "update_points_spent": mean(players, "update_points_spent"),
                "update_forecast_rank_point_gain": mean(
                    players, "update_forecast_rank_point_gain"
                ),
                "withheld_update_rank_value": mean(players, "withheld_update_rank_value"),
                "updates_without_rank_point_gain": mean(
                    players, "updates_without_rank_point_gain"
                ),
                "updates_below_point_roi": mean(players, "updates_below_point_roi"),
                "ending_points": mean(players, "points"),
                "max_points": mean(players, "max_points"),
                "rank_points": mean(players, "rank_points"),
            },
            "by_personality": {
                personality: {
                    **{
                        key: mean(
                            [p for p in players if p["personality"] == personality], key
                        )
                        for key in (
                        "updates",
                        "update_points_spent",
                        "update_forecast_rank_point_gain",
                        "withheld_update_rank_value",
                        "updates_without_rank_point_gain",
                        "updates_below_point_roi",
                        "max_points",
                        "rank_points",
                        )
                    },
                    "ending_points": mean(
                        [p for p in players if p["personality"] == personality],
                        "points",
                    ),
                }
                for personality in personalities
            },
            "invariant_error_runs": sum(bool(row["invariant_errors"]) for row in selected),
            "fixed_prediction_failure_runs": sum(
                bool(row["fixed_prediction_failures"]) for row in selected
            ),
        }

    by_seed = {(row["seed"], row["policy"]): row for row in rows}
    seeds = sorted({row["seed"] for row in rows})
    paired = {}
    for key in (
        "collections",
        "ending_points",
        "confirmed_rank_points",
        "post_fees",
        "tournament_max_player_points",
    ):
        differences = [
            by_seed[(seed, "rank_point_roi")][key] - by_seed[(seed, "legacy")][key]
            for seed in seeds
        ]
        average = statistics.mean(differences)
        margin = 1.984 * statistics.stdev(differences) / math.sqrt(len(differences))
        paired[key] = {
            "mean_difference": average,
            "ci95": [average - margin, average + margin],
        }
    result["rank_point_roi_minus_legacy"] = paired
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=100)
    parser.add_argument("--seed", type=int, default=284000)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument(
        "--output",
        type=Path,
        default=HERE / "tricks-paid-update-rationality-results.json",
    )
    args = parser.parse_args()
    tasks = [
        (seed, policy, str(args.source.resolve()))
        for seed in range(args.seed, args.seed + args.runs)
        for policy in POLICIES
    ]
    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        rows = list(executor.map(run_one, tasks))
    payload = {
        "source": str(args.source.resolve()),
        "source_sha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
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
