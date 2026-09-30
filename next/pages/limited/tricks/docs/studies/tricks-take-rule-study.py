#!/usr/bin/env python3
"""現行条件とテイクに関する3案を、同一seedで個別・併用比較する。"""

from __future__ import annotations

import argparse
import importlib.util
import json
import statistics
import sys
from pathlib import Path


SIMULATOR_PATH = Path(__file__).resolve().parents[6] / "lab/tricks_rule_simulation.py"
BONUS_BY_RARITY = {1: 0, 2: 1, 3: 4, 4: 7, 5: 15}
NEW_RARITY_WEIGHTS = [(1, 87.0), (2, 8.0), (3, 4.0), (4, 0.9), (5, 0.1)]


def load_simulator():
    spec = importlib.util.spec_from_file_location("tricks_rule_simulation", SIMULATOR_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load simulator: {SIMULATOR_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def bonus_for(card) -> int:
    rarity = card.rarity or 1
    return card.stack_count // 3 + BONUS_BY_RARITY[rarity] if rarity >= 2 else 0


def make_simulation_type(simulator):
    class StudySimulation(simulator.Simulation):
        def __init__(self, *args, rarity_bonus=False, **kwargs):
            super().__init__(*args, **kwargs)
            self.rarity_bonus = rarity_bonus
            self.last_field_observation_at = self.start_at
            self.last_dynamic_full = False
            self.last_absolute_full = False
            self.dynamic_full_seconds = 0.0
            self.absolute_full_seconds = 0.0
            self.max_field_count = 0

        def _record(self, event_type, actor, details):
            elapsed = (self.now - self.last_field_observation_at).total_seconds()
            if elapsed < 0:
                raise RuntimeError("field observation time went backwards")
            if self.last_dynamic_full:
                self.dynamic_full_seconds += elapsed
            if self.last_absolute_full:
                self.absolute_full_seconds += elapsed
            self.last_field_observation_at = self.now
            field_count = len(self.field)
            self.max_field_count = max(self.max_field_count, field_count)
            self.last_dynamic_full = field_count > 0 and field_count == self._field_cap()
            self.last_absolute_full = field_count == simulator.FIELD_LIMIT
            return super()._record(event_type, actor, details)

        def _with_bonus(self, card, operation):
            if not self.rarity_bonus:
                return operation()
            # 実際のカード枚数と必要手札を維持し、ポイント計算中のみ原資へ加算する。
            bonus = bonus_for(card)
            card.stack_count += bonus
            try:
                return operation()
            finally:
                card.stack_count -= bonus

        def _total_reward_points(self, card):
            return self._with_bonus(card, lambda: super(StudySimulation, self)._total_reward_points(card))

        def _field_reward_potential(self, card_id):
            card = self.cards[card_id]
            return self._with_bonus(card, lambda: super(StudySimulation, self)._field_reward_potential(card_id))

        def _expected_initial_post_point_net(self, player, card, duration):
            return self._with_bonus(
                card,
                lambda: super(StudySimulation, self)._expected_initial_post_point_net(player, card, duration),
            )

    return StudySimulation


def metrics(simulation, summary):
    players = summary["players"]
    taken = [card for card in simulation.cards.values() if card.taker is not None]
    event_seconds = (simulation.end_at - simulation.start_at).total_seconds()
    if simulation.last_field_observation_at < simulation.end_at:
        raise RuntimeError("final field observation did not reach event end")
    depletion = summary["deck_trash_depletion"]
    return {
        "takes": sum(player["take_count"] for player in players),
        "collections": summary["collections"],
        "initial_posts": sum(player["actions"].get("initial_post", 0) for player in players),
        "draws": sum(player["draw_count"] for player in players),
        "rank_points": sum(player["rank_points"] for player in players),
        "ending_points": summary["economy"]["ending_points"],
        "collection_rewards": summary["economy"]["collection_rewards"],
        "subsidy_payments": summary["subsidy_payments"],
        "max_takes_by_player": summary["cooldown"]["max_takes_by_player"],
        "max_take_share": summary["cooldown"]["max_take_share"],
        "cooldown_releases": summary["cooldown"]["release_count"],
        "endgame_free_takes": summary["cooldown"]["endgame_free_takes"],
        "depleted_minutes": depletion["duration_minutes"],
        "depleted_any": int(depletion["interval_count"] > 0),
        "depletion_time_pct": round(depletion["duration_minutes"] * 60 / event_seconds * 100, 6),
        "depletion_blocked_draws": depletion["blocked_draws_with_points"],
        "max_field_count": simulation.max_field_count,
        "dynamic_full_minutes": round(simulation.dynamic_full_seconds / 60, 4),
        "dynamic_full_time_pct": round(simulation.dynamic_full_seconds / event_seconds * 100, 6),
        "absolute_full_minutes": round(simulation.absolute_full_seconds / 60, 4),
        "absolute_full_time_pct": round(simulation.absolute_full_seconds / event_seconds * 100, 6),
        "rarity_bonus_total": sum(bonus_for(card) for card in taken) if simulation.rarity_bonus else 0,
        "rare_taken": sum((card.rarity or 1) >= 2 for card in taken),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-seed", type=int, default=312000)
    parser.add_argument("--runs", type=int, default=100)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.runs < 1:
        parser.error("--runs must be positive")

    simulator = load_simulator()
    simulation_type = make_simulation_type(simulator)
    scenarios = {
        "current": (90, "all_field_first_endgame_free", False),
        "cooldown_60": (60, "all_field_first_endgame_free", False),
        "no_all_field_first": (90, "endgame_free", False),
        "rarity_bonus": (90, "all_field_first_endgame_free", True),
        "combined": (60, "endgame_free", True),
    }
    rows = {name: [] for name in scenarios}
    original_cooldown = simulator.TAKE_COOLDOWN
    original_weights = simulator.RARITY_DISTRIBUTION
    original_initial_rate = simulator.RARITY_INITIAL_RATE
    try:
        for seed in range(args.start_seed, args.start_seed + args.runs):
            for name, (minutes, policy, use_bonus) in scenarios.items():
                simulator.TAKE_COOLDOWN = simulator.timedelta(minutes=minutes)
                simulator.RARITY_DISTRIBUTION = NEW_RARITY_WEIGHTS if use_bonus else original_weights
                simulator.RARITY_INITIAL_RATE = 13.0 if use_bonus else original_initial_rate
                simulation = simulation_type(
                    seed=seed,
                    output_dir=Path("/tmp"),
                    write_outputs=False,
                    take_cooldown_policy=policy,
                    rarity_bonus=use_bonus,
                )
                summary = simulation.run()
                if summary["invariant_errors"]:
                    raise RuntimeError(f"seed={seed} scenario={name}: {summary['invariant_errors'][:3]}")
                rows[name].append(metrics(simulation, summary))
    finally:
        simulator.TAKE_COOLDOWN = original_cooldown
        simulator.RARITY_DISTRIBUTION = original_weights
        simulator.RARITY_INITIAL_RATE = original_initial_rate

    means = {
        name: {key: round(statistics.mean(row[key] for row in values), 3) for key in values[0]}
        for name, values in rows.items()
    }
    deltas = {
        name: {key: round(value - means["current"][key], 3) for key, value in result.items()}
        for name, result in means.items() if name != "current"
    }
    report = {
        "start_seed": args.start_seed,
        "runs_per_scenario": args.runs,
        "participants": simulator.PLAYER_COUNT,
        "event_hours": simulator.EVENT_HOURS,
        "depletion_definition": "both deck and trash are empty; time denominator is the entire 48-hour event",
        "field_full_definition": "dynamic cap is min(max(1, cumulative participants - 1), 16); absolute cap is 16; time denominator is the entire 48-hour event",
        "rarity_bonus": "rarity 1: 0; rarity 2-5: floor(physical stack cards / 3) + tier constant",
        "rarity_tier_constants": BONUS_BY_RARITY,
        "new_rarity_initial_weights_percent": dict(NEW_RARITY_WEIGHTS),
        "rarity_growth_note": "13% initial rare rate grows exponentially to 100% at hour 46, preserving rare-tier ratios",
        "means": means,
        "delta_from_current": deltas,
        "invariant_errors": 0,
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
