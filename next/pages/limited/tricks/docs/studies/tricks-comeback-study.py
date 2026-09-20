"""Compare case C with comeback tickets and 15-minute subsidy slots."""
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
ECONOMY_STUDY = HERE / "tricks-point-redistribution-study.py"
SOURCE = Path(__file__).resolve().parents[6] / "lab/tricks_rule_simulation.py"
POLICIES = ("case_c", "case_c_ticket", "case_c_subsidy_15m")


def load_economy_study():
    name = "tricks_comeback_economy_study"
    spec = importlib.util.spec_from_file_location(name, ECONOMY_STUDY)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def comeback_ticket_eligible(
    rank: int,
    participants: int,
    points_after_reward: int,
    has_ticket: bool,
    minutes_since_last_issue: float | None,
) -> bool:
    return (
        participants >= 3
        and rank > math.ceil(participants / 2)
        and points_after_reward <= 5
        and not has_ticket
        and (minutes_since_last_issue is None or minutes_since_last_issue >= 120)
    )


def ticket_class(model, base):
    class TicketSimulation(base):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.comeback_tickets: dict[str, Any] = {}
            self.last_comeback_ticket_at: dict[str, Any] = {}
            self.comeback_ticket_issued = 0
            self.comeback_ticket_used = 0
            self.comeback_ticket_expired = 0
            self._point_cost_actor: str | None = None

        def _ticket_valid(self, player_name: str) -> bool:
            expires_at = self.comeback_tickets.get(player_name)
            if expires_at is None:
                return False
            if expires_at <= self.now:
                self.comeback_tickets.pop(player_name, None)
                self.comeback_ticket_expired += 1
                return False
            return True

        def _ticket_covers(self, player_name: str, card) -> bool:
            return (
                self._ticket_valid(player_name)
                and card.taker != player_name
                and player_name in card.posted_players
                and card.update_count.get(player_name, 0) == 0
            )

        def _choose_action(self, player):
            self._point_cost_actor = player.name
            try:
                return super()._choose_action(player)
            finally:
                self._point_cost_actor = None

        def _update_post_cost(self, card):
            actor = self._point_cost_actor
            if actor is not None and self._ticket_covers(actor, card):
                return 0
            return super()._update_post_cost(card)

        def _complete_update(
            self,
            player_name,
            card_id,
            duration,
            target_score=None,
            raw_gap=None,
            planned_update_count=None,
        ):
            card = self.cards.get(card_id)
            covered = card is not None and self._ticket_covers(player_name, card)
            before = self.players[player_name].actions.get("update", 0)
            self._point_cost_actor = player_name
            try:
                result = super()._complete_update(
                    player_name, card_id, duration, target_score, raw_gap, planned_update_count,
                )
            finally:
                self._point_cost_actor = None
            after = self.players[player_name].actions.get("update", 0)
            if covered and after > before:
                self.comeback_tickets.pop(player_name, None)
                self.comeback_ticket_used += 1
                self.players[player_name].actions["comeback_ticket_used"] = (
                    self.players[player_name].actions.get("comeback_ticket_used", 0) + 1
                )
            return result

        def _collect_card(self, card_id):
            card = self.cards[card_id]
            ranking = self._ranking_groups(card) if card.state == "_field" else []
            participants = sum(len(group["players"]) for group in ranking)
            ranks = {
                player_name: group["rank"]
                for group in ranking
                for player_name in group["players"]
            }
            result = super()._collect_card(card_id)
            if self.now >= self.end_at or participants < 3:
                return result
            for player_name, rank in ranks.items():
                has_ticket = self._ticket_valid(player_name)
                last_at = self.last_comeback_ticket_at.get(player_name)
                elapsed = None if last_at is None else (self.now - last_at).total_seconds() / 60
                player = self.players[player_name]
                if not comeback_ticket_eligible(rank, participants, player.points, has_ticket, elapsed):
                    continue
                self.comeback_tickets[player_name] = min(
                    self.end_at,
                    self.now + model.timedelta(hours=6),
                )
                self.last_comeback_ticket_at[player_name] = self.now
                self.comeback_ticket_issued += 1
                player.actions["comeback_ticket_issued"] = (
                    player.actions.get("comeback_ticket_issued", 0) + 1
                )
            return result

    return TicketSimulation


