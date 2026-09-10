"""Paired reward-policy study; no production rule changes. Run with --help."""
import argparse
import hashlib
import importlib.util
import json
import math
import statistics
import sys
from concurrent.futures import ProcessPoolExecutor
from fractions import Fraction
from pathlib import Path
from types import SimpleNamespace

SOURCE = Path(__file__).resolve().parents[6] / "lab/tricks_rule_simulation.py"
spec = importlib.util.spec_from_file_location("reward_suppression_model", SOURCE)
model = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = model
spec.loader.exec_module(model)

POLICIES = {
    "current": (0, "1", False),
    "a0_b075": (0, "0.75", False),
    "a2_b1": (2, "1", False),
    "a1_b075": (1, "0.75", False),
    "a2_b075": (2, "0.75", False),
    "a3_b075": (3, "0.75", False),
    "a2_b05": (2, "0.5", False),
    "a2_b075_keep_single": (2, "0.75", True),
}


def half_up(value):
    assert value >= 0
    return (2 * value.numerator + value.denominator) // (2 * value.denominator)


def budget(card, policy, multi):
    a, b, keep_single = POLICIES[policy]
    raw = card.stack_count + card.paid_points_total
    if not multi and keep_single:
        return raw
    base = card.stack_count - a + half_up(card.paid_points_total * Fraction(b))
    assert base >= 0
    return base + ((card.difficulty or 1) * (raw // 5) if multi else 0)


class Exposure:
    """Integrates immutable PREVIOUS state; zero-time intermediate states vanish."""
    def __init__(self):
        self.hourly = [{"field_seconds": 0, "point_seconds": 0,
                        "empty_seconds": 0, "cap_seconds": 0,
                        "shortage_seconds": 0} for _ in range(48)]
        self.shortages = []
        self.last_was_short = False
        self.peak_locked = 0
        self.minimum_available = 200

    def add(self, start, end, state):
        if end <= start:
            return
        short = state["available"] == 0
        self.peak_locked = max(self.peak_locked, state["locked"])
        self.minimum_available = min(self.minimum_available, state["available"])
        if short:
            if not self.last_was_short:
                self.shortages.append({"start_hour": start / 3600, "minutes": 0,
                                       "locked": state["locked"], "retired": state["retired"]})
            self.shortages[-1]["minutes"] += (end - start) / 60
        self.last_was_short = short
        while start < end:
            hour = min(47, int(start // 3600))
            stop = min(end, (hour + 1) * 3600)
            elapsed = stop - start
            row = self.hourly[hour]
            row["field_seconds"] += elapsed * state["field"]
            row["point_seconds"] += elapsed * state["points"]
            row["empty_seconds"] += elapsed * (state["field"] == 0)
            row["cap_seconds"] += elapsed * (state["joined"] >= 2 and state["field"] >= state["joined"] - 1)
            row["shortage_seconds"] += elapsed * short
            start = stop


class Study(model.Simulation):
    def __init__(self, seed, policy):
        self.policy = policy
        self.exposure = Exposure()
        self.previous = None
        self.previous_second = 0
        self.reward_hourly = [0] * 48
        self.card_rows = []
        super().__init__(seed=seed, output_dir=Path("/tmp/tricks-reward-suppression"),
                         write_outputs=False, take_cost_mode="level_linear",
                         take_level_up_every=2,
                         take_cooldown_policy="all_field_first_endgame_free")
        self.previous = self.state()

    def state(self):
        locked = sum(len(p.hand) for p in self.players.values()) + sum(self.cards[c].stack_count for c in self.field)
        ids = self.deck + self.trash + self.collected + self.field
        ids += [c for p in self.players.values() for c in p.hand]
        ids += [c for f in self.field for c in self.cards[f].stack_ids]
        assert len(ids) == len(set(ids)) == 200
        assert len(self.deck) + len(self.trash) + len(self.collected) + locked == 200
        return {"field": len(self.field), "points": sum(p.points for p in self.players.values()),
                "joined": self.participant_count(), "locked": locked,
                "available": len(self.deck) + len(self.trash), "retired": len(self.collected)}

    def _total_reward_points(self, card):
        return budget(card, self.policy, len(card.posted_players) != 1)

    def _field_reward_potential(self, card_id):
        return budget(self.cards[card_id], self.policy, True)

    def _apply_collection_rewards(self, card, ranking):
        count = sum(len(g["players"]) for g in ranking)
        if count == 1:
            only = ranking[0]["players"][0]
            amount = budget(card, self.policy, False)
            self.players[only].points += amount
            card.reward_log.append({"player": only, "points": amount, "type": "single_poster"})
            result = {"total_reward": amount, "rank_distribution": {only: amount}, "taker_remainder": 0}
        else:
            result = super()._apply_collection_rewards(card, ranking)
        expected = budget(card, self.policy, count >= 2) if count else 0
        assert result["total_reward"] == expected
        assert sum(result["rank_distribution"].values()) + result["taker_remainder"] == expected
        assert sum(e["points"] for e in card.reward_log) == expected
        hour = min(47, int((self.now - self.start_at).total_seconds() // 3600))
        self.reward_hourly[hour] += expected
        self.card_rows.append({"difficulty": card.difficulty or 1, "reward": expected,
                               "stack": card.stack_count, "paid": card.paid_points_total,
                               "participants": count})
        return result

    def _record(self, event_type, actor, details):
        second = (self.now - self.start_at).total_seconds()
        if self.previous is not None:
            self.exposure.add(self.previous_second, second, self.previous)
        self.previous_second = second
        self.previous = self.state()
        super()._record(event_type, actor, details)


def run_one(job):
    policy, seed = job
    sim = Study(seed, policy)
    summary = sim.run()
    economy = summary["economy"]
    assert not summary["invariant_errors"]
    assert economy["collection_rewards"] == sum(c["reward"] for c in sim.card_rows)
    assert (200 + economy["subsidy_payments"] + economy["collection_rewards"]
            - economy["draw_costs"] - economy["post_fees"] - economy["return_costs"] == economy["ending_points"])
    hourly = [{"field": h["field_seconds"] / 3600, "points": h["point_seconds"] / 3600,
               "empty_minutes": h["empty_seconds"] / 60, "cap_minutes": h["cap_seconds"] / 60,
               "shortage_minutes": h["shortage_seconds"] / 60, "rewards": sim.reward_hourly[i]}
              for i, h in enumerate(sim.exposure.hourly)]
    difficulty = {}
    for d in range(1, 6):
        cards = [c for c in sim.card_rows if c["difficulty"] == d]
        difficulty[d] = {"cards": len(cards), **{key: sum(c[key] for c in cards)
                         for key in ("reward", "stack", "paid", "participants")}}
    return {"policy": policy, "seed": seed, "economy": economy,
            "takes": len(sim.card_rows), "hourly": hourly, "difficulty": difficulty,
            "mean_field": statistics.mean(h["field"] for h in hourly),
            "mean_points": statistics.mean(h["points"] for h in hourly),
            "empty_minutes": sum(h["empty_minutes"] for h in hourly),
            "cap_minutes": sum(h["cap_minutes"] for h in hourly),
            "shortages": sim.exposure.shortages, "peak_locked": sim.exposure.peak_locked,
            "minimum_available": sim.exposure.minimum_available}


def aggregate(rows):
    result = {}
    baseline = {r["seed"]: r for r in rows if r["policy"] == "current"}
    for policy in dict.fromkeys(r["policy"] for r in rows):
        group = [r for r in rows if r["policy"] == policy]
        n = len(group)
        entry = {"runs": n, "economy": {k: statistics.mean(r["economy"][k] for r in group)
                 for k in group[0]["economy"]},
                 **{k: statistics.mean(r[k] for r in group) for k in
                    ("takes", "mean_field", "mean_points", "empty_minutes", "cap_minutes", "peak_locked")},
                 "maximum_locked": max(r["peak_locked"] for r in group),
                 "shortage_runs": sum(bool(r["shortages"]) for r in group),
                 "shortage_episodes": sum(len(r["shortages"]) for r in group),
                 "shortage_minutes_per_event": sum(e["minutes"] for r in group for e in r["shortages"]) / n,
                 "total_rewards": sum(r["economy"]["collection_rewards"] for r in group),
                 "hourly": [{k: statistics.mean(r["hourly"][h][k] for r in group)
                             for k in group[0]["hourly"][h]} for h in range(48)],
                 "difficulty": {}}
        for d in range(1, 6):
            bucket = {k: sum(r["difficulty"][d][k] for r in group) for k in group[0]["difficulty"][d]}
            bucket.update({"average_" + k: bucket[k] / bucket["cards"] if bucket["cards"] else None
                           for k in ("reward", "stack", "paid", "participants")})
            entry["difficulty"][d] = bucket
        entry["paired_difference_95ci"] = {}
        if baseline and all(r["seed"] in baseline for r in group):
            for key in ("mean_field", "empty_minutes", "takes", "collection_rewards", "ending_points"):
                def get(row):
                    return row["economy"][key] if key in row["economy"] else row[key]
                differences = [get(r) - get(baseline[r["seed"]]) for r in group]
                mean = statistics.mean(differences)
                margin = 1.984 * statistics.stdev(differences) / math.sqrt(n) if n > 1 else 0
                entry["paired_difference_95ci"][key] = [mean, mean - margin, mean + margin]
        result[policy] = entry
    return result


def self_test():
    assert [half_up(Fraction(x, 2)) for x in range(6)] == [0, 1, 1, 2, 2, 3]
    card = SimpleNamespace(stack_count=5, paid_points_total=2, difficulty=2)
    assert budget(card, "current", True) == 9
    assert budget(card, "a2_b075", True) == 7
    assert budget(card, "a2_b075", False) == 5
    assert budget(card, "a2_b075_keep_single", False) == 7
    exposure = Exposure()
    normal = dict(field=2, points=10, joined=4, available=5, locked=150, retired=45)
    short = dict(normal, available=0, locked=155)
    exposure.add(0, 1800, normal)
    exposure.add(1800, 3600, dict(normal, points=20))
    assert exposure.hourly[0]["point_seconds"] / 3600 == 15
    exposure.add(3600, 3660, short)
    exposure.add(3660, 3660, normal)
    exposure.add(3660, 3720, short)
    exposure.add(3720, 3780, normal)
    exposure.add(3780, 3840, short)
    assert [s["minutes"] for s in exposure.shortages] == [2, 1]
    for seed in (278000, 278001):
        plain = model.Simulation(seed=seed, output_dir=Path("/tmp/tricks-reward-suppression"),
                                 write_outputs=False, take_cost_mode="level_linear", take_level_up_every=2,
                                 take_cooldown_policy="all_field_first_endgame_free")
        study = Study(seed, "current")
        original, observed = plain.run(), study.run()
        for report in (original, observed):
            for path_key in ("jsonl_path", "summary_path"):
                report.pop(path_key)
        assert original == observed, "Observer or baseline changed behavior"
    print("self tests: rounding, budgets, time weighting, shortage episodes, baseline full-summary parity OK", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=100)
    parser.add_argument("--seed", type=int, default=278000)
    parser.add_argument("--policies", nargs="+", choices=list(POLICIES), default=list(POLICIES))
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("tricks-reward-suppression-results.json"))
    parser.add_argument("--test-only", action="store_true")
    args = parser.parse_args()
    self_test()
    if not args.test_only:
        jobs = [(p, s) for p in args.policies for s in range(args.seed, args.seed + args.runs)]
        rows = []
        with ProcessPoolExecutor(max_workers=4) as pool:
            for row in pool.map(run_one, jobs):
                rows.append(row)
                if len(rows) % args.runs == 0:
                    print(f"completed {row['policy']}: {len(rows)}/{len(jobs)}", flush=True)
        result = {"source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                  "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  "seed_start": args.seed, "runs_per_policy": args.runs,
                  "policies": POLICIES, "aggregate": aggregate(rows), "rows": rows}
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        print(f"saved {args.output}", flush=True)
