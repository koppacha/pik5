"""Paired comparison of the current and proposed Tricks point economy."""
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
SOURCE = Path(__file__).resolve().parents[6] / "lab/tricks_rule_simulation.py"


def load_model():
    name = "tricks_point_redistribution_model"
    spec = importlib.util.spec_from_file_location(name, SOURCE)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def minimum_distribution(participants: int) -> list[int]:
    if participants <= 0:
        return []
    if participants == 1:
        return [4]
    if participants == 2:
        return [3, 2]
    if participants == 3:
        return [4, 2, 0]
    if participants == 4:
        return [4, 2, 1, 0]
    return [3, 2, 2, *([1] * (participants - 4)), 0]


def proposed_rank_distribution(total: int, participants: int) -> list[int]:
    """Return position rewards. Ties are outside this positional rule."""
    if total <= 0 or participants <= 0:
        return [0] * max(0, participants)
    if participants == 1:
        return [total]
    rewards = minimum_distribution(participants)
    while sum(rewards) > total:
        reduced = False
        lowest_reducible = participants - 1 if participants == 2 else participants - 2
        for index in range(lowest_reducible, -1, -1):
            if rewards[index] > 0:
                rewards[index] -= 1
                reduced = True
                break
        if not reduced:
            break
    while sum(rewards) < total:
        target = None
        for index in range(1, participants - 1):
            required_gap = 2 if index == 1 else 1
            if rewards[index - 1] - rewards[index] > required_gap:
                target = index
                break
        rewards[0 if target is None else target] += 1
    return rewards


def position_distribution(ranking: list[dict[str, Any]], total: int) -> dict[str, int]:
    players = [name for group in ranking for name in sorted(group["players"])]
    rewards = proposed_rank_distribution(total, len(players))
    # The score model almost surely produces no exact ties. If one occurs, pool the
    # occupied positional awards and split them deterministically inside the tie.
    result: dict[str, int] = {}
    cursor = 0
    for group in ranking:
        names = sorted(group["players"])
        pool = sum(rewards[cursor:cursor + len(names)])
        share, extra = divmod(pool, len(names))
        for index, name in enumerate(names):
            result[name] = share + int(index < extra)
        cursor += len(names)
    return result


def case_d_post_cost(
    difficulty: int,
    candidate_score: float,
    existing_scores: dict[str, float],
    updating_player: str | None = None,
) -> int:
    competing = {
        name: score
        for name, score in existing_scores.items()
        if name != updating_player
    }
    participants = len(competing) + 1
    if participants == 1:
        return 0
    rank = 1 + sum(score > candidate_score for score in competing.values())
    return max(1, difficulty) if rank <= participants // 2 else 0


