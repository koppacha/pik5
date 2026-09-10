"""Aggregate k=2 collection rewards by the difficulty of the field card."""
import hashlib
import importlib.util
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path


SOURCE = Path(__file__).resolve().parents[6] / "lab/tricks_rule_simulation.py"


def load_model():
    spec = importlib.util.spec_from_file_location("tricks_level_reward_model", SOURCE)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def run(seed):
    model = load_model()
    sim = model.Simulation(
        seed=seed,
        output_dir=Path("/tmp/tricks-level-reward"),
        write_outputs=False,
        take_cooldown_policy="all_field_first_endgame_free",
        take_cost_mode="level_linear",
        take_level_up_every=2,
    )
    summary = sim.run()
    by_difficulty = {
        difficulty: {
            "cards": 0, "reward_points": 0, "reward_entries": 0,
            "stack_total": 0, "participant_total": 0, "payment_total": 0,
            "base_total": 0, "base_with_posters": 0, "unposted_base": 0,
            "single_poster_cards": 0, "multi_poster_cards": 0, "unposted_cards": 0,
            "multi_poster_bonus": 0,
        }
        for difficulty in range(1, 6)
    }
    for card in sim.cards.values():
        if card.state != "_collected" or card.taken_at is None:
            continue
        difficulty = card.difficulty or 1
        bucket = by_difficulty[difficulty]
        bucket["cards"] += 1
        bucket["reward_points"] += sum(entry["points"] for entry in card.reward_log)
        bucket["reward_entries"] += len(card.reward_log)
        bucket["stack_total"] += card.stack_count
        bucket["participant_total"] += len(card.posted_players)
        bucket["payment_total"] += card.paid_points_total
        base = card.stack_count + card.paid_points_total
        bucket["base_total"] += base
        if len(card.posted_players) == 0:
            bucket["unposted_cards"] += 1
            bucket["unposted_base"] += base
        elif len(card.posted_players) == 1:
            bucket["single_poster_cards"] += 1
            bucket["base_with_posters"] += base
        else:
            bucket["multi_poster_cards"] += 1
            bucket["base_with_posters"] += base
            bucket["multi_poster_bonus"] += difficulty * (base // 5)
    return {
        "seed": seed,
        "by_difficulty": by_difficulty,
        "economy_collection_rewards": summary["economy"]["collection_rewards"],
        "invariant_errors": summary["invariant_errors"],
    }


if __name__ == "__main__":
    seeds = range(278000, 278100)
    with ProcessPoolExecutor(max_workers=4) as executor:
        rows = list(executor.map(run, seeds))
    aggregate = {
        difficulty: {
            "cards": 0, "reward_points": 0, "reward_entries": 0,
            "stack_total": 0, "participant_total": 0, "payment_total": 0,
            "base_total": 0, "base_with_posters": 0, "unposted_base": 0,
            "single_poster_cards": 0, "multi_poster_cards": 0, "unposted_cards": 0,
            "multi_poster_bonus": 0,
        }
        for difficulty in range(1, 6)
    }
    for row in rows:
        for difficulty, bucket in row["by_difficulty"].items():
            for key, value in bucket.items():
                aggregate[int(difficulty)][key] += value
    for bucket in aggregate.values():
        bucket["average_points_per_card"] = bucket["reward_points"] / bucket["cards"] if bucket["cards"] else 0
        bucket["average_stack_per_card"] = bucket["stack_total"] / bucket["cards"] if bucket["cards"] else 0
        bucket["average_participants_per_card"] = bucket["participant_total"] / bucket["cards"] if bucket["cards"] else 0
        bucket["average_payment_per_card"] = bucket["payment_total"] / bucket["cards"] if bucket["cards"] else 0
        bucket["average_base_per_card"] = bucket["base_total"] / bucket["cards"] if bucket["cards"] else 0
        bucket["average_bonus_per_card"] = bucket["multi_poster_bonus"] / bucket["cards"] if bucket["cards"] else 0
    total_rewards = sum(bucket["reward_points"] for bucket in aggregate.values())
    economy_rewards = sum(row["economy_collection_rewards"] for row in rows)
    print(json.dumps({
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "seeds": [min(seeds), max(seeds)],
        "runs": len(rows),
        "take_cost": "L = 1 + floor(T / 2), M = L + 2",
        "aggregate": aggregate,
        "total_reward_points": total_rewards,
        "economy_reward_points_match": total_rewards == economy_rewards,
        "invariant_error_runs": sum(bool(row["invariant_errors"]) for row in rows),
        "rows": rows,
    }, ensure_ascii=False, indent=2))
