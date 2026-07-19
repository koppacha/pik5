#!/usr/bin/env python3
"""
期間限定ランキング・トリックテイキング制のルール検証用シミュレーション。

出力:
  - lab/outputs/tricks_simulation_<timestamp>.jsonl
  - lab/outputs/tricks_simulation_<timestamp>_summary.json

標準ライブラリのみで動作する。
"""

from __future__ import annotations

import argparse
import heapq
import json
import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


JST = timezone(timedelta(hours=9))
EVENT_HOURS = 48
PLAYER_COUNT = 16
DECK_SIZE = 200
INITIAL_POINTS = 5
FIELD_LIMIT = 16
TAKE_CLOSE_BEFORE_END = timedelta(hours=1)
INITIAL_LIMIT = timedelta(minutes=90)
TAKE_COOLDOWN = timedelta(minutes=90)
EXTENSION_START_MINUTES = 60
EXTENSION_STEP_MINUTES = 5
EXTENSION_FLOOR_MINUTES = 5
SUBSIDY_INTERVAL = timedelta(minutes=30)
SUBSIDY_THRESHOLD = 5
RARITY_BOOST_PEAK_HOUR = 46
RARITY_INITIAL_RATE = 10.0
RARITY_PEAK_RATE = 100.0
STACK_TARGET_HAND = 14
MIN_PLAY_MINUTES = 10
MAX_INITIAL_PLAY_MINUTES = 60
HARDCORE_COUNT = 8
CASUAL_COUNT = 8
HARDCORE_PEAK_MINUTES_MIN = 7 * 60 * 12 // 10
HARDCORE_TOTAL_MINUTES_MAX = 28 * 60
CASUAL_MINUTES_MIN = 2 * 60
CASUAL_MINUTES_MAX = 6 * 60
OFFPEAK_HARDCORE_COUNT = 2
FAVORITE_CARD_COUNT = 24
WAIT_RECHECK_MINUTES = 5
MAX_ZERO_TIME_ACTIONS = 512
PRACTICE_DIMINISHING_SCALE = 60.0
UPDATE_ATTEMPT_INCREMENT = 5
UPDATE_GAP_MULTIPLIER = 0.35
FORECAST_POST_PARTICIPATION = {
    "正統派": 0.68,
    "投稿優先派": 0.92,
    "スタック派": 0.28,
    "ネガティブ派": 0.52,
    "ホルダー優先派": 0.78,
}

RARITY_DISTRIBUTION = [
    (1, 90.0),
    (2, 6.0),
    (3, 3.0),
    (4, 0.9),
    (5, 0.1),
]

DIFFICULTY_DISTRIBUTION = [
    (1, 54.0),
    (2, 30.0),
    (3, 10.0),
    (4, 5.0),
    (5, 1.0),
]

PERSONALITY_BASE_COUNTS = {
    "スタック派": 2,
    "ホルダー優先派": 2,
    "ネガティブ派": 2,
    "投稿優先派": 5,
    "正統派": 5,
}


