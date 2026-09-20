"""Grid-search periodic high-balance tax thresholds and amounts."""
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
HOARDING_STUDY = HERE / "tricks-x-hoarding-study.py"
X_NAME = "player_01"


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def reward_allocation(model, sim, card, ranking, total: int) -> dict[str, int]:
    if not ranking:
        return {}
    if sum(len(group["players"]) for group in ranking) == 1:
        return {ranking[0]["players"][0]: total}
    eligible = sim._eligible_reward_groups(ranking)
    distribution, remainder = model.distribute_rank_rewards(total, eligible)
    result = dict(distribution)
    if remainder:
        if sim.remainder_policy == "last_poster":
            players = sorted(ranking[-1]["players"])
            share, extra = divmod(remainder, len(players))
            for index, name in enumerate(players):
                result[name] = result.get(name, 0) + share + int(index < extra)
        elif card.taker:
            result[card.taker] = result.get(card.taker, 0) + remainder
    return result


def taxed_class(model, base, threshold: int, amount: int):
    class TaxedSimulation(base):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.tax_pot = 0
            self.tax_collected = 0
            self.tax_events = 0
            self.tax_paid_by_player = {name: 0 for name in self.players}
            self.tax_bonus_by_card: dict[int, int] = {}
            self.tax_redistributed = 0
            self.tax_bonus_to_low_balance = 0
            self.tax_bonus_to_bottom_half = 0
            self.tax_bonus_to_taxpayers = 0
            self.tax_bonus_to_x = 0

        def _handle_subsidy(self):
            super()._handle_subsidy()
            paid = {}
            for player in self.players.values():
                if not player.joined or player.points < threshold:
                    continue
                tax = min(amount, player.points)
                player.points -= tax
                self.tax_pot += tax
                self.tax_collected += tax
                self.tax_paid_by_player[player.name] += tax
                paid[player.name] = tax
            if paid:
                self.tax_events += 1
                self._record("periodic_income_tax", None, {
                    "threshold": threshold,
                    "amount": amount,
                    "paid": paid,
                    "pot": self.tax_pot,
                })

        def _total_reward_points(self, card):
            return super()._total_reward_points(card) + self.tax_bonus_by_card.get(card.id, 0)

        def _apply_collection_rewards(self, card, ranking):
            if not ranking or self.tax_pot <= 0:
                return super()._apply_collection_rewards(card, ranking)
            bonus = self.tax_pot
            self.tax_pot = 0
            base_total = super()._total_reward_points(card)
            combined = base_total + bonus
            base_allocation = reward_allocation(model, self, card, ranking, base_total)
            combined_allocation = reward_allocation(model, self, card, ranking, combined)
            bonus_allocation = {
                name: combined_allocation.get(name, 0) - base_allocation.get(name, 0)
                for name in set(base_allocation) | set(combined_allocation)
            }
            before = {name: self.players[name].points for name in bonus_allocation}
            ranks = {
                name: group["rank"]
                for group in ranking
                for name in group["players"]
            }
            participants = sum(len(group["players"]) for group in ranking)
            self.tax_bonus_by_card[card.id] = bonus
            result = super()._apply_collection_rewards(card, ranking)
            self.tax_redistributed += bonus
            self.tax_bonus_to_low_balance += sum(
                value for name, value in bonus_allocation.items() if before[name] <= 5
            )
            self.tax_bonus_to_bottom_half += sum(
                value
                for name, value in bonus_allocation.items()
                if ranks[name] > participants / 2
            )
            self.tax_bonus_to_taxpayers += sum(
                value
                for name, value in bonus_allocation.items()
                if self.tax_paid_by_player[name] > 0
            )
            self.tax_bonus_to_x += bonus_allocation.get(X_NAME, 0)
            result["income_tax_bonus"] = bonus
            result["income_tax_bonus_distribution"] = bonus_allocation
            return result

    return TaxedSimulation


def snapshot_metrics(sim, snapshots: list[dict[str, Any]]) -> dict[str, float]:
    x = sim.players[X_NAME]
    x_points = []
    x_shares = []
    other_active = []
    for snapshot in snapshots:
        at = datetime.fromisoformat(snapshot["timestamp"])
        if at < x.join_at:
            continue
        players = snapshot["players"]
        total = sum(row["points"] for row in players.values())
        x_points.append(players[X_NAME]["points"])
        if total > 0:
            x_shares.append(players[X_NAME]["points"] / total)
        for name, player in sim.players.items():
            if name != X_NAME and player.is_active(at):
                other_active.append(players[name]["points"])
    return {
        "x_mean_points": statistics.mean(x_points),
        "x_mean_stock_share": statistics.mean(x_shares),
        "other_active_mean_points": statistics.mean(other_active),
        "other_active_zero_rate": sum(p <= 0 for p in other_active) / len(other_active),
        "other_active_under_two_rate": sum(p < 2 for p in other_active) / len(other_active),
    }


