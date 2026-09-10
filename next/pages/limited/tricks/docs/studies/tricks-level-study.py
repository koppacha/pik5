"""Compare the current field-based take cost with public level-based candidates.

Run from next/pages/limited/tricks:
    python3 docs/studies/tricks-level-study.py
"""
import hashlib
import importlib.util
import json
import statistics
import sys
import argparse
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path


SOURCE = Path(__file__).resolve().parents[6] / "lab/tricks_rule_simulation.py"
SEEDS = range(276000, 276100)
SCENARIOS = {
    "field_current": {"mode": "field", "k": None, "formula": "3 + floor(field / 2)"},
    "level_k1": {"mode": "level_linear", "k": 1, "formula": "L=1+floor(T/1), M=L+2"},
    "level_k2": {"mode": "level_linear", "k": 2, "formula": "L=1+floor(T/2), M=L+2"},
    "level_k3": {"mode": "level_linear", "k": 3, "formula": "L=1+floor(T/3), M=L+2"},
    "level_k4": {"mode": "level_linear", "k": 4, "formula": "L=1+floor(T/4), M=L+2"},
}
TIME_BINS = ((0, 12), (12, 24), (24, 36), (36, 47))


def load_model():
    spec = importlib.util.spec_from_file_location("tricks_level_model", SOURCE)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def mean(values):
    return statistics.mean(values) if values else None


def run(job):
    seed, scenario_name = job
    scenario = SCENARIOS[scenario_name]
    model = load_model()
    sim = model.Simulation(
        seed=seed,
        output_dir=Path("/tmp/tricks-level-study"),
        write_outputs=False,
        take_cooldown_policy="all_field_first_endgame_free",
        take_cost_mode=scenario["mode"],
        take_level_up_every=scenario["k"] or 2,
    )
    summary = sim.run()
    player_rows = []
    all_stacks = []
    all_costs = []
    all_levels = []
    time_stacks = {f"{start}-{end}h": [] for start, end in TIME_BINS}
    ordinal_stacks = {str(index): [] for index in range(1, 7)}
    for player in sim.players.values():
        stacks = player.take_stack_counts
        player_rows.append({
            "draws": player.actions.get("draw", 0),
            "takes": len(player.take_times),
            "mean_stack": mean(stacks),
            "max_stack": player.max_stack_count,
        })
        for ordinal, (taken_at, stack, cost) in enumerate(zip(player.take_times, stacks, player.take_costs), start=1):
            all_stacks.append(stack)
            all_costs.append(cost)
            all_levels.append(model.take_level_for_count(ordinal - 1, scenario["k"] or 2) if scenario["mode"] == "level_linear" else None)
            elapsed_hour = (taken_at - sim.start_at).total_seconds() / 3600
            for start, end in TIME_BINS:
                if start <= elapsed_hour < end:
                    time_stacks[f"{start}-{end}h"].append(stack)
                    break
            ordinal_stacks[str(min(ordinal, 6))].append(stack)
    snapshots = summary.get("half_hour_snapshots", [])
    return {
        "seed": seed,
        "scenario": scenario_name,
        "user_mean_draws": mean([row["draws"] for row in player_rows]),
        "user_mean_takes": mean([row["takes"] for row in player_rows]),
        "take_stack_mean": mean(all_stacks),
        "take_cost_mean": mean(all_costs),
        "take_level_mean": mean([level for level in all_levels if level is not None]),
        "user_mean_max_stack": mean([row["max_stack"] for row in player_rows]),
        "total_takes": len(all_stacks),
        "total_draws": sum(row["draws"] for row in player_rows),
        "time_stack_mean": {key: mean(values) for key, values in time_stacks.items()},
        "time_stack_count": {key: len(values) for key, values in time_stacks.items()},
        "ordinal_stack_mean": {key: mean(values) for key, values in ordinal_stacks.items()},
        "mean_field": mean([snapshot["field"]["field_count"] for snapshot in snapshots]),
        "min_available": min((snapshot["field"]["deck_count"] + snapshot["field"]["trash_count"] for snapshot in snapshots), default=200),
        "invariant_errors": summary["invariant_errors"],
    }


def aggregate(rows):
    numeric_keys = (
        "user_mean_draws", "user_mean_takes", "take_stack_mean", "take_cost_mean",
        "take_level_mean", "user_mean_max_stack", "total_takes", "total_draws", "mean_field", "min_available",
    )
    result = {key: mean([row[key] for row in rows if row[key] is not None]) for key in numeric_keys}
    result["time_stack_mean"] = {
        key: mean([row["time_stack_mean"][key] for row in rows if row["time_stack_mean"][key] is not None])
        for key in rows[0]["time_stack_mean"]
    }
    result["ordinal_stack_mean"] = {
        key: mean([row["ordinal_stack_mean"][key] for row in rows if row["ordinal_stack_mean"][key] is not None])
        for key in rows[0]["ordinal_stack_mean"]
    }
    result["runs_no_available"] = sum(row["min_available"] == 0 for row in rows)
    result["invariant_error_runs"] = sum(bool(row["invariant_errors"]) for row in rows)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=len(SEEDS), help="scenarioごとの連続seed数")
    parser.add_argument("--seed", type=int, default=min(SEEDS), help="開始seed")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    if args.runs < 1 or args.workers < 1:
        raise ValueError("runs and workers must be positive")
    seeds = range(args.seed, args.seed + args.runs)
    jobs = [(seed, scenario) for seed in seeds for scenario in SCENARIOS]
    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        rows = list(executor.map(run, jobs))
    report = {
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "seeds": [min(seeds), max(seeds)],
        "runs_per_scenario": len(seeds),
        "scenarios": SCENARIOS,
        "rows": rows,
        "means": {name: aggregate([row for row in rows if row["scenario"] == name]) for name in SCENARIOS},
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