def subsidy_15m_class(model, base):
    class Subsidy15Simulation(base):
        def _setup_events(self):
            for player in self.players.values():
                self.queue.push(player.join_at, "join", {"player": player.name})
                for start, _end in player.active_sessions:
                    if start >= player.join_at:
                        self._queue_decision(player.name, start)
            subsidy_slot = self.start_at
            while subsidy_slot <= self.end_at:
                self.queue.push(subsidy_slot, "subsidy")
                subsidy_slot += model.timedelta(minutes=15)
            snapshot_slot = self.start_at
            while snapshot_slot <= self.end_at:
                self.queue.push(snapshot_slot, "half_hour_snapshot")
                snapshot_slot += model.timedelta(minutes=30)
            self.queue.push(
                self.end_at - model.TAKE_CLOSE_BEFORE_END - model.timedelta(microseconds=1),
                "take_close_attempt",
            )
            self.queue.push(self.end_at, "final")

        def _set_subsidy_flag(self, player):
            floored = self.now.replace(
                minute=(self.now.minute // 15) * 15,
                second=0,
                microsecond=0,
            )
            player.subsidy_flag_slot_at = floored + model.timedelta(minutes=15)

    return Subsidy15Simulation


def player_metrics(economy, sim, name: str) -> dict[str, float | int]:
    metrics = economy.player_finance(sim, name)
    player = sim.players[name]
    metrics["tickets_issued"] = player.actions.get("comeback_ticket_issued", 0)
    metrics["tickets_used"] = player.actions.get("comeback_ticket_used", 0)
    return metrics


def run_one(args: tuple[int, str]) -> dict[str, Any]:
    seed, policy = args
    economy = load_economy_study()
    model = economy.load_model()
    base = economy.proposal_class(model, "case_c")
    klass = (
        ticket_class(model, base)
        if policy == "case_c_ticket"
        else subsidy_15m_class(model, base)
        if policy == "case_c_subsidy_15m"
        else base
    )
    sim = klass(
        seed=seed,
        output_dir=Path("/tmp/tricks-comeback-study"),
        write_outputs=False,
        take_cooldown_policy="all_field_first_endgame_free",
        take_cost_mode="level_sqrt",
        post_cost_policy="taker_initial_and_retries_paid",
        reward_formula="balanced",
        remainder_policy="last_poster",
        player_extension_enabled=True,
    )
    summary = sim.run()
    distribution_mismatch = sum(
        bool(card.reward_log)
        and sum(entry["points"] for entry in card.reward_log) != sim._total_reward_points(card)
        for card in sim.cards.values()
    )
    return {
        "seed": seed,
        "policy": policy,
        "players": {name: player_metrics(economy, sim, name) for name in sorted(sim.players)},
        "economy": summary["economy"],
        "collections": summary["collections"],
        "subsidy_payments": summary["subsidy_payments"],
        "ticket_issued": getattr(sim, "comeback_ticket_issued", 0),
        "ticket_used": getattr(sim, "comeback_ticket_used", 0),
        "ticket_expired": getattr(sim, "comeback_ticket_expired", 0),
        "distribution_mismatch": distribution_mismatch,
        "invariant_errors": summary["invariant_errors"],
    }


def average(rows: list[dict[str, Any]], key: str) -> float:
    return statistics.mean(row[key] for row in rows)


def aggregate(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_seed = {(row["seed"], row["policy"]): row for row in rows}
    seeds = sorted({row["seed"] for row in rows})
    cohort_rows = {policy: [] for policy in POLICIES}
    all_rows = {policy: [] for policy in POLICIES}
    for seed in seeds:
        baseline = by_seed[(seed, "case_c")]
        bottom = sorted(
            baseline["players"],
            key=lambda name: (baseline["players"][name]["rank_points"], name),
        )[:4]
        for policy in POLICIES:
            row = by_seed[(seed, policy)]
            cohort_rows[policy].extend(row["players"][name] for name in bottom)
            all_rows[policy].extend(row["players"].values())
    result = {}
    metric_keys = (
        "ending_points", "rank_points", "rewards", "post_fees", "draws", "takes",
        "initial_posts", "updates", "mean_active_points", "tickets_issued", "tickets_used",
    )
    for policy in POLICIES:
        selected = [row for row in rows if row["policy"] == policy]
        cohort = cohort_rows[policy]
        everyone = all_rows[policy]
        result[policy] = {
            "runs": len(selected),
            "bottom_cohort": {key: average(cohort, key) for key in metric_keys},
            "bottom_zero_active_rate": sum(r["zero_active_snapshots"] for r in cohort) / max(1, sum(r["active_snapshots"] for r in cohort)),
            "bottom_under_two_active_rate": sum(r["under_two_active_snapshots"] for r in cohort) / max(1, sum(r["active_snapshots"] for r in cohort)),
            "all_players": {key: average(everyone, key) for key in metric_keys},
            "event": {
                "collections": average(selected, "collections"),
                "subsidy_payments": average(selected, "subsidy_payments"),
                "collection_rewards": statistics.mean(r["economy"]["collection_rewards"] for r in selected),
                "post_fees": statistics.mean(r["economy"]["post_fees"] for r in selected),
                "ending_points": statistics.mean(r["economy"]["ending_points"] for r in selected),
                "ticket_issued": average(selected, "ticket_issued"),
                "ticket_used": average(selected, "ticket_used"),
                "ticket_expired": average(selected, "ticket_expired"),
            },
            "invariant_error_runs": sum(bool(r["invariant_errors"]) for r in selected),
            "distribution_mismatch_runs": sum(bool(r["distribution_mismatch"]) for r in selected),
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=100)
    parser.add_argument("--seed", type=int, default=282000)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--output", type=Path, default=HERE / "tricks-comeback-results.json")
    args = parser.parse_args()
    assert comeback_ticket_eligible(4, 6, 5, False, None)
    assert not comeback_ticket_eligible(3, 6, 5, False, None)
    assert not comeback_ticket_eligible(4, 6, 6, False, None)
    assert not comeback_ticket_eligible(4, 6, 5, True, None)
    assert not comeback_ticket_eligible(4, 6, 5, False, 119.99)
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
