#!/usr/bin/env python3
"""同じ乱数シードで初期山札枚数別の同時枯渇を比較する。"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path


def load_simulator():
    path = Path(__file__).resolve().parents[6] / "lab/tricks_rule_simulation.py"
    spec = importlib.util.spec_from_file_location("tricks_rule_simulation", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load simulator: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sizes", nargs="+", type=int, required=True)
    parser.add_argument("--start-seed", type=int, default=310000)
    parser.add_argument("--runs", type=int, default=100)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.runs < 1:
        parser.error("--runs must be positive")
    simulator = load_simulator()
    results = []
    for size in args.sizes:
        rows = []
        for seed in range(args.start_seed, args.start_seed + args.runs):
            simulation = simulator.Simulation(
                seed=seed,
                output_dir=Path("/tmp"),
                deck_size=size,
                write_outputs=False,
            )
            summary = simulation.run()
            depletion = summary["deck_trash_depletion"]
            if summary["invariant_errors"]:
                raise RuntimeError(f"seed={seed} size={size}: {summary['invariant_errors']}")
            rows.append({"seed": seed, **depletion})
        results.append({
            "deck_size": size,
            "runs": len(rows),
            "depleted_runs": sum(row["interval_count"] > 0 for row in rows),
            "total_intervals": sum(row["interval_count"] for row in rows),
            "minimum_available_cards": min(row["minimum_available_cards"] for row in rows),
            "blocked_draws_with_points": sum(row["blocked_draws_with_points"] for row in rows),
            "sample_depleted_seeds": [
                row["seed"] for row in rows if row["interval_count"] > 0
            ][:10],
        })
    report = {
        "participants": simulator.PLAYER_COUNT,
        "start_seed": args.start_seed,
        "runs_per_size": args.runs,
        "results": results,
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