def proposal_class(model, policy: str):
    class ProposalSimulation(model.Simulation):
        def _initial_post_cost(self, card, player=None):
            difficulty = max(1, card.difficulty or 1)
            if policy == "case_b":
                return difficulty if player is not None and player.name == card.taker else 1
            if policy == "case_c":
                return difficulty if player is not None and player.name == card.taker else 0
            return 0

        def _update_post_cost(self, card):
            return 0 if policy == "case_d" else max(1, card.difficulty or 1)

        def _paid_post_is_acceptable(self, player, card, expected_point_net):
            return player.points >= self._initial_post_cost(card, player)

        def _total_reward_points(self, card):
            if not card.posted_players:
                return 0
            return max(0, card.stack_count + card.paid_points_total)

        def _field_reward_potential(self, card_id):
            card = self.cards[card_id]
            return max(0, card.stack_count + card.paid_points_total)

        def _expected_initial_post_point_net(self, player, card, duration):
            participants = self._forecast_field_participants(card, player.name)
            rank = self._forecast_rank_after_future_posts(player, card, duration, participants)
            if policy == "case_d":
                cost = (
                    max(1, card.difficulty or 1)
                    if participants >= 2 and rank <= participants // 2
                    else 0
                )
            else:
                cost = self._initial_post_cost(card, player)
            total = card.stack_count + card.paid_points_total + cost
            rewards = proposed_rank_distribution(total, participants)
            return (rewards[rank - 1] if 0 < rank <= len(rewards) else 0) - cost

        @staticmethod
        def _case_d_cost(card, candidate_score, updating_player=None):
            return case_d_post_cost(
                card.difficulty or 1,
                candidate_score,
                card.scores,
                updating_player,
            )

        def _complete_initial_post(self, player_name, card_id, duration):
            if policy != "case_d":
                return super()._complete_initial_post(player_name, card_id, duration)
            player = self.players[player_name]
            player.busy_until = None
            pending = self.pending_initial_posts.get(card_id, set())
            pending.discard(player_name)
            if not pending:
                self.pending_initial_posts.pop(card_id, None)
            if card_id not in self.field:
                self._record("wait", player_name, {"reason": "initial_post_target_not_field", "card_id": card_id})
                self._recover_from_stale_action(player)
                return
            card = self.cards[card_id]
            existing_participants = len(card.posted_players)
            outcome = self._run_score_trial(player, card, duration)
            if self._should_withhold_initial_score(player, card, outcome):
                player.actions["initial_score_withheld"] = player.actions.get("initial_score_withheld", 0) + 1
                self._record("score_trial_withheld", player.name, {
                    "card_id": card_id,
                    "duration": duration,
                    "candidate_score": round(outcome["candidate_score"], 6),
                    "expected_score": round(outcome["expected_score"], 6),
                    "reason": "abnormally_low_initial_score",
                })
                self._schedule_next_decision(player, 0)
                return
            cost = self._case_d_cost(card, outcome["candidate_score"])
            if player.points < cost:
                player.actions["post_withheld_unaffordable_rank"] = (
                    player.actions.get("post_withheld_unaffordable_rank", 0) + 1
                )
                self._record("wait", player_name, {
                    "reason": "post_withheld_unaffordable_rank",
                    "card_id": card_id,
                    "cost": cost,
                })
                self._schedule_next_decision(player, 0)
                return
            player.points -= cost
            card.paid_players.add(player.name)
            card.paid_points_total += cost
            card.paid_points_by_player[player.name] = card.paid_points_by_player.get(player.name, 0) + cost
            score_result = self._submit_score_trial(player, card, duration, outcome, is_update=False)
            self._refresh_attachment(player, card, outcome)
            cooldown_credit = self._apply_post_cooldown_credit(player)
            extension_minutes = 0
            if card.limit_at is None:
                card.limit_at = (card.taken_at or self.now) + model.timedelta(
                    minutes=model.initial_countdown_minutes(card.difficulty)
                )
                self.queue.push(card.limit_at, "collect", {"card_id": card.id, "limit_at": card.limit_at.isoformat()})
            else:
                participant_order = existing_participants + 1
                remaining_minutes = (card.limit_at - self.now).total_seconds() / 60
                if participant_order == 1 and remaining_minutes < model.LATE_FIRST_POST_THRESHOLD_MINUTES:
                    card.late_first_extension = True
                extension_minutes = model.initial_post_extension_minutes(participant_order, remaining_minutes)
                card.limit_at += model.timedelta(minutes=extension_minutes)
                self.queue.push(card.limit_at, "collect", {"card_id": card.id, "limit_at": card.limit_at.isoformat()})
            self._extend_activity_for_card(card)
            player.actions["initial_post"] = player.actions.get("initial_post", 0) + 1
            self._record("initial_post", player.name, {
                "card_id": card_id,
                "duration": duration,
                "paid_now": cost > 0,
                "cost": cost,
                "score": card.scores[player.name],
                "candidate_score": round(outcome["candidate_score"], 6),
                "score_improved": score_result["improved"],
                "participant_order": existing_participants + 1,
                "extension_minutes": extension_minutes,
                "attempt_count": card.attempt_count[player.name],
                "cooldown_credit_minutes": cooldown_credit,
                "limit_at": self._iso(card.limit_at),
            })
            self._schedule_next_decision(player, 0)

        def _complete_update(
            self,
            player_name,
            card_id,
            duration,
            target_score=None,
            raw_gap=None,
            planned_update_count=None,
        ):
            if policy != "case_d":
                return super()._complete_update(
                    player_name, card_id, duration, target_score, raw_gap, planned_update_count,
                )
            player = self.players[player_name]
            player.busy_until = None
            if card_id not in self.field:
                self._record("wait", player_name, {"reason": "update_target_not_field", "card_id": card_id})
                self._recover_from_stale_action(player)
                return
            card = self.cards[card_id]
            previous_update_duration = card.last_update_duration.get(player.name, 0)
            outcome = self._run_score_trial(player, card, duration)
            previous_score = card.scores.get(player.name, float("-inf"))
            if self.score_policy == "stochastic_card_skill" and outcome["candidate_score"] <= previous_score:
                player.actions["update_score_withheld"] = player.actions.get("update_score_withheld", 0) + 1
                self._record("score_trial_withheld", player.name, {
                    "card_id": card_id,
                    "duration": duration,
                    "candidate_score": round(outcome["candidate_score"], 6),
                    "expected_score": round(outcome["expected_score"], 6),
                    "reason": "update_did_not_improve",
                })
                self._refresh_attachment(player, card, outcome)
                self._schedule_next_decision(player, 0)
                return
            update_cost = self._case_d_cost(card, outcome["candidate_score"], player.name)
            if player.points < update_cost:
                player.actions["update_withheld_unaffordable_rank"] = (
                    player.actions.get("update_withheld_unaffordable_rank", 0) + 1
                )
                self._record("wait", player_name, {
                    "reason": "update_withheld_unaffordable_rank",
                    "card_id": card_id,
                    "cost": update_cost,
                })
                self._schedule_next_decision(player, 0)
                return
            player.points -= update_cost
            card.paid_points_total += update_cost
            card.paid_points_by_player[player.name] = card.paid_points_by_player.get(player.name, 0) + update_cost
            score_result = self._submit_score_trial(player, card, duration, outcome, is_update=True)
            self._refresh_attachment(player, card, outcome)
            player.actions["update"] = player.actions.get("update", 0) + 1
            self._record("update", player.name, {
                "card_id": card_id,
                "duration": duration,
                "score": card.scores[player.name],
                "candidate_score": round(outcome["candidate_score"], 6),
                "score_improved": score_result["improved"],
                "cost": update_cost,
                "attempt_count": card.attempt_count[player.name],
                "update_count": card.update_count[player.name],
                "previous_update_duration": previous_update_duration,
                "target_score": target_score,
                "raw_gap_minutes": raw_gap,
                "planned_update_count": planned_update_count,
            })
            self._schedule_next_decision(player, 0)

        def _apply_collection_rewards(self, card, ranking):
            if not ranking:
                return {"total_reward": 0, "rank_distribution": {}, "taker_remainder": 0}
            total = self._total_reward_points(card)
            distribution = position_distribution(ranking, total)
            for player_name, amount in distribution.items():
                self.players[player_name].points += amount
                card.reward_log.append({
                    "player": player_name,
                    "points": amount,
                    "type": "proposed_rank_distribution",
                })
            return {
                "total_reward": total,
                "rank_distribution": distribution,
                "taker_remainder": 0,
                "remainder_distribution": {},
                "eligible_groups": [group["players"][:] for group in ranking],
            }

    return ProposalSimulation