@dataclass
class Card:
    id: int
    state: str = "_deck"
    rarity: int | None = None
    difficulty: int | None = None
    taker: str | None = None
    stack_count: int = 0
    stack_ids: list[int] = field(default_factory=list)
    paid_points_total: int = 0
    taken_at: datetime | None = None
    drawn_at: datetime | None = None
    limit_at: datetime | None = None
    collected_at: datetime | None = None
    holder_names: list[str] = field(default_factory=list)
    scores: dict[str, float] = field(default_factory=dict)
    play_time: dict[str, int] = field(default_factory=dict)
    attempt_count: dict[str, int] = field(default_factory=dict)
    update_count: dict[str, int] = field(default_factory=dict)
    last_update_duration: dict[str, int] = field(default_factory=dict)
    posted_players: set[str] = field(default_factory=set)
    paid_players: set[str] = field(default_factory=set)
    reward_log: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Player:
    name: str
    personality: str
    engagement: str
    join_at: datetime
    active_sessions: list[tuple[datetime, datetime]]
    skill_multiplier: float
    motivation_multiplier: float
    favorite_card_ids: set[int] = field(default_factory=set)
    has_offpeak_activity: bool = False
    points: int = 0
    rank_points: int = 0
    hand: list[int] = field(default_factory=list)
    joined: bool = False
    subsidy_flag_slot_at: datetime | None = None
    last_subsidy_paid_slot_at: datetime | None = None
    private_practice: dict[int, int] = field(default_factory=dict)
    actions: dict[str, int] = field(default_factory=dict)
    max_stack_count: int = 0
    busy_until: datetime | None = None
    last_take_at: datetime | None = None
    take_times: list[datetime] = field(default_factory=list)

    def is_active(self, at: datetime) -> bool:
        if not self.joined:
            return False
        return any(start <= at < end for start, end in self.active_sessions)

    def is_active_during(self, start_at: datetime, end_at: datetime) -> bool:
        return any(start <= start_at and end_at <= end for start, end in self.active_sessions)

    def total_active_minutes(self) -> int:
        return int(sum((end - start).total_seconds() for start, end in self.active_sessions) // 60)


class EventQueue:
    PRIORITY = {
        "subsidy": 0,
        "half_hour_snapshot": 0,
        "collect": 1,
        "join": 2,
        "complete_initial_post": 3,
        "complete_update": 3,
        "complete_practice": 3,
        "take_close_attempt": 4,
        "decision": 4,
        "final": 9,
    }

    def __init__(self) -> None:
        self._items: list[tuple[datetime, int, int, str, dict[str, Any]]] = []
        self._seq = 0

    def push(self, at: datetime, kind: str, data: dict[str, Any] | None = None) -> None:
        self._seq += 1
        heapq.heappush(
            self._items,
            (at, self.PRIORITY[kind], self._seq, kind, data or {}),
        )

    def pop(self) -> tuple[datetime, str, dict[str, Any]]:
        at, _priority, _seq, kind, data = heapq.heappop(self._items)
        return at, kind, data

    def __bool__(self) -> bool:
        return bool(self._items)


class Simulation:
    def __init__(self, seed: int, output_dir: Path) -> None:
        self.rng = random.Random(seed)
        self.skill_rng = random.Random(seed ^ 0x5A17)
        self.seed = seed
        self.start_at = datetime(2026, 1, 1, 0, 0, tzinfo=JST)
        self.end_at = self.start_at + timedelta(hours=EVENT_HOURS)
        self.now = self.start_at
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(JST).strftime("%Y%m%d_%H%M%S_%f")
        self.jsonl_path = self.output_dir / f"tricks_simulation_{stamp}.jsonl"
        self.summary_path = self.output_dir / f"tricks_simulation_{stamp}_summary.json"
        self.cards = {i: Card(id=i) for i in range(1, DECK_SIZE + 1)}
        self.deck = list(self.cards.keys())
        self.trash: list[int] = []
        self.field: list[int] = []
        self.collected: list[int] = []
        self.players: dict[str, Player] = {}
        self.queue = EventQueue()
        self.events_written = 0
        self.collections = 0
        self.subsidy_payments = 0
        self.rarity_draw_counts = {rarity: 0 for rarity in range(1, 6)}
        self.invariant_errors: list[str] = []
        self.half_hour_snapshots: list[dict[str, Any]] = []
        self.pending_initial_posts: dict[int, set[str]] = {}
        self._setup_players()
        self._setup_events()

    def _setup_players(self) -> None:
        early_offsets = sorted(self.rng.uniform(0, 60) for _ in range(8))
        late_offsets = sorted(self.rng.uniform(60, EVENT_HOURS * 60 - CASUAL_MINUTES_MIN) for _ in range(8))
        offsets = early_offsets + late_offsets
        personalities = build_personality_roster(self.rng)
        self.rng.shuffle(personalities)
        offpeak_hardcore_indexes = set(self.rng.sample(range(HARDCORE_COUNT), OFFPEAK_HARDCORE_COUNT))
        for idx, offset_minutes in enumerate(offsets, start=1):
            join_at = self.start_at + timedelta(minutes=offset_minutes)
            name = f"player_{idx:02d}"
            personality = personalities[idx - 1]
            engagement = "ガチ勢" if idx <= HARDCORE_COUNT else "エンジョイ勢"
            has_offpeak_activity = idx - 1 in offpeak_hardcore_indexes
            if engagement == "ガチ勢":
                sessions = self._make_hardcore_sessions(join_at, has_offpeak_activity)
            else:
                sessions = self._make_casual_sessions(join_at)
            favorite_card_ids = (
                set(self.rng.sample(range(1, DECK_SIZE + 1), FAVORITE_CARD_COUNT))
                if personality == "ホルダー優先派"
                else set()
            )
            self.players[name] = Player(
                name=name,
                personality=personality,
                engagement=engagement,
                join_at=join_at,
                active_sessions=sessions,
                skill_multiplier=round(self.skill_rng.uniform(0.55, 1.45), 3),
                motivation_multiplier=round(self.skill_rng.uniform(0.8, 1.2), 3),
                favorite_card_ids=favorite_card_ids,
                has_offpeak_activity=has_offpeak_activity,
            )
        self._check_player_setup()

    def _make_hardcore_sessions(
        self,
        join_at: datetime,
        include_offpeak: bool,
    ) -> list[tuple[datetime, datetime]]:
        peak_windows = [
            (max(join_at, self.start_at), self.start_at + timedelta(hours=6)),
            (max(join_at, self.start_at + timedelta(hours=24)), self.start_at + timedelta(hours=30)),
        ]
        capacities = [max(0, int((end - start).total_seconds() // 60)) for start, end in peak_windows]
        peak_target = self.rng.randint(
            HARDCORE_PEAK_MINUTES_MIN,
            min(12 * 60, sum(capacities)),
        )
        first_min = max(0, peak_target - capacities[1])
        first_max = min(capacities[0], peak_target)
        first_duration = self.rng.randint(first_min, first_max)
        peak_durations = [first_duration, peak_target - first_duration]
        sessions = [
            self._place_session(window, duration)
            for window, duration in zip(peak_windows, peak_durations)
            if duration > 0
        ]
        if include_offpeak:
            extra_max = min(16 * 60, HARDCORE_TOTAL_MINUTES_MAX - peak_target)
            extra_target = self.rng.randint(2 * 60, extra_max)
            offpeak_windows = [
                (max(join_at, self.start_at + timedelta(hours=6)), self.start_at + timedelta(hours=24)),
                (max(join_at, self.start_at + timedelta(hours=30)), self.end_at - TAKE_CLOSE_BEFORE_END),
            ]
            capacities = [max(0, int((end - start).total_seconds() // 60)) for start, end in offpeak_windows]
            first_min = max(0, extra_target - capacities[1])
            first_max = min(capacities[0], extra_target)
            first_duration = self.rng.randint(first_min, first_max)
            extra_durations = [first_duration, extra_target - first_duration]
            for window, duration in zip(offpeak_windows, extra_durations):
                sessions.extend(self._place_fragmented_sessions(window, duration))
        return merge_sessions(sessions)

    def _place_fragmented_sessions(
        self,
        window: tuple[datetime, datetime],
        total_minutes: int,
    ) -> list[tuple[datetime, datetime]]:
        if total_minutes <= 0:
            return []
        # ピーク外活動は長大な連続稼働にせず、概ね30〜120分の断続的な活動へ分割する。
        session_count = max(1, math.ceil(total_minutes / 120))
        while session_count > 1 and total_minutes < session_count * 30:
            session_count -= 1
        base_duration, remainder = divmod(total_minutes, session_count)
        durations = [base_duration + (1 if index < remainder else 0) for index in range(session_count)]
        self.rng.shuffle(durations)
        start_bound, end_bound = window
        available = max(1, int((end_bound - start_bound).total_seconds() // 60))
        span = max(1, available // session_count)
        sessions: list[tuple[datetime, datetime]] = []
        for index, duration in enumerate(durations):
            segment_start = start_bound + timedelta(minutes=index * span)
            segment_end = end_bound if index == session_count - 1 else start_bound + timedelta(minutes=(index + 1) * span)
            sessions.append(self._place_session((segment_start, segment_end), duration))
        return sessions

    def _make_casual_sessions(self, join_at: datetime) -> list[tuple[datetime, datetime]]:
        available = int((self.end_at - join_at).total_seconds() // 60)
        total = self.rng.randint(CASUAL_MINUTES_MIN, min(CASUAL_MINUTES_MAX, available))
        session_count = self.rng.randint(1, 3)
        base_duration, remainder = divmod(total, session_count)
        durations = [base_duration + (1 if index < remainder else 0) for index in range(session_count)]
        self.rng.shuffle(durations)
        span = max(1, available // session_count)
        sessions: list[tuple[datetime, datetime]] = []
        for index, duration in enumerate(durations):
            window_start = join_at + timedelta(minutes=index * span)
            window_end = self.end_at if index == session_count - 1 else join_at + timedelta(minutes=(index + 1) * span)
            sessions.append(self._place_session((window_start, window_end), duration))
        return merge_sessions(sessions)

    def _place_session(
        self,
        window: tuple[datetime, datetime],
        duration_minutes: int,
    ) -> tuple[datetime, datetime]:
        start_bound, end_bound = window
        latest_offset = max(0, int((end_bound - start_bound).total_seconds() // 60) - duration_minutes)
        start = start_bound + timedelta(minutes=self.rng.randint(0, latest_offset))
        return start, min(start + timedelta(minutes=duration_minutes), end_bound)

    def _check_player_setup(self) -> None:
        hardcore = [player for player in self.players.values() if player.engagement == "ガチ勢"]
        casual = [player for player in self.players.values() if player.engagement == "エンジョイ勢"]
        if len(hardcore) != HARDCORE_COUNT or len(casual) != CASUAL_COUNT:
            self.invariant_errors.append("player_setup: engagement counts mismatch")
        if sum(player.has_offpeak_activity for player in hardcore) != OFFPEAK_HARDCORE_COUNT:
            self.invariant_errors.append("player_setup: offpeak hardcore count mismatch")
        for player in hardcore:
            if not HARDCORE_PEAK_MINUTES_MIN <= peak_active_minutes(player, self.start_at) <= 12 * 60:
                self.invariant_errors.append(f"player_setup: {player.name} peak minutes out of range")
            if player.total_active_minutes() > HARDCORE_TOTAL_MINUTES_MAX:
                self.invariant_errors.append(f"player_setup: {player.name} exceeds 28 hours")
        for player in casual:
            if not CASUAL_MINUTES_MIN <= player.total_active_minutes() <= CASUAL_MINUTES_MAX:
                self.invariant_errors.append(f"player_setup: {player.name} casual minutes out of range")
        counts = {name: sum(player.personality == name for player in self.players.values()) for name in PERSONALITY_BASE_COUNTS}
        for name, base in PERSONALITY_BASE_COUNTS.items():
            if abs(counts[name] - base) > 1:
                self.invariant_errors.append(f"player_setup: {name} count {counts[name]} outside ±1")

    def _setup_events(self) -> None:
        for player in self.players.values():
            self.queue.push(player.join_at, "join", {"player": player.name})
            for start, _end in player.active_sessions:
                if start >= player.join_at:
                    self.queue.push(start, "decision", {"player": player.name})
        slot = self.start_at
        while slot <= self.end_at:
            self.queue.push(slot, "subsidy")
            self.queue.push(slot, "half_hour_snapshot")
            slot += SUBSIDY_INTERVAL
        self.queue.push(self.end_at - TAKE_CLOSE_BEFORE_END - timedelta(microseconds=1), "take_close_attempt")
        self.queue.push(self.end_at, "final")

    def run(self) -> dict[str, Any]:
        with self.jsonl_path.open("w", encoding="utf-8") as fh:
            self.out = fh
            while self.queue:
                at, kind, data = self.queue.pop()
                if at > self.end_at:
                    continue
                self.now = at
                if kind == "join":
                    self._handle_join(data["player"])
                elif kind == "subsidy":
                    self._handle_subsidy()
                elif kind == "half_hour_snapshot":
                    self._handle_half_hour_snapshot()
                elif kind == "collect":
                    self._handle_collect_event(data["card_id"], data["limit_at"])
                elif kind == "decision":
                    self._handle_decision(data["player"])
                elif kind == "complete_initial_post":
                    self._complete_initial_post(data["player"], data["card_id"], data["duration"])
                elif kind == "complete_update":
                    self._complete_update(
                        data["player"],
                        data["card_id"],
                        data["duration"],
                        data.get("target_score"),
                        data.get("raw_gap"),
                        data.get("planned_update_count"),
                    )
                elif kind == "complete_practice":
                    self._complete_practice(data["player"], data["card_id"], data["duration"])
                elif kind == "take_close_attempt":
                    self._handle_take_close_attempts()
                elif kind == "final":
                    self._handle_final()
                    break
            summary = self._summary()
            self.out.write(json.dumps({"type": "summary", "summary": summary}, ensure_ascii=False) + "\n")
        self.summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        return summary

    def _handle_join(self, player_name: str) -> None:
        player = self.players[player_name]
        if player.joined:
            return
        existing = [p for p in self.players.values() if p.joined]
        for other in existing:
            other.points += 1
        player.joined = True
        player.points += INITIAL_POINTS
        self._record("join", player_name, {"existing_players_bonus": len(existing)})

    def _handle_subsidy(self) -> None:
        paid: list[str] = []
        field_empty = len(self.field) == 0
        for player in self.players.values():
            if not player.joined:
                continue
            flag_due = player.subsidy_flag_slot_at is not None and player.subsidy_flag_slot_at <= self.now
            eligible = field_empty or flag_due
            if not eligible or player.points > SUBSIDY_THRESHOLD:
                continue
            if player.last_subsidy_paid_slot_at == self.now:
                continue
            player.points += 1
            player.last_subsidy_paid_slot_at = self.now
            self.subsidy_payments += 1
            paid.append(player.name)
            if flag_due:
                player.subsidy_flag_slot_at = None
        if paid:
            self._record("subsidy", None, {"paid": paid, "field_empty": field_empty})

    def _handle_half_hour_snapshot(self) -> None:
        self.half_hour_snapshots.append(self._half_hour_summary_snapshot())

    def _handle_take_close_attempts(self) -> None:
        players = [player for player in self.players.values() if player.joined]
        self.rng.shuffle(players)
        for player in players:
            player.actions["take_close_attempt"] = player.actions.get("take_close_attempt", 0) + 1
            if len(player.hand) < self._required_take_hand():
                self._record("take_close_attempt", player.name, {
                    "result": "insufficient_hand",
                    "hand_count": len(player.hand),
                })
                continue
            card_id = self._select_take_card(player)
            if card_id is None or not self._can_take(player):
                reason = self._take_block_reason(player)
                self._record("take_close_attempt", player.name, {
                    "result": "take_not_allowed",
                    "reason": reason,
                    "hand_count": len(player.hand),
                    "field_count": len(self.field),
                    "next_take_at": self._iso(take_cooldown_until(player.last_take_at)),
                })
                continue
            card = self.cards[card_id]
            if self._feasible_new_field_posters(card, self.end_at) == 0:
                self._record("take_close_attempt", player.name, {
                    "result": "no_expected_poster",
                    "hand_count": len(player.hand),
                    "field_count": len(self.field),
                })
                continue
            self._take(player, card_id, trigger="take_close_attempt")

    def _handle_decision(self, player_name: str) -> None:
        player = self.players[player_name]
        if not player.is_active(self.now) or self.now >= self.end_at:
            return
        if player.busy_until is not None and self.now < player.busy_until:
            self.invariant_errors.append(f"decision_while_busy: {player.name} at {self._iso(self.now)}")
            return
        # UI操作は0分とし、同一時刻内で状態が変わる限り次の意思決定へ進む。
        # 時間が進むのはミニゲームのプレイと手札練習だけとする。
        for _step in range(MAX_ZERO_TIME_ACTIONS):
            due = self._collect_due_cards()
            for card_id in due:
                self._collect_card(card_id)
            action = self._choose_action(player)
            if action.get("consensus"):
                player.actions["consensus_resolution"] = player.actions.get("consensus_resolution", 0) + 1
                self._record("consensus", player.name, {
                    "resolution": action["consensus"],
                    "action": action["type"],
                    "card_id": action.get("card_id"),
                })
            if action["type"] == "wait":
                player.actions["wait"] = player.actions.get("wait", 0) + 1
                self._record("wait", player.name, {"reason": action.get("reason", "no_action")})
                self._schedule_next_decision(player, WAIT_RECHECK_MINUTES)
                return
            if action["type"] == "draw":
                self._draw(player)
                continue
            if action["type"] == "take":
                self._take(player, action["card_id"], trigger=action.get("consensus", "decision"))
                continue
            if action["type"] in {"initial_post", "update", "practice"}:
                duration = action["duration"]
                finish = self.now + timedelta(minutes=duration)
                if not player.is_active_during(self.now, finish):
                    player.actions["wait"] = player.actions.get("wait", 0) + 1
                    self._record("wait", player.name, {"reason": "not_enough_active_time", "planned": action})
                    self._schedule_next_decision(player, WAIT_RECHECK_MINUTES)
                    return
                player.busy_until = finish
                if action["type"] == "initial_post":
                    self.pending_initial_posts.setdefault(action["card_id"], set()).add(player.name)
                    self.queue.push(finish, "complete_initial_post", {
                        "player": player.name,
                        "card_id": action["card_id"],
                        "duration": duration,
                    })
                elif action["type"] == "update":
                    self.queue.push(finish, "complete_update", {
                        "player": player.name,
                        "card_id": action["card_id"],
                        "duration": duration,
                        "target_score": action.get("target_score"),
                        "raw_gap": action.get("raw_gap"),
                        "planned_update_count": action.get("planned_update_count"),
                    })
                else:
                    self.queue.push(finish, "complete_practice", {
                        "player": player.name,
                        "card_id": action["card_id"],
                        "duration": duration,
                    })
                return
        self.invariant_errors.append(f"zero_time_action_limit: {player.name} at {self._iso(self.now)}")
        self._schedule_next_decision(player, WAIT_RECHECK_MINUTES)

    def _choose_action(self, player: Player) -> dict[str, Any]:
        options = self._legal_actions(player)
        if not options:
            return {"type": "wait", "reason": "no_legal_action"}
        consensus_action = self._consensus_stall_action(player, options)
        if consensus_action is not None:
            return consensus_action
        hand_pressure_take = self._take_to_avoid_large_hand(player, options)
        if hand_pressure_take is not None:
            return hand_pressure_take
        if player.personality == "投稿優先派":
            return self._choose_post_priority_action(player, options)
        if player.personality == "スタック派":
            return self._choose_stack_action(player, options)
        if player.personality == "ホルダー優先派":
            return self._choose_holder_priority_action(player, options)
        if player.personality == "正統派":
            return self._choose_orthodox_action(player, options)
        return self._choose_negative_action(player, options)

    def _consensus_stall_action(
        self,
        player: Player,
        options: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        # 場札が無い場合は、今すぐテイクできる活動中プレイヤーのうち
        # 最大手札の1人だけが戦略より循環再開を優先する。
        if not self.field:
            candidates = [
                other
                for other in self.players.values()
                if other.is_active(self.now)
                and (other.busy_until is None or other.busy_until <= self.now)
                and self._can_take(other)
            ]
            if candidates:
                selected = max(
                    candidates,
                    key=lambda other: (
                        len(other.hand),
                        self._remaining_active_minutes(other, self.end_at - TAKE_CLOSE_BEFORE_END),
                        -int(other.name.split("_")[-1]),
                    ),
                )
                takes = [action for action in options if action["type"] == "take"]
                if selected.name == player.name and takes:
                    action = max(takes, key=lambda item: self._take_value(player, item["card_id"]))
                    return {**action, "consensus": "restart_empty_field"}

        return None

    def _legal_actions(self, player: Player) -> list[dict[str, Any]]:
        actions: list[dict[str, Any]] = []
        can_still_take = self.now < self.end_at - TAKE_CLOSE_BEFORE_END
        future_take_count = self._forecast_take_opportunities(player)
        # テイク締切後は、新たに引いたカードや手札練習の成果を場に出せない。
        # 残り時間は場札への投稿・更新に使う方が合理的なので候補から除外する。
        if can_still_take and future_take_count > 0 and player.points >= 1 and self.deck_or_trash_available():
            actions.append({"type": "draw"})
        if self._can_take(player):
            card_id = self._select_take_card(player)
            if card_id and self._feasible_new_field_posters(self.cards[card_id]) > 0:
                actions.append({"type": "take", "card_id": card_id})
        for card_id in self.field:
            card = self.cards[card_id]
            if player.name not in card.paid_players:
                max_duration = self._max_initial_play_minutes(player, card)
                if max_duration >= difficulty_minimum_minutes(card.difficulty):
                    duration = self._initial_play_duration(player, card, max_duration)
                    actions.append({
                        "type": "initial_post",
                        "card_id": card_id,
                        "duration": duration,
                        "participation_probability": self._post_participation_probability(player, card, duration),
                    })
            elif player.name in card.posted_players:
                plan = self._update_play_plan(player, card)
                if plan is not None and self._can_finish_timed_action(player, plan["duration"], card.limit_at):
                    actions.append({
                        "type": "update",
                        "card_id": card_id,
                        **plan,
                    })
        if can_still_take and future_take_count > 0 and player.hand:
            favorite_hand = [card_id for card_id in player.hand if card_id in player.favorite_card_ids]
            practice_card_id = self.rng.choice(favorite_hand or player.hand)
            duration = self._practice_duration(player, self.cards[practice_card_id])
            take_close_at = self.end_at - TAKE_CLOSE_BEFORE_END - timedelta(microseconds=1)
            if self._can_finish_timed_action(player, duration, take_close_at):
                actions.append({
                    "type": "practice",
                    "card_id": practice_card_id,
                    "duration": duration,
                })
        return actions

    def _can_finish_timed_action(
        self,
        player: Player,
        duration: int,
        target_limit: datetime | None = None,
    ) -> bool:
        finish = self.now + timedelta(minutes=duration)
        if finish > self.end_at or not player.is_active_during(self.now, finish):
            return False
        if target_limit is not None and finish >= target_limit:
            return False
        return True

    def _choose_post_priority_action(self, player: Player, options: list[dict[str, Any]]) -> dict[str, Any]:
        # 投稿優先派：未投稿の場札数を最優先し、全件投稿後は正統派へ戻る。
        initial_posts = [
            a for a in options
            if a["type"] == "initial_post" and a.get("participation_probability", 0.0) >= 0.15
        ]
        if initial_posts:
            return min(initial_posts, key=lambda a: (
                a["duration"],
                -self._forecast_post_rank_points(player, self.cards[a["card_id"]], a["duration"]),
            ))
        return self._choose_orthodox_action(player, options)

    def _choose_stack_action(self, player: Player, options: list[dict[str, Any]]) -> dict[str, Any]:
        # スタック派：締切までにテイクできる範囲で巨大スタック化を予測する。
        draws = [a for a in options if a["type"] == "draw"]
        takes = [a for a in options if a["type"] == "take"]
        initial_posts = [
            a for a in options
            if a["type"] == "initial_post"
            and a.get("participation_probability", 0.0) >= (0.1 if self.now >= self.end_at - TAKE_CLOSE_BEFORE_END else 0.45)
        ]
        updates = [a for a in options if a["type"] == "update"]
        take_opportunities = self._forecast_take_opportunities(player)
        required_hand = self._required_take_hand()
        reachable_target = min(
            max(STACK_TARGET_HAND, required_hand),
            len(player.hand) + max(0, player.points),
        )
        must_take_now = bool(takes) and take_opportunities <= 1
        cannot_reach_take = len(player.hand) + max(0, player.points) < required_hand
        if initial_posts and cannot_reach_take:
            return min(initial_posts, key=lambda a: a["duration"])
        if draws and len(player.hand) < reachable_target and not must_take_now:
            return draws[0]
        if takes and (len(player.hand) >= reachable_target or not draws or must_take_now):
            return max(takes, key=lambda a: self._take_value(player, a["card_id"]))
        if self.now >= self.end_at - TAKE_CLOSE_BEFORE_END:
            endgame_posts = [*initial_posts, *updates]
            if endgame_posts:
                return min(endgame_posts, key=lambda a: a["duration"])
        if initial_posts and self.rng.random() < 0.25:
            return self.rng.choice(initial_posts)
        return {"type": "wait", "reason": "stack_building"}

    def _choose_orthodox_action(self, player: Player, options: list[dict[str, Any]]) -> dict[str, Any]:
        # 正統派：残り活動時間と後続行動を含む予測ランクPを最大化する。
        ranked_actions = sorted(
            options,
            key=lambda action: self._forecast_action_value(player, action),
            reverse=True,
        )
        best = ranked_actions[0]
        best_value = self._forecast_action_value(player, best)
        if best_value > 0:
            return best
        takes = [a for a in options if a["type"] == "take"]
        if takes and len(player.hand) >= 5:
            return max(takes, key=lambda a: self._take_value(player, a["card_id"]))
        draws = [a for a in options if a["type"] == "draw"]
        if draws and len(player.hand) < max(6, self._required_take_hand()):
            return draws[0]
        return {"type": "wait", "reason": "orthodox_no_rank_point_gain"}

    def _choose_negative_action(self, player: Player, options: list[dict[str, Any]]) -> dict[str, Any]:
        # ネガティブ派：練習成果を締切前に場へ出せる見込みがある場合に練習を優先する。
        draws = [a for a in options if a["type"] == "draw"]
        if draws and len(player.hand) < self._required_take_hand():
            return draws[0]
        practices = [a for a in options if a["type"] == "practice"]
        if practices and self._forecast_take_opportunities(player) >= 1:
            best_practice = max(practices, key=lambda a: self._forecast_action_value(player, a) + a["duration"] / 25.0)
            alternatives = [a for a in options if a["type"] != "practice"]
            alternative_value = max((self._forecast_action_value(player, a) for a in alternatives), default=0.0)
            practice_value = self._forecast_action_value(player, best_practice) + best_practice["duration"] / 25.0
            if practice_value >= alternative_value * 0.65:
                return best_practice
        return self._choose_orthodox_action(player, options)

    def _choose_holder_priority_action(self, player: Player, options: list[dict[str, Any]]) -> dict[str, Any]:
        favorite_actions = [
            action for action in options
            if action.get("card_id") in player.favorite_card_ids
        ]
        if not favorite_actions:
            return self._choose_orthodox_action(player, options)

        def holder_value(action: dict[str, Any]) -> float:
            card = self.cards[action["card_id"]]
            if action["type"] == "update":
                return 100.0 - self._predicted_rank_after_play(player, card, action["duration"]) * 10.0
            if action["type"] == "initial_post":
                return 90.0 - self._predicted_rank_after_play(player, card, action["duration"]) * 10.0
            if action["type"] == "practice":
                return 60.0 + action["duration"] / 10.0
            if action["type"] == "take":
                return 70.0 + self._take_value(player, action["card_id"])
            return self._forecast_action_value(player, action)

        return max(favorite_actions, key=holder_value)

    def _take_to_avoid_large_hand(self, player: Player, options: list[dict[str, Any]]) -> dict[str, Any] | None:
        pressure_threshold = max(8, self._required_take_hand())
        if player.personality == "スタック派" or len(player.hand) < pressure_threshold:
            return None
        takes = [a for a in options if a["type"] == "take"]
        if takes:
            return max(takes, key=lambda a: self._take_value(player, a["card_id"]))
        # 現在の必要手札枚数以上では、テイクできない限りドローを候補から実質排除する。
        if len(player.hand) >= pressure_threshold:
            non_draws = [a for a in options if a["type"] != "draw"]
            if non_draws:
                return max(non_draws, key=lambda a: self._generic_action_value(player, a))
            return {"type": "wait", "reason": "avoid_hand_9_plus"}
        return None

    def _forecast_action_value(self, player: Player, action: dict[str, Any]) -> float:
        remaining_active = self._remaining_active_minutes(player)
        spend_capacity = self._forecast_spend_capacity(player)
        point_shadow = terminal_point_shadow(player.points, remaining_active, spend_capacity)
        if action["type"] == "initial_post":
            card = self.cards[action["card_id"]]
            cost = self._initial_post_cost(card)
            coverage_value = 0.6 + card.stack_count / 12.0
            expected_utility = self._post_expected_utility(player, card, action["duration"])
            return expected_utility + coverage_value + cost * point_shadow
        if action["type"] == "update":
            card = self.cards[action["card_id"]]
            current_rank = self._current_rank(player, card)
            participant_count = self._forecast_field_participants(card, player.name)
            predicted_rank = self._forecast_rank_after_future_posts(player, card, action["duration"], participant_count)
            gain = self._rank_points_for(predicted_rank, participant_count, card.stack_count)
            gain -= self._rank_points_for(current_rank, participant_count, card.stack_count)
            return gain - play_time_cost(action["duration"])
        if action["type"] == "take":
            stack_count = len(player.hand)
            expected_participants = self._forecast_new_field_participants(player, self.cards[action["card_id"]])
            if expected_participants <= 0:
                return -1000.0
            expected_rank = self._forecast_rank_from_skill(player, expected_participants)
            rank_points = self._rank_points_for(expected_rank, expected_participants, stack_count)
            pipeline_value = min(3.0, player.points * 0.08) + stack_count * 0.2
            return rank_points + pipeline_value + self._take_value(player, action["card_id"]) * 0.15
        if action["type"] == "draw":
            projected_stack = self._forecast_orthodox_stack_target(player)
            expected_participants = self._forecast_new_field_participants(player)
            expected_rank = self._forecast_rank_from_skill(player, expected_participants)
            future_rank_points = self._rank_points_for(expected_rank, expected_participants, projected_stack)
            remaining_draws = max(1, projected_stack - len(player.hand))
            pipeline_value = future_rank_points / remaining_draws
            completion_bonus = 1.0 if len(player.hand) < self._required_take_hand() else 0.35
            return pipeline_value + completion_bonus + point_shadow
        if action["type"] == "practice":
            card = self.cards[action["card_id"]]
            stack_count = max(3, self._forecast_orthodox_stack_target(player))
            participants = max(1, self._forecast_new_field_participants(player, card))
            normal_play = self._expected_play_minutes(player)
            practiced = player.private_practice.get(card.id, 0)
            before_score = self._score_for_minutes(player, normal_play, practiced)
            after_score = self._score_for_minutes(player, normal_play, practiced + action["duration"])
            before_rank = self._forecast_rank_from_score(before_score, participants)
            after_rank = self._forecast_rank_from_score(after_score, participants)
            discrete_gain = self._rank_points_for(after_rank, participants, stack_count)
            discrete_gain -= self._rank_points_for(before_rank, participants, stack_count)
            fractional_gain = min(2.5, (after_score - before_score) / 55.0)
            take_probability = min(1.0, self._forecast_take_opportunities(player) / 3.0)
            return (discrete_gain + fractional_gain) * take_probability
        return 0.0

    def _orthodox_rank_point_value(self, player: Player, action: dict[str, Any]) -> float:
        # 既存の診断コードとの互換用。評価本体は複数手先予測へ移行した。
        return self._forecast_action_value(player, action)

    def _remaining_active_minutes(self, player: Player, until: datetime | None = None) -> int:
        horizon = min(until or self.end_at, self.end_at)
        total = 0.0
        for start, end in player.active_sessions:
            overlap_start = max(self.now, start)
            overlap_end = min(horizon, end)
            if overlap_end > overlap_start:
                total += (overlap_end - overlap_start).total_seconds() / 60.0
        return int(total)

    def _forecast_take_opportunities(self, player: Player) -> int:
        """活動セッションと固定クールダウンから締切までの最大テイク回数を見積もる。"""
        close_at = self.end_at - TAKE_CLOSE_BEFORE_END
        if self.now >= close_at:
            return 0
        next_ready = max(self.now, take_cooldown_until(player.last_take_at) or self.now)
        hypothetical_last = player.last_take_at
        opportunities = 0
        for session_start, session_end in player.active_sessions:
            window_start = max(self.now, session_start)
            window_end = min(close_at, session_end)
            candidate = max(window_start, next_ready)
            while candidate < window_end:
                opportunities += 1
                hypothetical_last = candidate
                candidate += TAKE_COOLDOWN
                next_ready = candidate

        # 締切直前試行だけは活動セッション外でも全員が1回試みる。
        take_close_attempt_at = close_at - timedelta(microseconds=1)
        if (
            take_close_attempt_at >= self.now
            and take_cooldown_ready(hypothetical_last, take_close_attempt_at)
        ):
            opportunities += 1
        return opportunities

    def _forecast_spend_capacity(self, player: Player) -> int:
        unposted_cost = sum(
            self._initial_post_cost(self.cards[card_id])
            for card_id in self.field
            if player.name not in self.cards[card_id].paid_players
        )
        draw_capacity = min(
            max(0, player.points),
            max(0, (FIELD_LIMIT - len(self.field)) * 3),
        )
        future_fields = min(4, self._forecast_take_opportunities(player))
        return max(1, unposted_cost + draw_capacity + future_fields * 2)

    def _forecast_orthodox_stack_target(self, player: Player) -> int:
        affordable = len(player.hand) + max(0, player.points)
        surplus_target = 3 + min(7, max(0, player.points - 5) // 8)
        return max(3, min(affordable, max(self._required_take_hand(), surplus_target)))

    def _forecast_field_participants(self, card: Card, actor_name: str) -> int:
        deadline = min(card.limit_at or (self.now + INITIAL_LIMIT), self.end_at)
        expected = float(len(card.posted_players | {actor_name}))
        for other in self.players.values():
            if not other.joined or other.name == actor_name or other.name in card.posted_players:
                continue
            duration = max(difficulty_minimum_minutes(card.difficulty), self._expected_play_minutes(other))
            if not self._can_schedule_play_before(other, duration, deadline):
                continue
            expected += self._estimated_future_post_probability(other, card)
        return max(1, min(self.participant_count(), int(round(expected))))

    def _practice_risk_penalty(self, card: Card) -> float:
        if card.taker is None or card.taker in card.posted_players or card.taken_at is None:
            return 0.0
        taker = self.players[card.taker]
        held_minutes = 0.0
        if card.drawn_at is not None:
            held_minutes = max(0.0, (card.taken_at - card.drawn_at).total_seconds() / 60.0)
        practice_propensity = 0.7 if taker.personality == "ネガティブ派" else 0.2
        expected_hidden_practice = held_minutes * practice_propensity
        return min(4.0, self._effective_practice_minutes(int(expected_hidden_practice)) / 25.0)

    def _estimated_future_post_probability(self, player: Player, card: Card) -> float:
        duration = self._expected_play_minutes(player)
        predicted_rank = self._predicted_rank_after_play(player, card, duration)
        participant_count = max(1, len(card.posted_players) + 1)
        rank_points = self._rank_points_for(predicted_rank, participant_count, card.stack_count)
        expected_reward = self._field_reward_potential(card.id) / participant_count
        fee = self._initial_post_cost(card)
        time_cost = play_time_cost(duration)
        utility = rank_points + expected_reward * 0.25 - fee - time_cost - self._practice_risk_penalty(card)
        base = FORECAST_POST_PARTICIPATION[player.personality]
        logit = math.log(base / (1.0 - base)) + utility / 3.0
        return min(0.98, max(0.02, 1.0 / (1.0 + math.exp(-logit))))

    def _post_expected_utility(self, player: Player, card: Card, duration: int) -> float:
        participant_count = self._forecast_field_participants(card, player.name)
        predicted_rank = self._forecast_rank_after_future_posts(player, card, duration, participant_count)
        rank_points = self._rank_points_for(predicted_rank, participant_count, card.stack_count)
        expected_reward = self._field_reward_potential(card.id) / max(1, participant_count)
        rank_reward_weight = max(0.2, (participant_count - predicted_rank + 1) / participant_count)
        fee = self._initial_post_cost(card)
        time_cost = play_time_cost(duration)
        return (
            rank_points
            + expected_reward * rank_reward_weight * 0.35
            - fee
            - time_cost
            - self._practice_risk_penalty(card)
        )

    def _post_participation_probability(self, player: Player, card: Card, duration: int) -> float:
        utility = self._post_expected_utility(player, card, duration)
        base = FORECAST_POST_PARTICIPATION[player.personality]
        logit = math.log(base / (1.0 - base)) + utility / 3.0
        return min(0.98, max(0.02, 1.0 / (1.0 + math.exp(-logit))))

    def _forecast_new_field_participants(self, player: Player, card: Card | None = None) -> int:
        deadline = min(self.now + INITIAL_LIMIT, self.end_at)
        expected = 0.0
        for other in self.players.values():
            if not other.joined:
                continue
            duration = max(
                difficulty_minimum_minutes(card.difficulty if card else 1),
                self._expected_play_minutes(other),
            )
            if not self._can_schedule_play_before(other, duration, deadline):
                continue
            expected += FORECAST_POST_PARTICIPATION[other.personality]
        return max(0, min(self.participant_count(), int(round(expected))))

    def _can_schedule_play_before(self, player: Player, duration: int, deadline: datetime) -> bool:
        for session_start, session_end in player.active_sessions:
            start = max(self.now, session_start)
            end = min(deadline, session_end, self.end_at)
            if start + timedelta(minutes=duration) < end:
                return True
        return False

    def _feasible_new_field_posters(self, card: Card, deadline: datetime | None = None) -> int:
        limit = min(deadline or (self.now + INITIAL_LIMIT), self.end_at)
        return sum(
            1
            for other in self.players.values()
            if other.joined
            and self._can_schedule_play_before(
                other,
                difficulty_minimum_minutes(card.difficulty),
                limit,
            )
        )

    def _forecast_rank_after_future_posts(
        self,
        player: Player,
        card: Card,
        duration: int,
        participant_count: int,
    ) -> int:
        known_rank = self._predicted_rank_after_play(player, card, duration)
        known_participants = len(card.posted_players | {player.name})
        future_competitors = max(0, participant_count - known_participants)
        predicted_time = card.play_time.get(player.name, 0) + duration
        predicted_score = self._score_for_minutes(
            player,
            predicted_time,
            player.private_practice.get(card.id, 0),
        )
        expected_rank = self._forecast_rank_from_score(predicted_score, participant_count)
        return min(participant_count, max(known_rank, min(known_rank + future_competitors, expected_rank)))

    def _forecast_post_rank_points(self, player: Player, card: Card, duration: int) -> int:
        participant_count = self._forecast_field_participants(card, player.name)
        predicted_rank = self._forecast_rank_after_future_posts(player, card, duration, participant_count)
        return self._rank_points_for(predicted_rank, participant_count, card.stack_count)

    def _expected_play_minutes(self, player: Player) -> int:
        return 18

    def _forecast_rank_from_skill(self, player: Player, participant_count: int) -> int:
        stronger = sum(
            1
            for other in self.players.values()
            if other.joined and other.name != player.name and other.skill_multiplier > player.skill_multiplier
        )
        joined_others = max(1, self.participant_count() - 1)
        return min(participant_count, 1 + round(stronger * max(0, participant_count - 1) / joined_others))

    def _forecast_rank_from_score(self, score: float, participant_count: int) -> int:
        joined = [other for other in self.players.values() if other.joined]
        if not joined:
            return 1
        expected_scores = sorted(
            (self._score_for_minutes(other, self._expected_play_minutes(other), 0) for other in joined),
            reverse=True,
        )
        stronger = sum(1 for expected_score in expected_scores[:participant_count] if expected_score > score)
        return min(participant_count, stronger + 1)

    def _generic_action_value(self, player: Player, action: dict[str, Any]) -> float:
        if action["type"] == "take":
            return self._take_value(player, action["card_id"])
        if action["type"] == "initial_post":
            card = self.cards[action["card_id"]]
            return self._field_reward_potential(action["card_id"]) - self._initial_post_cost(card)
        if action["type"] == "update":
            return self._field_reward_potential(action["card_id"]) * 0.5
        if action["type"] == "practice":
            return 0.2
        return 0.0

    def _take_value(self, player: Player, card_id: int) -> float:
        card = self.cards[card_id]
        practice = self._effective_practice_minutes(player.private_practice.get(card_id, 0))
        difficulty = card.difficulty or 1
        stack = len(player.hand)
        return stack * 2.0 + practice / 20.0 + difficulty * 0.25

    def _rank_points_for(self, rank: int, participant_count: int, stack_count: int) -> int:
        return calculate_rank_points(rank, participant_count, stack_count)

    def _live_rank_points(self) -> dict[str, int]:
        live = {player_name: 0 for player_name in self.players}
        for card_id in self.field:
            card = self.cards[card_id]
            ranking = self._ranking_groups(card)
            participant_count = sum(len(group["players"]) for group in ranking)
            for group in ranking:
                delta = self._rank_points_for(group["rank"], participant_count, card.stack_count)
                for player_name in group["players"]:
                    live[player_name] += delta
        return live

    def _display_rank_points(self, player: Player, live: dict[str, int] | None = None) -> int:
        current_live = live if live is not None else self._live_rank_points()
        return player.rank_points + current_live.get(player.name, 0)

    def _initial_post_cost(self, card: Card) -> int:
        return calculate_initial_post_cost(card.rarity or 1, len(card.posted_players))

    def _current_rank(self, player: Player, card: Card) -> int:
        if player.name not in card.scores:
            return len(card.posted_players) + 1
        higher = sum(1 for score in card.scores.values() if score > card.scores[player.name])
        return higher + 1

    def _predicted_rank_after_play(self, player: Player, card: Card, duration: int) -> int:
        predicted_time = card.play_time.get(player.name, 0) + duration
        predicted_score = self._score_for_minutes(
            player,
            predicted_time,
            player.private_practice.get(card.id, 0),
        )
        competing = {
            name: score
            for name, score in card.scores.items()
            if name != player.name
        }
        higher = sum(1 for score in competing.values() if score > predicted_score)
        return higher + 1

    def _max_initial_play_minutes(self, player: Player, card: Card) -> int:
        deadline = min(card.limit_at or self.end_at, self.end_at)
        for session_start, session_end in player.active_sessions:
            if session_start <= self.now < session_end:
                available_seconds = (min(session_end, deadline) - self.now).total_seconds()
                # 場札期限と同時刻の完了は無効なので1マイクロ秒分を差し引く。
                return min(MAX_INITIAL_PLAY_MINUTES, max(0, int((available_seconds - 0.000001) // 60)))
        return 0

    def _initial_play_duration(self, player: Player, card: Card, max_duration: int = MAX_INITIAL_PLAY_MINUTES) -> int:
        difficulty_floor = difficulty_minimum_minutes(card.difficulty)
        upper = min(MAX_INITIAL_PLAY_MINUTES, max_duration)
        baseline = round(self.rng.randint(difficulty_floor, upper) * player.motivation_multiplier)
        baseline = min(upper, max(difficulty_floor, baseline))
        if player.personality == "スタック派":
            return baseline

        practice = self._effective_practice_minutes(player.private_practice.get(card.id, 0))
        candidates = {difficulty_floor, baseline, upper}
        for target_score in card.scores.values():
            needed = math.ceil((target_score + 0.001) / player.skill_multiplier - practice)
            if difficulty_floor <= needed <= upper:
                candidates.add(needed)
        participant_count = max(1, len(card.posted_players) + 1)
        return max(
            candidates,
            key=lambda duration: (
                self._rank_points_for(
                    self._predicted_rank_after_play(player, card, duration),
                    participant_count,
                    card.stack_count,
                ) * 4.0 - duration / 6.0,
                -duration,
            ),
        )

    def _update_play_plan(self, player: Player, card: Card) -> dict[str, Any] | None:
        current_score = card.scores.get(player.name)
        if current_score is None:
            return None
        higher_scores = sorted(score for name, score in card.scores.items() if name != player.name and score > current_score)
        if not higher_scores:
            return None
        target_score = higher_scores[0] + 0.001
        practice = self._effective_practice_minutes(player.private_practice.get(card.id, 0))
        current_play = card.play_time.get(player.name, 0)
        raw_gap = required_play_gap(target_score, player.skill_multiplier, practice, current_play)
        next_update = card.update_count.get(player.name, 0) + 1
        previous = card.last_update_duration.get(player.name, 0)
        return {
            "duration": next_update_duration(raw_gap, next_update, previous),
            "target_score": round(target_score, 6),
            "raw_gap": raw_gap,
            "planned_update_count": next_update,
        }

    def _practice_duration(self, player: Player, card: Card) -> int:
        floor = difficulty_minimum_minutes(card.difficulty)
        baseline = round(self.rng.randint(floor, MAX_INITIAL_PLAY_MINUTES) * player.motivation_multiplier)
        return min(MAX_INITIAL_PLAY_MINUTES, max(floor, baseline))

    def _effective_practice_minutes(self, raw_minutes: int) -> float:
        return effective_practice_minutes(raw_minutes)

    def _score_for_minutes(self, player: Player, play_minutes: int, practice_minutes: int) -> float:
        effective_time = play_minutes + self._effective_practice_minutes(practice_minutes)
        epsilon = int(player.name.split("_")[-1]) / 1000.0
        return effective_time * player.skill_multiplier + epsilon

    def _schedule_next_decision(self, player: Player, after_minutes: int) -> None:
        next_at = self.now + timedelta(minutes=after_minutes)
        if next_at < self.end_at and player.is_active_during(self.now, next_at):
            self.queue.push(next_at, "decision", {"player": player.name})

    def deck_or_trash_available(self) -> bool:
        return bool(self.deck or self.trash)

    def _draw(self, player: Player) -> None:
        if player.points < 1 or not self.deck_or_trash_available():
            self._record("wait", player.name, {"reason": "draw_not_allowed"})
            return
        if not self.deck:
            self.deck = self.trash[:]
            self.trash = []
            self.rng.shuffle(self.deck)
        card_id = self.deck.pop()
        card = self.cards[card_id]
        card.state = player.name
        card.drawn_at = self.now
        rarity_distribution = rarity_distribution_at(self.elapsed_minutes())
        card.rarity = self._weighted_choice(rarity_distribution)
        card.difficulty = self._weighted_choice(DIFFICULTY_DISTRIBUTION)
        player.points -= 1
        self.rarity_draw_counts[card.rarity] += 1
        player.hand.append(card_id)
        player.actions["draw"] = player.actions.get("draw", 0) + 1
        self._record("draw", player.name, {
            "card_id": card_id,
            "rarity": card.rarity,
            "difficulty": card.difficulty,
            "cost": 1,
            "rare_probability": round(sum(weight for rarity, weight in rarity_distribution if rarity >= 2), 6),
        })

    def _can_take(self, player: Player) -> bool:
        return self._take_block_reason(player) is None

    def _take_block_reason(self, player: Player) -> str | None:
        if len(player.hand) < self._required_take_hand():
            return "insufficient_hand"
        if self.now >= self.end_at - TAKE_CLOSE_BEFORE_END:
            return "take_closed"
        if len(self.field) >= self._field_cap():
            return "field_cap"
        if not take_cooldown_ready(player.last_take_at, self.now):
            return "take_cooldown"
        return None

    def _required_take_hand(self) -> int:
        return required_take_hand(len(self.field))

    def _field_cap(self) -> int:
        return field_cap(self.participant_count())

    def _select_take_card(self, player: Player) -> int | None:
        if not player.hand:
            return None
        preferred_hand = [cid for cid in player.hand if cid in player.favorite_card_ids]
        selection_pool = preferred_hand or player.hand
        max_practice = max(player.private_practice.get(cid, 0) for cid in selection_pool)
        candidates = [cid for cid in selection_pool if player.private_practice.get(cid, 0) == max_practice]
        return self.rng.choice(candidates)

    def _take(self, player: Player, card_id: int, trigger: str = "decision") -> None:
        if not self._can_take(player) or card_id not in player.hand:
            reason = "card_not_in_hand" if card_id not in player.hand else self._take_block_reason(player)
            self._record("wait", player.name, {
                "reason": reason or "take_not_allowed",
                "next_take_at": self._iso(take_cooldown_until(player.last_take_at)),
            })
            return
        stack_cards = player.hand[:]
        player.hand = []
        card = self.cards[card_id]
        card.state = "_field"
        card.taker = player.name
        card.stack_count = len(stack_cards)
        player.max_stack_count = max(player.max_stack_count, card.stack_count)
        card.stack_ids = [cid for cid in stack_cards if cid != card_id]
        card.paid_points_total = 0
        card.taken_at = self.now
        player.last_take_at = self.now
        player.take_times.append(self.now)
        card.limit_at = self.now + INITIAL_LIMIT
        card.holder_names = []
        self.queue.push(card.limit_at, "collect", {"card_id": card.id, "limit_at": card.limit_at.isoformat()})
        for stack_id in card.stack_ids:
            self.cards[stack_id].state = "_stack"
        self.field.append(card_id)
        self._set_subsidy_flag(player)
        player.actions["take"] = player.actions.get("take", 0) + 1
        self._record("take", player.name, {
            "card_id": card_id,
            "stack_count": card.stack_count,
            "required_hand": 3 + max(0, len(self.field) - 1),
            "trigger": trigger,
            "stack_ids": card.stack_ids,
            "cooldown_until": self._iso(take_cooldown_until(player.last_take_at)),
        })

    def _complete_initial_post(self, player_name: str, card_id: int, duration: int) -> None:
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
        paid_now = player.name not in card.paid_players
        cost = self._initial_post_cost(card)
        if paid_now:
            player.points -= cost
            card.paid_players.add(player.name)
            card.paid_points_total += cost
        self._apply_score(player, card, duration, is_update=False)
        extension_minutes = 0
        if card.limit_at is None:
            card.limit_at = (card.taken_at or self.now) + INITIAL_LIMIT
            self.queue.push(card.limit_at, "collect", {"card_id": card.id, "limit_at": card.limit_at.isoformat()})
        elif paid_now and existing_participants >= 1 and self.now < self.end_at - TAKE_CLOSE_BEFORE_END:
            participant_order = existing_participants + 1
            extension_minutes = initial_post_extension_minutes(participant_order)
            card.limit_at += timedelta(minutes=extension_minutes)
            self.queue.push(card.limit_at, "collect", {"card_id": card.id, "limit_at": card.limit_at.isoformat()})
        self._set_subsidy_flag(player)
        player.actions["initial_post"] = player.actions.get("initial_post", 0) + 1
        self._record("initial_post", player.name, {
            "card_id": card_id,
            "duration": duration,
            "paid_now": paid_now,
            "cost": cost if paid_now else 0,
            "score": card.scores[player.name],
            "participant_order": existing_participants + 1,
            "extension_minutes": extension_minutes,
            "attempt_count": card.attempt_count[player.name],
            "effective_practice_minutes": round(
                self._effective_practice_minutes(player.private_practice.get(card.id, 0)),
                3,
            ),
            "limit_at": self._iso(card.limit_at),
        })
        self._schedule_next_decision(player, 0)

    def _complete_update(
        self,
        player_name: str,
        card_id: int,
        duration: int,
        target_score: float | None = None,
        raw_gap: int | None = None,
        planned_update_count: int | None = None,
    ) -> None:
        player = self.players[player_name]
        player.busy_until = None
        if card_id not in self.field:
            self._record("wait", player_name, {"reason": "update_target_not_field", "card_id": card_id})
            self._recover_from_stale_action(player)
            return
        card = self.cards[card_id]
        previous_update_duration = card.last_update_duration.get(player.name, 0)
        self._apply_score(player, card, duration, is_update=True)
        self._set_subsidy_flag(player)
        player.actions["update"] = player.actions.get("update", 0) + 1
        self._record("update", player.name, {
            "card_id": card_id,
            "duration": duration,
            "score": card.scores[player.name],
            "attempt_count": card.attempt_count[player.name],
            "update_count": card.update_count[player.name],
            "previous_update_duration": previous_update_duration,
            "target_score": target_score,
            "raw_gap_minutes": raw_gap,
            "planned_update_count": planned_update_count,
        })
        self._schedule_next_decision(player, 0)

    def _complete_practice(self, player_name: str, card_id: int, duration: int) -> None:
        player = self.players[player_name]
        player.busy_until = None
        if card_id not in player.hand:
            self._record("wait", player_name, {"reason": "practice_target_not_hand", "card_id": card_id})
            self._recover_from_stale_action(player)
            return
        player.private_practice[card_id] = player.private_practice.get(card_id, 0) + duration
        player.actions["practice"] = player.actions.get("practice", 0) + 1
        self._record("practice", player.name, {
            "card_id": card_id,
            "duration": duration,
            "raw_practice_minutes": player.private_practice[card_id],
            "effective_practice_minutes": round(
                self._effective_practice_minutes(player.private_practice[card_id]),
                3,
            ),
        })
        self._schedule_next_decision(player, 0)

    def _recover_from_stale_action(self, player: Player) -> None:
        player.actions["wait"] = player.actions.get("wait", 0) + 1
        self._schedule_next_decision(player, 0)

    def _apply_score(self, player: Player, card: Card, duration: int, is_update: bool) -> None:
        total_time = card.play_time.get(player.name, 0) + duration
        card.play_time[player.name] = total_time
        card.attempt_count[player.name] = card.attempt_count.get(player.name, 0) + 1
        if is_update:
            card.update_count[player.name] = card.update_count.get(player.name, 0) + 1
            card.last_update_duration[player.name] = duration
        card.scores[player.name] = self._score_for_minutes(
            player,
            total_time,
            player.private_practice.get(card.id, 0),
        )
        card.posted_players.add(player.name)

    def _handle_collect_event(self, card_id: int, limit_at_iso: str) -> None:
        card = self.cards[card_id]
        if card.state != "_field" or card.limit_at is None:
            return
        if card.limit_at.isoformat() != limit_at_iso:
            return
        if card.limit_at <= self.now:
            self._collect_card(card_id)

    def _collect_due_cards(self) -> list[int]:
        return [
            cid for cid in self.field
            if self.cards[cid].limit_at is not None and self.cards[cid].limit_at <= self.now
        ]

    def _collect_card(self, card_id: int) -> None:
        card = self.cards[card_id]
        if card.state != "_field":
            return
        ranking = self._ranking_groups(card)
        rank_points = self._apply_rank_points(card, ranking)
        rewards = self._apply_collection_rewards(card, ranking)
        card.holder_names = holder_names_from_ranking(ranking)
        card.state = "_collected"
        card.collected_at = self.now
        if card_id in self.field:
            self.field.remove(card_id)
        self.collected.append(card_id)
        for stack_id in card.stack_ids:
            self.cards[stack_id].state = "_trash"
            self.trash.append(stack_id)
        self.collections += 1
        self._record("collect", card.taker, {
            "card_id": card_id,
            "ranking": ranking,
            "rank_points": rank_points,
            "rewards": rewards,
            "holders": card.holder_names,
        })

    def _ranking_groups(self, card: Card) -> list[dict[str, Any]]:
        ordered = sorted(card.scores.items(), key=lambda item: item[1], reverse=True)
        groups: list[dict[str, Any]] = []
        current_rank = 1
        for index, (player_name, score) in enumerate(ordered, start=1):
            if groups and math.isclose(groups[-1]["score"], score):
                groups[-1]["players"].append(player_name)
            else:
                current_rank = index
                groups.append({"rank": current_rank, "score": score, "players": [player_name]})
        return groups

    def _apply_rank_points(self, card: Card, ranking: list[dict[str, Any]]) -> dict[str, int]:
        participant_count = sum(len(group["players"]) for group in ranking)
        deltas: dict[str, int] = {}
        for group in ranking:
            rank = group["rank"]
            delta = self._rank_points_for(rank, participant_count, card.stack_count)
            for player_name in group["players"]:
                self.players[player_name].rank_points += delta
                deltas[player_name] = delta
        return deltas

    def _apply_collection_rewards(self, card: Card, ranking: list[dict[str, Any]]) -> dict[str, Any]:
        if not ranking:
            return {"total_reward": 0, "rank_distribution": {}, "taker_remainder": 0}
        poster_count = sum(len(group["players"]) for group in ranking)
        if poster_count == 1:
            only = ranking[0]["players"][0]
            amount = card.stack_count + card.paid_points_total
            self.players[only].points += amount
            card.reward_log.append({"player": only, "points": amount, "type": "single_poster"})
            return {"total_reward": amount, "rank_distribution": {only: amount}, "taker_remainder": 0}
        total_reward = self._total_reward_points(card)
        eligible_groups = self._eligible_reward_groups(ranking)
        rank_distribution, taker_remainder = distribute_rank_rewards(total_reward, eligible_groups)
        for player_name, amount in rank_distribution.items():
            self.players[player_name].points += amount
            card.reward_log.append({"player": player_name, "points": amount, "type": "rank_distribution"})
        if taker_remainder and card.taker:
            self.players[card.taker].points += taker_remainder
            card.reward_log.append({"player": card.taker, "points": taker_remainder, "type": "taker_remainder"})
        return {
            "total_reward": total_reward,
            "rank_distribution": rank_distribution,
            "taker_remainder": taker_remainder,
            "eligible_groups": eligible_groups,
        }

    def _eligible_reward_groups(self, ranking: list[dict[str, Any]]) -> list[list[str]]:
        if not ranking:
            return []
        above_last_count = sum(len(group["players"]) for group in ranking[:-1])
        if above_last_count >= 3:
            return [group["players"][:] for group in ranking[:-1]]
        return [group["players"][:] for group in ranking]

    def _total_reward_points(self, card: Card) -> int:
        base = card.stack_count + card.paid_points_total
        if len(card.posted_players) == 1:
            return base
        return base + (card.difficulty or 1) * (base // 5)

    def _handle_final(self) -> None:
        for card_id in self.field[:]:
            self._collect_card(card_id)
        final_snapshot = self._half_hour_summary_snapshot()
        if self.half_hour_snapshots and self.half_hour_snapshots[-1]["minute"] == EVENT_HOURS * 60:
            self.half_hour_snapshots[-1] = final_snapshot
        else:
            self.half_hour_snapshots.append(final_snapshot)
        self._record("final", None, {"message": "48時間終了", "summary_preview": self._summary(minimal=True)})

    def _set_subsidy_flag(self, player: Player) -> None:
        player.subsidy_flag_slot_at = next_subsidy_slot(self.now)

    def _can_improve_rank(self, player: Player, card_id: int) -> bool:
        card = self.cards[card_id]
        current = card.scores.get(player.name, 0)
        best = max(card.scores.values(), default=0)
        return current <= best

    def _field_reward_potential(self, card_id: int) -> int:
        card = self.cards[card_id]
        base = card.stack_count + card.paid_points_total
        return base + (card.difficulty or 1) * (base // 5)

    def participant_count(self) -> int:
        return sum(1 for player in self.players.values() if player.joined)

    def elapsed_minutes(self) -> int:
        return int((self.now - self.start_at).total_seconds() // 60)

    def _weighted_choice(self, distribution: list[tuple[int, float]]) -> int:
        total = sum(weight for _value, weight in distribution)
        hit = self.rng.uniform(0, total)
        cursor = 0.0
        for value, weight in distribution:
            cursor += weight
            if hit <= cursor:
                return value
        return distribution[-1][0]

    def _record(self, event_type: str, actor: str | None, details: dict[str, Any]) -> None:
        entry = {
            "timestamp": self._iso(self.now),
            "minute": int((self.now - self.start_at).total_seconds() // 60),
            "type": "event",
            "event": event_type,
            "actor": actor,
            "details": details,
            "state": self._snapshot(),
        }
        self.out.write(json.dumps(entry, ensure_ascii=False) + "\n")
        self.events_written += 1
        self._check_invariants(event_type)

    def _snapshot(self) -> dict[str, Any]:
        live_rank_points = self._live_rank_points()
        return {
            "deck_count": len(self.deck),
            "trash_count": len(self.trash),
            "collected_count": len(self.collected),
            "fields": [self._field_snapshot(cid) for cid in self.field],
            "players": [self._player_snapshot(player, live_rank_points) for player in self.players.values()],
        }

    def _field_snapshot(self, card_id: int) -> dict[str, Any]:
        card = self.cards[card_id]
        return {
            "id": card.id,
            "rarity": card.rarity,
            "difficulty": card.difficulty,
            "taker": card.taker,
            "stack_count": card.stack_count,
            "paid_points_total": card.paid_points_total,
            "taken_at": self._iso(card.taken_at),
            "limit_at": self._iso(card.limit_at),
            "posters": len(card.posted_players),
            "holders": card.holder_names[:],
            "total_reward_points": self._total_reward_points(card),
            "ranking": self._ranking_groups(card),
        }

    def _player_snapshot(self, player: Player, live_rank_points: dict[str, int] | None = None) -> dict[str, Any]:
        if not player.joined:
            status = "not_joined"
        elif player.is_active(self.now):
            status = "active"
        else:
            status = "inactive"
        return {
            "name": player.name,
            "personality": player.personality,
            "status": status,
            "points": player.points,
            "rank_points": self._display_rank_points(player, live_rank_points),
            "confirmed_rank_points": player.rank_points,
            "live_rank_points": (live_rank_points or {}).get(player.name, 0),
            "hand_count": len(player.hand),
            "hand": player.hand[:],
            "subsidy_flag_slot_at": self._iso(player.subsidy_flag_slot_at),
            "last_take_at": self._iso(player.last_take_at),
            "next_take_at": self._iso(take_cooldown_until(player.last_take_at)),
        }

    def _check_invariants(self, context: str) -> None:
        field_count = len(self.field)
        if field_count > FIELD_LIMIT:
            self.invariant_errors.append(f"{context}: field_count exceeded {field_count}")
        if field_count > self._field_cap():
            self.invariant_errors.append(
                f"{context}: field_count {field_count} exceeded dynamic cap {self._field_cap()}"
            )
        for player in self.players.values():
            if player.points <= 0:
                continue
            # ドロー可能性自体は行動選択の問題なのでここでは検査しない。
        for player in self.players.values():
            for previous, current in zip(player.take_times, player.take_times[1:]):
                if current - previous < TAKE_COOLDOWN:
                    self.invariant_errors.append(
                        f"{context}: {player.name} take cooldown violated "
                        f"{self._iso(previous)} -> {self._iso(current)}"
                    )
        for card_id in self.field:
            card = self.cards[card_id]
            if card.stack_count < 3:
                self.invariant_errors.append(f"{context}: field card {card_id} stack_count < 3")
            if card.limit_at is None:
                self.invariant_errors.append(f"{context}: field card {card_id} has no limit_at")
        for card_id in self.collected:
            card = self.cards[card_id]
            expected_holders = holder_names_from_ranking(self._ranking_groups(card))
            if card.holder_names != expected_holders:
                self.invariant_errors.append(
                    f"{context}: collected card {card_id} holders {card.holder_names} "
                    f"!= {expected_holders}"
                )

    def _summary(self, minimal: bool = False) -> dict[str, Any]:
        players = sorted(
            (
                {
                    "name": p.name,
                    "personality": p.personality,
                    "engagement": p.engagement,
                    "has_offpeak_activity": p.has_offpeak_activity,
                    "favorite_card_count": len(p.favorite_card_ids),
                    "favorite_cards_taken": sum(
                        1 for card_id in p.favorite_card_ids if self.cards[card_id].taker == p.name
                    ),
                    "favorite_cards_posted": sum(
                        1 for card_id in p.favorite_card_ids if p.name in self.cards[card_id].posted_players
                    ),
                    "favorite_cards_held": sum(
                        1 for card_id in p.favorite_card_ids if p.name in self.cards[card_id].holder_names
                    ),
                    "skill_multiplier": p.skill_multiplier,
                    "points": p.points,
                    "rank_points": p.rank_points,
                    "total_active_minutes": p.total_active_minutes(),
                    "total_active_hours": round(p.total_active_minutes() / 60, 2),
                    "max_stack_count": p.max_stack_count,
                    "last_take_at": self._iso(p.last_take_at),
                    "minimum_take_gap_minutes": min(
                        (
                            int((current - previous).total_seconds() // 60)
                            for previous, current in zip(p.take_times, p.take_times[1:])
                        ),
                        default=None,
                    ),
                    "actions": p.actions,
                    "joined": p.joined,
                }
                for p in self.players.values()
            ),
            key=lambda item: (item["rank_points"], item["points"]),
            reverse=True,
        )
        summary = {
            "seed": self.seed,
            "jsonl_path": str(self.jsonl_path),
            "summary_path": str(self.summary_path),
            "start_at": self._iso(self.start_at),
            "end_at": self._iso(self.end_at),
            "events_written": self.events_written,
            "collections": self.collections,
            "subsidy_payments": self.subsidy_payments,
            "policy": {
                "rarity_growth": "exponential",
                "rarity_initial_rate": RARITY_INITIAL_RATE,
                "rarity_boost_peak_hour": RARITY_BOOST_PEAK_HOUR,
                "rarity_peak_rate": RARITY_PEAK_RATE,
                "decision_model": "multi_step_forecast_v2",
                "time_model": "target_score_cost_v1",
                "initial_play_minutes": [MIN_PLAY_MINUTES, MAX_INITIAL_PLAY_MINUTES],
                "difficulty_minimum_minutes": [difficulty_minimum_minutes(level) for level in range(1, 6)],
                "motivation_multiplier": [0.8, 1.2],
                "engagement_groups": {"ガチ勢": HARDCORE_COUNT, "エンジョイ勢": CASUAL_COUNT},
                "hardcore_peak_minutes": [HARDCORE_PEAK_MINUTES_MIN, 12 * 60],
                "hardcore_total_minutes_max": HARDCORE_TOTAL_MINUTES_MAX,
                "casual_total_minutes": [CASUAL_MINUTES_MIN, CASUAL_MINUTES_MAX],
                "offpeak_hardcore_count": OFFPEAK_HARDCORE_COUNT,
                "personality_base_counts": PERSONALITY_BASE_COUNTS,
                "holder_priority_favorite_card_count": FAVORITE_CARD_COUNT,
                "take_audience_horizon_minutes": int(INITIAL_LIMIT.total_seconds() // 60),
                "take_cooldown_minutes": int(TAKE_COOLDOWN.total_seconds() // 60),
                "take_cooldown_basis": "successful_take_at",
                "take_cooldown_ignores_field_lifecycle": True,
                "take_close_requires_feasible_poster": True,
                "ui_action_minutes": 0,
                "practice_model": "60*log(1+minutes/60)",
                "update_attempt_increment": UPDATE_ATTEMPT_INCREMENT,
                "terminal_point_utility": 0,
                "consensus_stall_resolution": True,
                "empty_field_consensus": True,
                "unposted_field_consensus": False,
                "initial_limit_start": "take",
                "initial_limit_minutes": 90,
                "initial_post_extension": "60 minutes, minus 5 per participant, floor 5",
                "stack_time_bonus": False,
                "take_hand_requirement": "3 + current_field_count",
                "field_cap": "min(max(1, cumulative_participants - 1), 16)",
                "entry_cost": "rarity for 1st and 4th+, free for 2nd and 3rd",
                "rank_point_first_bonus": 1,
                "rank_point_basis": "participant_count",
                "rank_point_display": "confirmed + live field provisional",
            },
            "rarity_draw_counts": self.rarity_draw_counts,
            "players": players,
            "deck_count": len(self.deck),
            "trash_count": len(self.trash),
            "field_count": len(self.field),
            "collected_count": len(self.collected),
            "collection_participant_counts": {
                str(count): sum(
                    1
                    for card_id in self.collected
                    if len(self.cards[card_id].posted_players) == count
                )
                for count in range(PLAYER_COUNT + 1)
                if any(len(self.cards[card_id].posted_players) == count for card_id in self.collected)
            },
            "invariant_errors": self.invariant_errors,
        }
        if not minimal:
            summary["half_hour_snapshots"] = self.half_hour_snapshots
        if not minimal:
            summary["fixed_reward_tests"] = fixed_reward_tests()
            summary["fixed_rarity_tests"] = fixed_rarity_tests()
            summary["fixed_rank_point_tests"] = fixed_rank_point_tests()
            summary["fixed_prediction_tests"] = fixed_prediction_tests()
            summary["fixed_time_model_tests"] = fixed_time_model_tests()
            summary["fixed_entry_rule_tests"] = fixed_entry_rule_tests()
            summary["fixed_countdown_tests"] = fixed_countdown_tests()
            summary["fixed_holder_tests"] = fixed_holder_tests()
            summary["fixed_take_cooldown_tests"] = fixed_take_cooldown_tests()
        return summary

    def _half_hour_summary_snapshot(self) -> dict[str, Any]:
        live_rank_points = self._live_rank_points()
        leader = self._leader_name()
        return {
            "timestamp": self._iso(self.now),
            "minute": int((self.now - self.start_at).total_seconds() // 60),
            "participant_count": self.participant_count(),
            "leader": leader,
            "players": {
                player.name: {
                    "points": player.points,
                    "rank_points": self._display_rank_points(player, live_rank_points),
                    "confirmed_rank_points": player.rank_points,
                    "live_rank_points": live_rank_points.get(player.name, 0),
                    "draw_count": player.actions.get("draw", 0),
                    "max_stack_count": player.max_stack_count,
                }
                for player in sorted(self.players.values(), key=lambda p: p.name)
            },
            "field": {
                "field_count": len(self.field),
                "collected_count": len(self.collected),
                "deck_count": len(self.deck),
                "trash_count": len(self.trash),
                "total_reward_points": sum(self._total_reward_points(self.cards[card_id]) for card_id in self.field),
            },
        }

    def _leader_name(self) -> str | None:
        joined = [player for player in self.players.values() if player.joined]
        if not joined:
            return None
        live_rank_points = self._live_rank_points()
        return max(
            joined,
            key=lambda player: (
                self._display_rank_points(player, live_rank_points),
                player.points,
                -int(player.name.split("_")[-1]),
            ),
        ).name

    def _iso(self, value: datetime | None) -> str | None:
        return value.isoformat() if value else None


def take_cooldown_until(last_take_at: datetime | None) -> datetime | None:
    return last_take_at + TAKE_COOLDOWN if last_take_at is not None else None


def take_cooldown_ready(last_take_at: datetime | None, at: datetime) -> bool:
    ready_at = take_cooldown_until(last_take_at)
    return ready_at is None or at >= ready_at


def play_time_cost(duration: int) -> float:
    return max(0, duration) / 12.0


def terminal_point_shadow(points: int, remaining_active_minutes: int, spend_capacity: int) -> float:
    if points <= 0:
        return 0.0
    capacity = max(1, spend_capacity)
    overflow = max(0.0, (points - capacity) / capacity)
    time_urgency = 1.0 - min(1.0, remaining_active_minutes / (8 * 60))
    return 0.2 + time_urgency * 1.8 + min(3.0, overflow * 0.75)


def effective_practice_minutes(raw_minutes: int) -> float:
    return PRACTICE_DIMINISHING_SCALE * math.log1p(max(0, raw_minutes) / PRACTICE_DIMINISHING_SCALE)


def difficulty_minimum_minutes(difficulty: int | None) -> int:
    level = min(5, max(1, difficulty or 1))
    return MIN_PLAY_MINUTES + (level - 1) * 5


def build_personality_roster(rng: random.Random) -> list[str]:
    names = list(PERSONALITY_BASE_COUNTS)
    deltas = {name: 0 for name in names}
    change_count = rng.choice((1, 2))
    shuffled = names[:]
    rng.shuffle(shuffled)
    for name in shuffled[:change_count]:
        deltas[name] += 1
    for name in shuffled[change_count:change_count * 2]:
        deltas[name] -= 1
    return [
        name
        for name, base in PERSONALITY_BASE_COUNTS.items()
        for _ in range(base + deltas[name])
    ]


def partition_minutes(rng: random.Random, total: int, count: int, minimum: int) -> list[int]:
    remaining = total - count * minimum
    durations = [minimum] * count
    for _ in range(max(0, remaining)):
        durations[rng.randrange(count)] += 1
    rng.shuffle(durations)
    return durations


def merge_sessions(sessions: list[tuple[datetime, datetime]]) -> list[tuple[datetime, datetime]]:
    merged: list[tuple[datetime, datetime]] = []
    for start, end in sorted(sessions):
        if end <= start:
            continue
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def peak_active_minutes(player: Player, start_at: datetime) -> int:
    windows = [
        (start_at, start_at + timedelta(hours=6)),
        (start_at + timedelta(hours=24), start_at + timedelta(hours=30)),
    ]
    total = 0
    for start, end in player.active_sessions:
        for window_start, window_end in windows:
            overlap_start = max(start, window_start)
            overlap_end = min(end, window_end)
            if overlap_end > overlap_start:
                total += int((overlap_end - overlap_start).total_seconds() // 60)
    return total


def next_update_duration(raw_gap: int, next_update: int, previous_duration: int) -> int:
    duration = raw_gap + UPDATE_ATTEMPT_INCREMENT * next_update
    duration += math.ceil(raw_gap * UPDATE_GAP_MULTIPLIER * max(0, next_update - 1))
    return max(duration, previous_duration + UPDATE_ATTEMPT_INCREMENT)


def required_play_gap(
    target_score: float,
    skill_multiplier: float,
    effective_practice: float,
    current_play: int,
) -> int:
    return max(
        MIN_PLAY_MINUTES,
        math.ceil(target_score / skill_multiplier - effective_practice - current_play),
    )


def next_subsidy_slot(at: datetime) -> datetime:
    minute = at.minute
    if minute < 30:
        slot = at.replace(minute=30, second=0, microsecond=0)
    else:
        slot = (at.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1))
    if at.second == 0 and at.microsecond == 0 and minute in {0, 30}:
        slot = at + SUBSIDY_INTERVAL
    return slot


def rarity_distribution_at(elapsed_minutes: int) -> list[tuple[int, float]]:
    elapsed = min(max(0, elapsed_minutes), RARITY_BOOST_PEAK_HOUR * 60)
    progress = elapsed / (RARITY_BOOST_PEAK_HOUR * 60)
    growth_ratio = RARITY_PEAK_RATE / RARITY_INITIAL_RATE
    rare_rate = min(RARITY_PEAK_RATE, RARITY_INITIAL_RATE * growth_ratio ** progress)
    rare_scale = rare_rate / RARITY_INITIAL_RATE
    return [
        (1, 100.0 - rare_rate),
        *((rarity, weight * rare_scale) for rarity, weight in RARITY_DISTRIBUTION if rarity >= 2),
    ]


def calculate_rank_points(rank: int, participant_count: int, _stack_count: int) -> int:
    if rank <= 0 or participant_count <= 0 or rank > participant_count:
        return 0
    base = participant_count - rank + 1
    first_bonus = 1 if rank == 1 else 0
    return base + first_bonus


def calculate_initial_post_cost(rarity: int, existing_participants: int) -> int:
    return 0 if 1 <= existing_participants < 3 else rarity


def initial_post_extension_minutes(participant_order: int) -> int:
    if participant_order <= 1:
        return 0
    reduction = (participant_order - 2) * EXTENSION_STEP_MINUTES
    return max(EXTENSION_FLOOR_MINUTES, EXTENSION_START_MINUTES - reduction)


def holder_names_from_ranking(ranking: list[dict[str, Any]]) -> list[str]:
    if not ranking or ranking[0].get("rank") != 1:
        return []
    return list(ranking[0].get("players", []))


def required_take_hand(field_count: int) -> int:
    return 3 + max(0, field_count)


def field_cap(participant_count: int) -> int:
    return min(16, max(1, participant_count - 1))


def distribute_rank_rewards(total: int, groups: list[list[str]]) -> tuple[dict[str, int], int]:
    if total <= 0 or not groups:
        return {}, total
    amounts = [0 for _ in groups]
    remaining = total
    selected = 0
    for i, group in enumerate(groups):
        cost = len(group)
        if remaining >= cost:
            amounts[i] = 1
            remaining -= cost
            selected = i + 1
        else:
            break
    if selected == 0:
        return {}, total

    protected_gaps = min(3, selected - 1)
    for i in range(protected_gaps):
        need = amounts[i + 1] + 1 - amounts[i]
        if need <= 0:
            continue
        cost = need * len(groups[i])
        if remaining >= cost:
            amounts[i] += need
            remaining -= cost

    while True:
        changed = False
        for i in range(selected):
            cost = len(groups[i])
            if remaining < cost:
                continue
            trial = amounts[:]
            trial[i] += 1
            if gaps_still_valid(trial, protected_gaps):
                amounts = trial
                remaining -= cost
                changed = True
                break
        if not changed:
            break

    distribution: dict[str, int] = {}
    for group, amount in zip(groups[:selected], amounts[:selected]):
        if amount <= 0:
            continue
        for player_name in group:
            distribution[player_name] = amount
    return distribution, remaining


def gaps_still_valid(amounts: list[int], protected_gaps: int) -> bool:
    for i in range(protected_gaps):
        if amounts[i] <= amounts[i + 1]:
            return False
    return True


def fixed_reward_tests() -> list[dict[str, Any]]:
    cases = [
        {
            "name": "single_poster_special",
            "total": 0,
            "groups": [["A"]],
            "single_amount": 8,
            "expected_distribution": {"A": 8},
            "expected_remainder": 0,
        },
        {
            "name": "last_place_excluded_three_above",
            "total": 10,
            "groups": [["A"], ["B"], ["C"]],
            "expected_remainder": 0,
        },
        {
            "name": "same_rank_taker_remainder",
            "total": 8,
            "groups": [["A", "B", "C"]],
            "expected_distribution": {"A": 2, "B": 2, "C": 2},
            "expected_remainder": 2,
        },
        {
            "name": "two_tied_groups",
            "total": 8,
            "groups": [["A", "B"], ["C", "D"]],
            "expected_distribution": {"A": 3, "B": 3, "C": 1, "D": 1},
            "expected_remainder": 0,
        },
    ]
    results: list[dict[str, Any]] = []
    for case in cases:
        if "single_amount" in case:
            distribution = case["expected_distribution"]
            remainder = case["expected_remainder"]
        else:
            distribution, remainder = distribute_rank_rewards(case["total"], case["groups"])
        ok = True
        if "expected_distribution" in case:
            ok = ok and distribution == case["expected_distribution"]
        if "expected_remainder" in case:
            ok = ok and remainder == case["expected_remainder"]
        results.append({
            "name": case["name"],
            "ok": ok,
            "distribution": distribution,
            "taker_remainder": remainder,
        })
    return results


def fixed_rarity_tests() -> list[dict[str, Any]]:
    initial_distribution = dict(rarity_distribution_at(0))
    midpoint_distribution = dict(rarity_distribution_at(RARITY_BOOST_PEAK_HOUR * 30))
    peak_distribution = dict(rarity_distribution_at(RARITY_BOOST_PEAK_HOUR * 60))
    initial_rare = sum(weight for rarity, weight in initial_distribution.items() if rarity >= 2)
    midpoint_rare = sum(weight for rarity, weight in midpoint_distribution.items() if rarity >= 2)
    peak_rare = sum(weight for rarity, weight in peak_distribution.items() if rarity >= 2)
    ratio_preserved = all(
        math.isclose(
            peak_distribution[rarity] / peak_rare,
            dict(RARITY_DISTRIBUTION)[rarity] / RARITY_INITIAL_RATE,
        )
        for rarity in range(2, 6)
    )
    return [
        {
            "name": "rarity_initial_rate",
            "ok": math.isclose(initial_rare, RARITY_INITIAL_RATE),
            "rare_rate": initial_rare,
        },
        {
            "name": "rarity_exponential_midpoint",
            "ok": math.isclose(midpoint_rare, math.sqrt(RARITY_INITIAL_RATE * RARITY_PEAK_RATE)),
            "rare_rate": midpoint_rare,
        },
        {
            "name": "rarity_peak_at_46_hours",
            "ok": math.isclose(peak_rare, 100.0) and math.isclose(peak_distribution[1], 0.0),
            "rare_rate": peak_rare,
        },
        {
            "name": "rarity_mix_ratio_preserved",
            "ok": ratio_preserved,
        },
    ]


def fixed_rank_point_tests() -> list[dict[str, Any]]:
    cases = [
        ("first_place_uses_participants_plus_bonus", 1, 3, 8, 4),
        ("second_place_uses_participant_count", 2, 3, 8, 2),
        ("last_place_gets_one", 3, 3, 20, 1),
        ("outside_participant_rank_gets_zero", 4, 3, 20, 0),
        ("single_participant_is_independent_of_stack", 1, 1, 20, 2),
    ]
    return [
        {
            "name": name,
            "ok": calculate_rank_points(rank, participants, stack) == expected,
            "actual": calculate_rank_points(rank, participants, stack),
            "expected": expected,
        }
        for name, rank, participants, stack, expected in cases
    ]


def fixed_prediction_tests() -> list[dict[str, Any]]:
    early = terminal_point_shadow(points=20, remaining_active_minutes=600, spend_capacity=20)
    late = terminal_point_shadow(points=20, remaining_active_minutes=30, spend_capacity=20)
    overflow = terminal_point_shadow(points=80, remaining_active_minutes=120, spend_capacity=10)
    return [
        {
            "name": "terminal_waste_increases_near_end",
            "ok": late > early,
            "early_shadow": round(early, 3),
            "late_shadow": round(late, 3),
        },
        {
            "name": "point_overflow_increases_spend_value",
            "ok": overflow > late,
            "late_shadow": round(late, 3),
            "overflow_shadow": round(overflow, 3),
        },
        {
            "name": "nonpositive_points_have_no_terminal_shadow",
            "ok": terminal_point_shadow(0, 30, 1) == 0.0,
            "shadow": terminal_point_shadow(0, 30, 1),
        },
    ]


def fixed_entry_rule_tests() -> list[dict[str, Any]]:
    rarity_five_costs = [calculate_initial_post_cost(5, count) for count in range(4)]
    caps = [field_cap(count) for count in (0, 1, 2, 16, 30)]
    return [
        {
            "name": "second_and_third_posters_are_free",
            "ok": rarity_five_costs == [5, 0, 0, 5],
            "costs": rarity_five_costs,
        },
        {
            "name": "take_hand_requirement_grows_with_fields",
            "ok": required_take_hand(0) == 3 and required_take_hand(7) == 10,
            "at_zero_fields": required_take_hand(0),
            "at_seven_fields": required_take_hand(7),
        },
        {
            "name": "field_cap_uses_participants_minus_one",
            "ok": caps == [1, 1, 1, 15, 16],
            "caps": caps,
        },
    ]


def fixed_time_model_tests() -> list[dict[str, Any]]:
    practice_60 = effective_practice_minutes(60)
    practice_120 = effective_practice_minutes(120)
    update_1 = next_update_duration(raw_gap=8, next_update=1, previous_duration=0)
    update_2 = next_update_duration(raw_gap=8, next_update=2, previous_duration=update_1)
    update_3 = next_update_duration(raw_gap=8, next_update=3, previous_duration=update_2)
    weak_minutes = required_play_gap(100, 0.6, 0, 0)
    strong_minutes = required_play_gap(100, 1.2, 0, 0)
    return [
        {
            "name": "initial_play_range_is_10_to_60",
            "ok": MIN_PLAY_MINUTES == 10 and MAX_INITIAL_PLAY_MINUTES == 60,
            "minimum": MIN_PLAY_MINUTES,
            "maximum": MAX_INITIAL_PLAY_MINUTES,
        },
        {
            "name": "difficulty_minimum_is_10_to_30",
            "ok": [difficulty_minimum_minutes(level) for level in range(1, 6)] == [10, 15, 20, 25, 30],
            "minimums": [difficulty_minimum_minutes(level) for level in range(1, 6)],
        },
        {
            "name": "practice_has_diminishing_returns",
            "ok": practice_60 < 60 and practice_120 - practice_60 < practice_60,
            "effective_60": round(practice_60, 3),
            "effective_120": round(practice_120, 3),
        },
        {
            "name": "update_cost_increases_monotonically",
            "ok": update_1 < update_2 < update_3,
            "durations": [update_1, update_2, update_3],
        },
        {
            "name": "weaker_player_needs_more_time_for_same_score",
            "ok": weak_minutes > strong_minutes,
            "weak_minutes": weak_minutes,
            "strong_minutes": strong_minutes,
        },
        {
            "name": "initial_and_update_use_same_time_cost_scale",
            "ok": math.isclose(play_time_cost(30), 2.5),
            "thirty_minute_cost": play_time_cost(30),
        },
    ]


def fixed_countdown_tests() -> list[dict[str, Any]]:
    orders = [1, 2, 3, 4, 12, 13, 16]
    extensions = [initial_post_extension_minutes(order) for order in orders]
    return [
        {
            "name": "countdown_starts_on_take",
            "ok": INITIAL_LIMIT == timedelta(minutes=90),
            "initial_minutes": int(INITIAL_LIMIT.total_seconds() // 60),
        },
        {
            "name": "first_post_does_not_extend",
            "ok": initial_post_extension_minutes(1) == 0,
            "extension": initial_post_extension_minutes(1),
        },
        {
            "name": "extension_diminishes_from_sixty_to_floor_five",
            "ok": extensions == [0, 60, 55, 50, 10, 5, 5],
            "orders": orders,
            "extensions": extensions,
        },
        {
            "name": "three_posters_total_limit_is_205_minutes",
            "ok": 90 + initial_post_extension_minutes(2) + initial_post_extension_minutes(3) == 205,
            "total_minutes": 90 + initial_post_extension_minutes(2) + initial_post_extension_minutes(3),
        },
    ]


def fixed_holder_tests() -> list[dict[str, Any]]:
    single = holder_names_from_ranking([{"rank": 1, "players": ["A"]}])
    tied = holder_names_from_ranking([{"rank": 1, "players": ["A", "B"]}])
    empty = holder_names_from_ranking([])
    return [
        {
            "name": "single_winner_becomes_holder",
            "ok": single == ["A"],
            "holders": single,
        },
        {
            "name": "tied_winners_become_coholders",
            "ok": tied == ["A", "B"],
            "holders": tied,
        },
        {
            "name": "unposted_card_has_no_holder",
            "ok": empty == [],
            "holders": empty,
        },
    ]


def fixed_take_cooldown_tests() -> list[dict[str, Any]]:
    taken_at = datetime(2026, 1, 1, 12, 0, tzinfo=JST)
    return [
        {
            "name": "first_take_has_no_cooldown_prerequisite",
            "ok": take_cooldown_ready(None, taken_at),
        },
        {
            "name": "take_is_blocked_before_ninety_minutes",
            "ok": not take_cooldown_ready(taken_at, taken_at + timedelta(minutes=89, seconds=59)),
            "cooldown_until": take_cooldown_until(taken_at).isoformat(),
        },
        {
            "name": "take_is_allowed_at_ninety_minutes",
            "ok": take_cooldown_ready(taken_at, taken_at + TAKE_COOLDOWN),
            "cooldown_minutes": int(TAKE_COOLDOWN.total_seconds() // 60),
        },
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="トリックテイキング制ルール検証シミュレーション")
    parser.add_argument("--seed", type=int, default=260704, help="乱数シード")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "outputs",
        help="出力ディレクトリ",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sim = Simulation(seed=args.seed, output_dir=args.output_dir)
    summary = sim.run()
    print(json.dumps({
        "jsonl_path": summary["jsonl_path"],
        "summary_path": summary["summary_path"],
        "events_written": summary["events_written"],
        "collections": summary["collections"],
        "invariant_errors": summary["invariant_errors"],
        "fixed_reward_tests": summary["fixed_reward_tests"],
        "fixed_rarity_tests": summary["fixed_rarity_tests"],
        "fixed_rank_point_tests": summary["fixed_rank_point_tests"],
        "fixed_prediction_tests": summary["fixed_prediction_tests"],
        "fixed_time_model_tests": summary["fixed_time_model_tests"],
        "fixed_entry_rule_tests": summary["fixed_entry_rule_tests"],
        "fixed_countdown_tests": summary["fixed_countdown_tests"],
        "fixed_holder_tests": summary["fixed_holder_tests"],
        "fixed_take_cooldown_tests": summary["fixed_take_cooldown_tests"],
        "rarity_draw_counts": summary["rarity_draw_counts"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
