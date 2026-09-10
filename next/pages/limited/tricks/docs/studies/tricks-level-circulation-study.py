"""Measure circulation consequences of the k=2 public-level take cost."""
import hashlib
import importlib.util
import json
import statistics
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path


SOURCE = Path(__file__).resolve().parents[6] / "lab/tricks_rule_simulation.py"
SCENARIOS = {
    "field_current": {"mode": "field", "k": 2},
    "level_k2": {"mode": "level_linear", "k": 2},
}


def load_model():
    spec = importlib.util.spec_from_file_location("tricks_level_circulation_model", SOURCE)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def mean(values):
    return statistics.mean(values) if values else 0.0


def run(job):
    seed, scenario_name = job
    scenario = SCENARIOS[scenario_name]
    model = load_model()

    class ObservedSimulation(model.Simulation):
        def __init__(self):
            super().__init__(
                seed=seed,
                output_dir=Path("/tmp/tricks-level-circulation"),
                write_outputs=False,
                take_cooldown_policy="all_field_first_endgame_free",
                take_cost_mode=scenario["mode"],
                take_level_up_every=scenario["k"],
            )
            self.observed_at = self.start_at
            self.observed = self._state()
            self.area = {
                "total": 0.0, "field": 0.0, "at_cap": 0.0, "at_80pct_cap": 0.0,
                "full_player_time": 0.0, "full_at_cap": 0.0, "full_at_80pct_cap": 0.0,
                "active_minutes": 0.0, "active_player_minutes": 0.0, "empty_active": 0.0,
                "no_available": 0.0, "no_available_active_with_points": 0.0,
                "active_points": 0.0,
            }
            self.peak_locked = 0
            self.peak_unavailable = 0
            self.min_available = 200
            self.max_locked_when_unavailable = 0
            self.max_collected_when_unavailable = 0

        def _state(self):
            field_count = len(self.field)
            participants = self.participant_count()
            cap = model.field_cap(participants)
            locked = sum(len(player.hand) for player in self.players.values()) + sum(
                self.cards[card_id].stack_count for card_id in self.field
            )
            return {
                "field": field_count,
                "participants": participants,
                "cap": cap,
                "deck": len(self.deck),
                "trash": len(self.trash),
                "locked": locked,
                "unavailable": model.DECK_SIZE - len(self.deck) - len(self.trash),
                "collected": len(self.collected),
            }

        def _integrate(self):
            state = self.observed
            bounds = {self.observed_at, self.now}
            for player in self.players.values():
                for start, end in player.active_sessions:
                    if self.observed_at < start < self.now:
                        bounds.add(start)
                    if self.observed_at < end < self.now:
                        bounds.add(end)
            ordered = sorted(bounds)
            for start, end in zip(ordered, ordered[1:]):
                minutes = (end - start).total_seconds() / 60
                midpoint = start + (end - start) / 2
                active = [player for player in self.players.values() if player.joined and player.is_active(midpoint)]
                if active:
                    self.area["active_minutes"] += minutes
                self.area["active_player_minutes"] += minutes * len(active)
                self.area["active_points"] += minutes * sum(player.points for player in active)
                if active and state["field"] == 0:
                    self.area["empty_active"] += minutes
                if state["deck"] + state["trash"] == 0:
                    self.area["no_available"] += minutes
                    self.max_locked_when_unavailable = max(self.max_locked_when_unavailable, state["locked"])
                    self.max_collected_when_unavailable = max(self.max_collected_when_unavailable, state["collected"])
                    if any(player.points > 0 for player in active):
                        self.area["no_available_active_with_points"] += minutes
                if state["participants"] == model.PLAYER_COUNT:
                    self.area["full_player_time"] += minutes
                    if state["field"] >= state["cap"]:
                        self.area["full_at_cap"] += minutes
                    if state["field"] >= 0.8 * state["cap"]:
                        self.area["full_at_80pct_cap"] += minutes
            minutes = (self.now - self.observed_at).total_seconds() / 60
            self.area["total"] += minutes
            self.area["field"] += state["field"] * minutes
            if state["field"] >= state["cap"]:
                self.area["at_cap"] += minutes
            if state["field"] >= 0.8 * state["cap"]:
                self.area["at_80pct_cap"] += minutes
            self.peak_locked = max(self.peak_locked, state["locked"])
            self.peak_unavailable = max(self.peak_unavailable, state["unavailable"])
            self.min_available = min(self.min_available, state["deck"] + state["trash"])

        def _record(self, event_type, actor, details):
            if hasattr(self, "observed"):
                self._integrate()
                self.observed_at = self.now
                self.observed = self._state()
            return super()._record(event_type, actor, details)

    sim = ObservedSimulation()
    summary = sim.run()
    area = sim.area
    economy = summary["economy"]
    return {
        "seed": seed,
        "scenario": scenario_name,
        "takes": sum(len(player.take_times) for player in sim.players.values()),
        "draws": economy["draw_costs"],
        "posts_paid": economy["post_fees"],
        "return_costs": economy["return_costs"],
        "collection_rewards": economy["collection_rewards"],
        "subsidies": economy["subsidy_payments"],
        "ending_points": economy["ending_points"],
        "average_field": area["field"] / max(1.0, area["total"]),
        "cap_pct": 100 * area["at_cap"] / max(1.0, area["total"]),
        "high_cap_pct": 100 * area["at_80pct_cap"] / max(1.0, area["total"]),
        "full_cap_pct": 100 * area["full_at_cap"] / max(1.0, area["full_player_time"]),
        "full_high_cap_pct": 100 * area["full_at_80pct_cap"] / max(1.0, area["full_player_time"]),
        "full_minutes": area["full_player_time"],
        "full_cap_minutes": area["full_at_cap"],
        "full_high_cap_minutes": area["full_at_80pct_cap"],
        "empty_active_pct": 100 * area["empty_active"] / max(1.0, area["active_minutes"]),
        "active_point_mean": area["active_points"] / max(1.0, area["active_player_minutes"]),
        "no_available_minutes": area["no_available"],
        "blocked_pct": 100 * area["no_available_active_with_points"] / max(1.0, area["active_minutes"]),
        "peak_locked": sim.peak_locked,
        "max_locked_when_unavailable": sim.max_locked_when_unavailable,
        "max_collected_when_unavailable": sim.max_collected_when_unavailable,
        "peak_unavailable": sim.peak_unavailable,
        "min_available": sim.min_available,
        "invariant_errors": summary["invariant_errors"],
    }


def aggregate(rows):
    result = {}
    for key in rows[0]:
        if key not in {"seed", "scenario", "invariant_errors"}:
            result[key] = mean([row[key] for row in rows])
    result["runs_no_available"] = sum(row["min_available"] == 0 for row in rows)
    result["max_locked"] = max(row["peak_locked"] for row in rows)
    result["max_unavailable"] = max(row["peak_unavailable"] for row in rows)
    result["invariant_error_runs"] = sum(bool(row["invariant_errors"]) for row in rows)
    return result


if __name__ == "__main__":
    jobs = [(seed, scenario) for seed in range(277000, 277100) for scenario in SCENARIOS]
    with ProcessPoolExecutor(max_workers=4) as executor:
        rows = list(executor.map(run, jobs))
    print(json.dumps({
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "seeds": [277000, 277099],
        "rows": rows,
        "means": {name: aggregate([row for row in rows if row["scenario"] == name]) for name in SCENARIOS},
    }, ensure_ascii=False, indent=2))
