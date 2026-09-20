"""Compare case C with low-balance periodic and immediate first-post grants."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import statistics
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
ECONOMY_STUDY = HERE / "tricks-point-redistribution-study.py"
SOURCE = Path(__file__).resolve().parents[6] / "lab/tricks_rule_simulation.py"
POLICIES = ("case_c", "case_c_low_balance_30m", "case_c_instant_first_post")


def load_economy_study():
    name = "tricks_instant_grant_economy_study"
    spec = importlib.util.spec_from_file_location(name, ECONOMY_STUDY)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def periodic_low_balance_eligible(points: int) -> bool:
    return points <= 5


def low_balance_class(model, base, immediate_first_post: bool):
    class LowBalanceSimulation(base):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.low_balance_periodic_grants = 0
            self.instant_first_post_grants = 0

        def _handle_subsidy(self):
            paid_before = {
                name: player.last_subsidy_paid_slot_at
                for name, player in self.players.items()
            }
            super()._handle_subsidy()
            paid: list[str] = []
            for player in self.players.values():
                if (
                    not player.joined
                    or player.last_subsidy_paid_slot_at == self.now
                    or not periodic_low_balance_eligible(player.points)
                ):
                    continue
                player.points += 1
                player.last_subsidy_paid_slot_at = self.now
                self.subsidy_payments += 1
                self.low_balance_periodic_grants += 1
                player.actions["low_balance_periodic_grant"] = (
                    player.actions.get("low_balance_periodic_grant", 0) + 1
                )
                paid.append(player.name)
            # Grants made by the base path to a <=5P player are also low-balance
            # periodic grants when they were not already paid in this slot.
            for name, player in self.players.items():
                if (
                    paid_before[name] != self.now
                    and player.last_subsidy_paid_slot_at == self.now
                    and name not in paid
                ):
                    player.actions["base_subsidy_grant"] = player.actions.get("base_subsidy_grant", 0) + 1
            if paid:
                self._record("low_balance_periodic_grant", None, {"paid": paid, "threshold": 5})

        def _complete_initial_post(self, player_name, card_id, duration):
            if not immediate_first_post:
                return super()._complete_initial_post(player_name, card_id, duration)
            player = self.players[player_name]
            card = self.cards.get(card_id)
            free_initial = card is not None and card.taker != player_name
            before = player.actions.get("initial_post", 0)
            result = super()._complete_initial_post(player_name, card_id, duration)
            after = player.actions.get("initial_post", 0)
            if free_initial and after > before and periodic_low_balance_eligible(player.points):
                player.points += 1
                self.subsidy_payments += 1
                self.instant_first_post_grants += 1
                player.actions["instant_first_post_grant"] = (
                    player.actions.get("instant_first_post_grant", 0) + 1
                )
                self._record("instant_first_post_grant", player_name, {
                    "card_id": card_id,
                    "points": 1,
                    "remaining_points": player.points,
                })
            return result

    return LowBalanceSimulation


def player_metrics(economy, sim, name: str) -> dict[str, float | int]:
    metrics = economy.player_finance(sim, name)
    player = sim.players[name]
    metrics["periodic_grants"] = (
        player.actions.get("low_balance_periodic_grant", 0)
        + player.actions.get("base_subsidy_grant", 0)
    )
    metrics["instant_grants"] = player.actions.get("instant_first_post_grant", 0)
    return metrics


def run_one(args: tuple[int, str]) -> dict[str, Any]:
    seed, policy = args
    economy = load_economy_study()
    model = economy.load_model()
    base = economy.proposal_class(model, "case_c")
    klass = (
        low_balance_class(model, base, policy == "case_c_instant_first_post")
        if policy != "case_c"
        else base
    )
    sim = klass(
        seed=seed,
        output_dir=Path("/tmp/tricks-instant-grant-study"),
        write_outputs=False,
        take_cooldown_policy="all_field_first_endgame_free",
        take_cost_mode="level_sqrt",
        post_cost_policy="taker_initial_and_retries_paid",
        reward_formula="balanced",
        remainder_policy="last_poster",
        player_extension_enabled=True,
    )
    summary = sim.run()
    mismatch = sum(
        bool(card.reward_log)
        and sum(entry["points"] for entry in card.reward_log) != sim._total_reward_points(card)
        for card in sim.cards.values()
    )
    instant = getattr(sim, "instant_first_post_grants", 0)
    return {
        "seed": seed,
        "policy": policy,
        "players": {name: player_metrics(economy, sim, name) for name in sorted(sim.players)},
        "economy": summary["economy"],
        "collections": summary["collections"],
        "subsidy_payments": summary["subsidy_payments"],
        "scheduled_subsidy_payments": summary["subsidy_payments"] - instant,
        "instant_first_post_grants": instant,
        "distribution_mismatch": mismatch,
        "invariant_errors": summary["invariant_errors"],
    }


def average(rows: list[dict[str, Any]], key: str) -> float:
    return statistics.mean(row[key] for row in rows)


def aggregate(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_seed = {(row["seed"], row["policy"]): row for row in rows}
    seeds = sorted({row["seed"] for row in rows})
    cohorts = {policy: [] for policy in POLICIES}
    all_players = {policy: [] for policy in POLICIES}
    for seed in seeds:
        baseline = by_seed[(seed, "case_c_low_balance_30m")]
        bottom = sorted(
            baseline["players"],
            key=lambda name: (baseline["players"][name]["rank_points"], name),
        )[:4]
        for policy in POLICIES:
            row = by_seed[(seed, policy)]
            cohorts[policy].extend(row["players"][name] for name in bottom)
            all_players[policy].extend(row["players"].values())
    keys = (
        "ending_points", "rank_points", "rewards", "post_fees", "draws", "takes",
        "initial_posts", "updates", "mean_active_points", "periodic_grants", "instant_grants",
    )
    result = {}
    for policy in POLICIES:
        selected = [row for row in rows if row["policy"] == policy]
        cohort = cohorts[policy]
        everyone = all_players[policy]
        result[policy] = {
            "runs": len(selected),
            "bottom_cohort": {key: average(cohort, key) for key in keys},
            "bottom_zero_active_rate": sum(r["zero_active_snapshots"] for r in cohort) / max(1, sum(r["active_snapshots"] for r in cohort)),
            "bottom_under_two_active_rate": sum(r["under_two_active_snapshots"] for r in cohort) / max(1, sum(r["active_snapshots"] for r in cohort)),
            "all_players": {key: average(everyone, key) for key in keys},
            "event": {
                "collections": average(selected, "collections"),
                "subsidy_payments": average(selected, "subsidy_payments"),
                "scheduled_subsidy_payments": average(selected, "scheduled_subsidy_payments"),
                "instant_first_post_grants": average(selected, "instant_first_post_grants"),
                "collection_rewards": statistics.mean(r["economy"]["collection_rewards"] for r in selected),
                "post_fees": statistics.mean(r["economy"]["post_fees"] for r in selected),
                "ending_points": statistics.mean(r["economy"]["ending_points"] for r in selected),
            },
            "invariant_error_runs": sum(bool(r["invariant_errors"]) for r in selected),
            "distribution_mismatch_runs": sum(bool(r["distribution_mismatch"]) for r in selected),
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=100)
    parser.add_argument("--seed", type=int, default=283000)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--output", type=Path, default=HERE / "tricks-instant-grant-results.json")
    args = parser.parse_args()
    assert periodic_low_balance_eligible(5)
    assert not periodic_low_balance_eligible(6)
    tasks = [
        (seed, policy)
        for seed in range(args.seed, args.seed + args.runs)
        for policy in POLICIES
    ]
    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        rows = list(executor.map(run_one, tasks))
    payload = {
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "economy_study_sha256": hashlib.sha256(ECONOMY_STUDY.read_bytes()).hexdigest(),
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