def player_finance(sim, name: str) -> dict[str, float | int]:
    player = sim.players[name]
    rewards = sum(
        entry["points"]
        for card in sim.cards.values()
        for entry in card.reward_log
        if entry["player"] == name
    )
    post_fees = sum(card.paid_points_by_player.get(name, 0) for card in sim.cards.values())
    active_snapshots = 0
    zero_active_snapshots = 0
    under_two_active_snapshots = 0
    point_samples: list[int] = []
    for snapshot in sim.half_hour_snapshots:
        at = sim.start_at + model_timedelta(minutes=snapshot["minute"])
        if player.is_active(at):
            points = snapshot["players"][name]["points"]
            active_snapshots += 1
            zero_active_snapshots += int(points <= 0)
            under_two_active_snapshots += int(points < 2)
            point_samples.append(points)
    return {
        "ending_points": player.points,
        "rank_points": player.rank_points,
        "rewards": rewards,
        "post_fees": post_fees,
        "draws": player.actions.get("draw", 0),
        "takes": player.actions.get("take", 0),
        "initial_posts": player.actions.get("initial_post", 0),
        "updates": player.actions.get("update", 0),
        "active_snapshots": active_snapshots,
        "zero_active_snapshots": zero_active_snapshots,
        "under_two_active_snapshots": under_two_active_snapshots,
        "mean_active_points": statistics.mean(point_samples) if point_samples else 0.0,
    }


def model_timedelta(**kwargs):
    from datetime import timedelta
    return timedelta(**kwargs)


def run_one(args: tuple[int, str]) -> dict[str, Any]:
    seed, policy = args
    model = load_model()
    klass = model.Simulation if policy == "case_a" else proposal_class(model, policy)
    sim = klass(
        seed=seed,
        output_dir=Path("/tmp/tricks-point-redistribution"),
        write_outputs=False,
        take_cooldown_policy="all_field_first_endgame_free",
        take_cost_mode="level_sqrt",
        post_cost_policy="taker_initial_and_retries_paid",
        reward_formula="balanced",
        remainder_policy="last_poster",
        player_extension_enabled=True,
    )
    summary = sim.run()
    below_claimed_floor = 0
    distribution_mismatch = 0
    for card in sim.cards.values():
        count = len(card.posted_players)
        if count and card.stack_count + card.paid_points_total < count + 3:
            below_claimed_floor += 1
        if card.reward_log and sum(entry["points"] for entry in card.reward_log) != sim._total_reward_points(card):
            distribution_mismatch += 1
    return {
        "seed": seed,
        "policy": policy,
        "players": {name: player_finance(sim, name) for name in sorted(sim.players)},
        "economy": summary["economy"],
        "collections": summary["collections"],
        "subsidy_payments": summary["subsidy_payments"],
        "below_claimed_floor": below_claimed_floor,
        "distribution_mismatch": distribution_mismatch,
        "invariant_errors": summary["invariant_errors"],
    }