def run_one(args: tuple[int, bool, int, int]) -> dict[str, Any]:
    seed, hoarder, threshold, amount = args
    model = load_module(SOURCE, f"tricks_tax_model_{seed}_{hoarder}_{threshold}_{amount}")
    hoarding = load_module(HOARDING_STUDY, f"tricks_tax_hoarding_{seed}_{hoarder}_{threshold}_{amount}")
    base = hoarding.hoarding_class(model.Simulation) if hoarder else model.Simulation
    klass = taxed_class(model, base, threshold, amount) if amount > 0 else base
    sim = klass(
        seed=seed,
        output_dir=Path("/tmp/tricks-income-tax-study"),
        write_outputs=False,
    )
    summary = sim.run()
    economy = summary["economy"]
    x = sim.players[X_NAME]
    tax_collected = getattr(sim, "tax_collected", 0)
    tax_paid = getattr(sim, "tax_paid_by_player", {name: 0 for name in sim.players})
    return {
        "seed": seed,
        "hoarder": hoarder,
        "q": threshold,
        "t": amount,
        "x_ending_points": x.points,
        "x_max_points": x.max_points,
        "x_rank_points": x.rank_points,
        **snapshot_metrics(sim, summary["half_hour_snapshots"]),
        "other_ending_points": statistics.mean(
            player.points for name, player in sim.players.items() if name != X_NAME
        ),
        "other_rank_points": statistics.mean(
            player.rank_points for name, player in sim.players.items() if name != X_NAME
        ),
        "collections": summary["collections"],
        "total_spending": economy["draw_costs"] + economy["field_payments"] + economy["return_costs"],
        "collection_rewards": economy["collection_rewards"],
        "ending_points": economy["ending_points"],
        "confirmed_rank_points": economy["confirmed_rank_points"],
        "tax_collected": tax_collected,
        "taxed_players": sum(value > 0 for value in tax_paid.values()),
        "x_tax_paid": tax_paid.get(X_NAME, 0),
        "tax_redistributed": getattr(sim, "tax_redistributed", 0),
        "tax_unallocated": getattr(sim, "tax_pot", 0),
        "tax_bonus_to_low_balance": getattr(sim, "tax_bonus_to_low_balance", 0),
        "tax_bonus_to_bottom_half": getattr(sim, "tax_bonus_to_bottom_half", 0),
        "tax_bonus_to_taxpayers": getattr(sim, "tax_bonus_to_taxpayers", 0),
        "tax_bonus_to_x": getattr(sim, "tax_bonus_to_x", 0),
        "invariant_errors": summary["invariant_errors"],
    }


def mean(rows: list[dict[str, Any]], key: str) -> float:
    return statistics.mean(row[key] for row in rows)


def aggregate(rows: list[dict[str, Any]]) -> dict[str, Any]:
    keys = tuple(key for key in rows[0] if key not in {"seed", "hoarder", "q", "t", "invariant_errors"})
    result = {}
    scenarios = sorted({(row["hoarder"], row["q"], row["t"]) for row in rows})
    for hoarder, q, t in scenarios:
        selected = [
            row for row in rows
            if (row["hoarder"], row["q"], row["t"]) == (hoarder, q, t)
        ]
        name = f"{'hoarder' if hoarder else 'normal'}_q{q}_t{t}"
        result[name] = {key: mean(selected, key) for key in keys}
        result[name]["runs"] = len(selected)
        result[name]["invariant_error_runs"] = sum(bool(row["invariant_errors"]) for row in selected)
        if result[name]["tax_collected"] > 0:
            result[name]["low_balance_bonus_share"] = (
                result[name]["tax_bonus_to_low_balance"] / result[name]["tax_collected"]
            )
            result[name]["bottom_half_bonus_share"] = (
                result[name]["tax_bonus_to_bottom_half"] / result[name]["tax_collected"]
            )
            result[name]["taxpayer_recapture_share"] = (
                result[name]["tax_bonus_to_taxpayers"] / result[name]["tax_collected"]
            )
            result[name]["x_recapture_share"] = (
                result[name]["tax_bonus_to_x"] / result[name]["tax_collected"]
            )
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=30)
    parser.add_argument("--seed", type=int, default=286000)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--q", type=int, nargs="+", default=[18, 21, 23, 25, 28])
    parser.add_argument("--t", type=int, nargs="+", default=[1, 2, 3, 4])
    parser.add_argument("--include-baseline", action="store_true")
    parser.add_argument(
        "--output",
        type=Path,
        default=HERE / "tricks-income-tax-grid-results.json",
    )
    args = parser.parse_args()
    candidates = [(q, t) for q in args.q for t in args.t if 0 < t < q]
    if args.include_baseline:
        candidates = [(0, 0), *candidates]
    tasks = [
        (seed, hoarder, q, t)
        for seed in range(args.seed, args.seed + args.runs)
        for hoarder in (False, True)
        for q, t in candidates
    ]
    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        rows = list(executor.map(run_one, tasks))
    payload = {
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "seeds": [args.seed, args.seed + args.runs - 1],
        "runs_per_scenario": args.runs,
        "aggregate": aggregate(rows),
        "rows": rows,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(payload["aggregate"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