def mean(rows: list[dict[str, Any]], key: str) -> float:
    return statistics.mean(row[key] for row in rows)


def aggregate(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_seed = {(row["seed"], row["policy"]): row for row in rows}
    seeds = sorted({row["seed"] for row in rows})
    result: dict[str, Any] = {}
    policies = ("case_a", "case_b", "case_c", "case_d")
    cohort_rows: dict[str, list[dict[str, Any]]] = {policy: [] for policy in policies}
    all_rows: dict[str, list[dict[str, Any]]] = {policy: [] for policy in policies}
    for seed in seeds:
        current = by_seed[(seed, "case_a")]
        bottom = sorted(
            current["players"],
            key=lambda name: (current["players"][name]["rank_points"], name),
        )[:4]
        for policy in policies:
            row = by_seed[(seed, policy)]
            cohort_rows[policy].extend(row["players"][name] for name in bottom)
            all_rows[policy].extend(row["players"].values())
    for policy in policies:
        selected = [row for row in rows if row["policy"] == policy]
        cohort = cohort_rows[policy]
        everyone = all_rows[policy]
        result[policy] = {
            "runs": len(selected),
            "bottom_cohort": {
                key: mean(cohort, key)
                for key in ("ending_points", "rank_points", "rewards", "post_fees", "draws", "takes", "initial_posts", "updates", "mean_active_points")
            },
            "bottom_zero_active_rate": sum(r["zero_active_snapshots"] for r in cohort) / max(1, sum(r["active_snapshots"] for r in cohort)),
            "bottom_under_two_active_rate": sum(r["under_two_active_snapshots"] for r in cohort) / max(1, sum(r["active_snapshots"] for r in cohort)),
            "all_players": {
                key: mean(everyone, key)
                for key in ("ending_points", "rank_points", "rewards", "post_fees", "draws", "takes", "initial_posts", "updates", "mean_active_points")
            },
            "event": {
                "collections": mean(selected, "collections"),
                "subsidy_payments": mean(selected, "subsidy_payments"),
                "collection_rewards": statistics.mean(r["economy"]["collection_rewards"] for r in selected),
                "post_fees": statistics.mean(r["economy"]["post_fees"] for r in selected),
                "ending_points": statistics.mean(r["economy"]["ending_points"] for r in selected),
                "below_claimed_floor": mean(selected, "below_claimed_floor"),
            },
            "invariant_error_runs": sum(bool(r["invariant_errors"]) for r in selected),
            "distribution_mismatch_runs": sum(bool(r["distribution_mismatch"]) for r in selected),
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=100)
    parser.add_argument("--seed", type=int, default=281000)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--output", type=Path, default=HERE / "tricks-point-redistribution-results.json")
    args = parser.parse_args()
    fixed = {
        "minimum": {str(n): minimum_distribution(n) for n in range(1, 11)},
        "four_player": {str(total): proposed_rank_distribution(total, 4) for total in range(7, 21)},
    }
    assert fixed["four_player"]["7"] == [4, 2, 1, 0]
    assert fixed["four_player"]["8"] == [5, 2, 1, 0]
    assert fixed["four_player"]["9"] == [5, 3, 1, 0]
    assert fixed["four_player"]["10"] == [5, 3, 2, 0]
    assert fixed["four_player"]["11"] == [6, 3, 2, 0]
    assert fixed["four_player"]["12"] == [6, 4, 2, 0]
    assert fixed["four_player"]["13"] == [6, 4, 3, 0]
    assert case_d_post_cost(5, 100, {}) == 0
    assert case_d_post_cost(5, 90, {"a": 100, "b": 80, "c": 70}) == 5
    assert case_d_post_cost(5, 75, {"a": 100, "b": 90, "c": 70}) == 0
    assert case_d_post_cost(4, 95, {"self": 80, "a": 100, "b": 90, "c": 70}, "self") == 4
    policies = ("case_a", "case_b", "case_c", "case_d")
    tasks = [(seed, policy) for seed in range(args.seed, args.seed + args.runs) for policy in policies]
    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        rows = list(executor.map(run_one, tasks))
    payload = {
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "seeds": [args.seed, args.seed + args.runs - 1],
        "runs_per_policy": args.runs,
        "fixed": fixed,
        "aggregate": aggregate(rows),
        "rows": rows,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(payload["aggregate"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
