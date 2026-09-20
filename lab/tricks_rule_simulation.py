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
import os
import random
import statistics
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
INITIAL_LIMIT = timedelta(minutes=60)
TAKE_COOLDOWN = timedelta(minutes=90)
ALL_FIELD_FIRST_POLICIES = {"all_field_first", "all_field_first_endgame_free"}
ENDGAME_FREE_POLICIES = {"endgame_free", "all_field_first_endgame_free"}
POST_CREDIT_POLICIES = {"post_credit"}
TAKE_COOLDOWN_POLICIES = {
    "baseline",
    *ALL_FIELD_FIRST_POLICIES,
    *ENDGAME_FREE_POLICIES,
    *POST_CREDIT_POLICIES,
}
ENDGAME_FREE_BEFORE_END = timedelta(minutes=150)
POST_COOLDOWN_CREDIT_MINUTES = 15
FIRST_POST_EXTENSION_MINUTES = 15
LATE_FIRST_POST_EXTENSION_MINUTES = 30
LATE_FIRST_POST_THRESHOLD_MINUTES = 15
SUBSEQUENT_POST_EXTENSION_MINUTES = 10
SUBSIDY_INTERVAL = timedelta(minutes=30)
RARITY_BOOST_PEAK_HOUR = 46
RARITY_INITIAL_RATE = 10.0
RARITY_PEAK_RATE = 100.0
STACK_TARGET_HAND = 14
RATIONAL_STACK_SURPLUS_CAP = 4
PARTICIPANT_CREATOR_CARD_RATE = 0.25
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
RETURN_TO_DECK_COST = 1
RETURN_SUBSIDY_FLAG_THRESHOLD = 4
PLAYER_EXTENSION_COST = 1
PLAYER_EXTENSION_MINUTES = 15
PLAYER_EXTENSION_CUTOFF = timedelta(hours=1)
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

SKILL_TIER_ORDER = {"other": 0, "Y": 1, "X": 2}
POINT_RETURN_SENSITIVE_PERSONALITIES = {"正統派", "投稿優先派"}
POST_COST_POLICIES = {
    "second_third_free",
    "first_second_free",
    "first_second_free_difficulty",
    "taker_initial_and_retries_paid",
}
PAID_UPDATE_POLICIES = {"legacy", "rank_point_roi"}
MIN_PAID_UPDATE_RANK_POINTS_PER_POINT = 0.5
REWARD_FORMULAS = {"current", "balanced", "proposal"}
BEHAVIOR_POLICIES = {"legacy", "commitment_aware"}
ACTIVITY_POLICIES = {"legacy", "peak_engagement"}
SCORE_POLICIES = {"tier_deterministic", "stochastic_card_skill"}
REMAINDER_POLICIES = {"taker", "last_poster"}
SCORE_TIER_BASE = {"X": 110.0, "Y": 100.0, "other": 89.0}
SCORE_SKILL_EFFICIENCY = {"X": 1.35, "Y": 1.1, "other": 0.9}
SCORE_TRIAL_NOISE = 18.0
SCORE_SKILL_POINT_PER_MINUTE = 0.18
MAX_FIELD_SCORE_TRIALS = 6
PERSONALITY_CONTINUOUS_HOURS = {
    "投稿優先派": 5,
    "スタック派": 3,
    "ホルダー優先派": 4,
    "正統派": 4,
    "ネガティブ派": 2,
}
TAKE_DESIRE_THRESHOLDS = {
    "投稿優先派": 1.70,
    "スタック派": 1.85,
    "ホルダー優先派": 1.35,
    "正統派": 1.55,
    "ネガティブ派": 1.45,
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
    late_first_extension: bool = False
    paid_points_total: int = 0
    paid_points_by_player: dict[str, int] = field(default_factory=dict)
    paid_extension_points_total: int = 0
    extension_counts_by_player: dict[str, int] = field(default_factory=dict)
    extension_players: set[str] = field(default_factory=set)
    taken_at: datetime | None = None
    drawn_at: datetime | None = None
    limit_at: datetime | None = None
    collected_at: datetime | None = None
    holder_names: list[str] = field(default_factory=list)
    scores: dict[str, float] = field(default_factory=dict)
    play_time: dict[str, int] = field(default_factory=dict)
    attempt_count: dict[str, int] = field(default_factory=dict)
    trial_count: dict[str, int] = field(default_factory=dict)
    update_count: dict[str, int] = field(default_factory=dict)
    last_update_duration: dict[str, int] = field(default_factory=dict)
    posted_players: set[str] = field(default_factory=set)
    paid_players: set[str] = field(default_factory=set)
    reward_log: list[dict[str, Any]] = field(default_factory=list)
    draw_history: list[str] = field(default_factory=list)
    return_history: list[str] = field(default_factory=list)
    practiced_before_return: bool = False
    pending_returned_by: str | None = None
    creator_name: str | None = None
    pot_bonus_points: int = 0


@dataclass
class Player:
    name: str
    personality: str
    engagement: str
    join_at: datetime
    active_sessions: list[tuple[datetime, datetime]]
    skill_multiplier: float
    motivation_multiplier: float
    skill_tier: str = "other"
    max_continuous_hours: int = 3
    favorite_card_ids: set[int] = field(default_factory=set)
    has_offpeak_activity: bool = False
    points: int = 0
    max_points: int = 0
    rank_points: int = 0
    hand: list[int] = field(default_factory=list)
    joined: bool = False
    subsidy_flag_slot_at: datetime | None = None
    last_subsidy_paid_slot_at: datetime | None = None
    private_practice: dict[int, int] = field(default_factory=dict)
    card_skill_minutes: dict[int, float] = field(default_factory=dict)
    attachment_reasons: dict[int, set[str]] = field(default_factory=dict)
    actions: dict[str, int] = field(default_factory=dict)
    max_stack_count: int = 0
    busy_until: datetime | None = None
    last_take_at: datetime | None = None
    take_times: list[datetime] = field(default_factory=list)
    cooldown_credit_minutes: int = 0
    cooldown_released_take_at: datetime | None = None
    relaxed_take_times: list[datetime] = field(default_factory=list)
    take_stack_counts: list[int] = field(default_factory=list)
    take_costs: list[int] = field(default_factory=list)

    def is_active(self, at: datetime) -> bool:
        if not self.joined:
            return False
        return any(start <= at < end for start, end in self.active_sessions)

    def is_active_during(self, start_at: datetime, end_at: datetime) -> bool:
        return any(start <= start_at and end_at <= end for start, end in self.active_sessions)

    def total_active_minutes(self) -> int:
        sessions = merge_sessions(self.active_sessions)
        return int(sum((end - start).total_seconds() for start, end in sessions) // 60)


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
    def __init__(
        self,
        seed: int,
        output_dir: Path,
        return_to_deck_enabled: bool = True,
        write_outputs: bool = True,
        return_subsidy_enabled: bool = True,
        take_cooldown_policy: str = "all_field_first_endgame_free",
        take_cost_mode: str = "level_sqrt",
        take_level_up_every: int = 2,
        post_cost_policy: str = "taker_initial_and_retries_paid",
        recycle_unposted: bool = True,
        empty_field_floor_grant: bool = True,
        reward_formula: str = "proposal",
        behavior_policy: str = "commitment_aware",
        activity_policy: str = "peak_engagement",
        score_policy: str = "stochastic_card_skill",
        remainder_policy: str = "last_poster",
        player_extension_enabled: bool = True,
        paid_update_policy: str = "rank_point_roi",
        allow_post_debt: bool = True,
        dynamic_wealth_tax_pot: bool = True,
        dynamic_hand_limit: bool = True,
    ) -> None:
        if take_cooldown_policy not in TAKE_COOLDOWN_POLICIES:
            raise ValueError(f"unknown take cooldown policy: {take_cooldown_policy}")
        if take_cost_mode not in {"field", "level_linear", "level_sqrt"}:
            raise ValueError(f"unknown take cost mode: {take_cost_mode}")
        if take_level_up_every < 1:
            raise ValueError("take level-up interval must be at least 1")
        if post_cost_policy not in POST_COST_POLICIES:
            raise ValueError(f"unknown post cost policy: {post_cost_policy}")
        if reward_formula not in REWARD_FORMULAS:
            raise ValueError(f"unknown reward formula: {reward_formula}")
        if behavior_policy not in BEHAVIOR_POLICIES:
            raise ValueError(f"unknown behavior policy: {behavior_policy}")
        if activity_policy not in ACTIVITY_POLICIES:
            raise ValueError(f"unknown activity policy: {activity_policy}")
        if score_policy not in SCORE_POLICIES:
            raise ValueError(f"unknown score policy: {score_policy}")
        if remainder_policy not in REMAINDER_POLICIES:
            raise ValueError(f"unknown remainder policy: {remainder_policy}")
        if paid_update_policy not in PAID_UPDATE_POLICIES:
            raise ValueError(f"unknown paid update policy: {paid_update_policy}")
        self.rng = random.Random(seed)
        self.skill_rng = random.Random(seed ^ 0x5A17)
        self.score_rng = random.Random(seed ^ 0x51C0A3)
        self.seed = seed
        self.return_to_deck_enabled = return_to_deck_enabled
        self.write_outputs = write_outputs
        self.return_subsidy_enabled = return_subsidy_enabled
        self.take_cooldown_policy = take_cooldown_policy
        self.take_cost_mode = take_cost_mode
        self.take_level_up_every = take_level_up_every
        self.post_cost_policy = post_cost_policy
        self.recycle_unposted = recycle_unposted
        self.empty_field_floor_grant = empty_field_floor_grant
        self.reward_formula = reward_formula
        self.behavior_policy = behavior_policy
        self.activity_policy = activity_policy
        self.score_policy = score_policy
        self.remainder_policy = remainder_policy
        self.player_extension_enabled = player_extension_enabled
        self.paid_update_policy = paid_update_policy
        self.allow_post_debt = allow_post_debt
        self.dynamic_wealth_tax_pot = dynamic_wealth_tax_pot
        self.dynamic_hand_limit = dynamic_hand_limit
        self.start_at = datetime(2026, 1, 1, 0, 0, tzinfo=JST)
        self.end_at = self.start_at + timedelta(hours=EVENT_HOURS)
        self.now = self.start_at
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(JST).strftime("%Y%m%d_%H%M%S_%f")
        self.jsonl_path = self.output_dir / f"tricks_simulation_{stamp}.jsonl"
        self.summary_path = self.output_dir / f"tricks_simulation_{stamp}_summary.json"
        self.cards = {
            i: Card(id=i, difficulty=self._weighted_choice(DIFFICULTY_DISTRIBUTION))
            for i in range(1, DECK_SIZE + 1)
        }
        self.deck = list(self.cards.keys())
        self.trash: list[int] = []
        self.field: list[int] = []
        self.collected: list[int] = []
        self.players: dict[str, Player] = {}
        self.queue = EventQueue()
        self.events_written = 0
        self.collections = 0
        self.subsidy_payments = 0
        self.empty_field_floor_grant_events = 0
        self.empty_field_floor_grant_points = 0
        self.activity_extension_events = 0
        self.activity_extension_minutes = 0
        self.rarity_draw_counts = {rarity: 0 for rarity in range(1, 6)}
        self.return_to_deck_count = 0
        self.pot_points = 0
        self.pot_tax_inflow = 0
        self.pot_return_inflow = 0
        self.pot_distributed_points = 0
        self.pot_distribution_events = 0
        self.wealth_tax_events = 0
        self.hand_limit_blocked_draws = 0
        self.unposted_recycle_count = 0
        self.collection_participant_counts: dict[int, int] = {}
        self.returned_card_redraw_count = 0
        self.returned_card_other_player_redraw_count = 0
        self.practiced_return_count = 0
        self.return_subsidy_flag_count = 0
        self.cooldown_release_count = 0
        self.cooldown_post_credit_events = 0
        self.cooldown_post_credit_minutes = 0
        self.endgame_free_take_count = 0
        self.endgame_cooldown_blocked_players: set[str] = set()
        self.endgame_cooldown_blocked_cycles: set[tuple[str, str]] = set()
        self.cooldown_stall_snapshot_count = 0
        self.all_field_posted_cooldown_waits = 0
        self.x_other_score_fields = 0
        self.x_other_upset_fields = 0
        self.x_other_score_pairs = 0
        self.x_other_upset_pairs = 0
        self.invariant_errors: list[str] = []
        self.half_hour_snapshots: list[dict[str, Any]] = []
        self.pending_initial_posts: dict[int, set[str]] = {}
        self.pending_decisions: set[tuple[str, datetime]] = set()
        self._setup_players()
        self._setup_events()
        preference_rng = random.Random(seed ^ 0xA991)
        self.card_appeal = {cid: preference_rng.random() for cid in self.cards}
        self.player_tastes = {p.name: {cid: preference_rng.random() for cid in self.cards} for p in self.players.values()}
        creator_rng = random.Random(seed ^ 0xC8EA)
        player_names = sorted(self.players)
        for card in self.cards.values():
            if creator_rng.random() < PARTICIPANT_CREATOR_CARD_RATE:
                card.creator_name = creator_rng.choice(player_names)
        self.contrarians = {p.name for p in self.players.values() if p.personality == "ネガティブ派" and preference_rng.random() < 0.5}
        self.trap_targets = {}
        self.trap_returns = set()


    def _setup_players(self) -> None:
        early_offsets = sorted(self.rng.uniform(0, 60) for _ in range(8))
        if self.activity_policy == "peak_engagement":
            late_offsets = sorted([
                *(self.rng.uniform(19 * 60, 22 * 60) for _ in range(4)),
                *(self.rng.uniform(43 * 60, 46 * 60) for _ in range(4)),
            ])
        else:
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
            skill_multiplier = round(self.skill_rng.uniform(0.55, 1.45), 3)
            motivation_multiplier = round(self.skill_rng.uniform(0.8, 1.2), 3)
            max_continuous_hours = personality_continuous_hours(personality, motivation_multiplier)
            if self.activity_policy == "peak_engagement":
                sessions = self._make_peak_engagement_sessions(
                    join_at,
                    engagement,
                    has_offpeak_activity,
                    max_continuous_hours,
                )
            elif engagement == "ガチ勢":
                sessions = self._make_hardcore_sessions(join_at, has_offpeak_activity)
            else:
                sessions = self._make_casual_sessions(join_at)
            favorite_card_ids = (
                set(self.rng.sample(range(1, DECK_SIZE + 1), FAVORITE_CARD_COUNT))
                if personality == "ホルダー優先派"
                else set()
            )
            skill_tier = "X" if idx == 1 else "Y" if idx <= 4 else "other"
            self.players[name] = Player(
                name=name,
                personality=personality,
                engagement=engagement,
                join_at=join_at,
                active_sessions=sessions,
                skill_multiplier=skill_multiplier,
                motivation_multiplier=motivation_multiplier,
                skill_tier=skill_tier,
                max_continuous_hours=max_continuous_hours,
                favorite_card_ids=favorite_card_ids,
                has_offpeak_activity=has_offpeak_activity,
            )
        self._check_player_setup()

    def _make_peak_engagement_sessions(
        self,
        join_at: datetime,
        engagement: str,
        include_offpeak: bool,
        max_continuous_hours: int,
    ) -> list[tuple[datetime, datetime]]:
        peak_windows = [
            (self.start_at, self.start_at + timedelta(hours=1)),
            (self.start_at + timedelta(hours=20), self.start_at + timedelta(hours=25)),
            (self.start_at + timedelta(hours=44), self.end_at),
        ]
        available_peaks = [
            (max(join_at, start), end)
            for start, end in peak_windows
            if end > max(join_at, start)
        ]
        if engagement == "エンジョイ勢" and available_peaks:
            first = available_peaks[0]
            available_peaks = [first, *[
                window for window in available_peaks[1:] if self.rng.random() < 0.55
            ]]

        sessions: list[tuple[datetime, datetime]] = []
        for start, end in available_peaks:
            capacity = int((end - start).total_seconds() // 60)
            maximum = min(capacity, max_continuous_hours * 60)
            if maximum < 30:
                continue
            if engagement == "ガチ勢":
                minimum = min(maximum, max(60, int(capacity * 0.65)))
            else:
                minimum = min(maximum, 60)
                maximum = min(maximum, 3 * 60)
            duration = self.rng.randint(minimum, maximum)
            latest_delay = min(30, max(0, capacity - duration))
            session_start = start + timedelta(minutes=self.rng.randint(0, latest_delay))
            sessions.append((session_start, session_start + timedelta(minutes=duration)))

        # ピークとピークアウトの中間帯には中程度の確率で短い活動を置く。
        shoulder_windows = [
            (self.start_at + timedelta(hours=1), self.start_at + timedelta(hours=4)),
            (self.start_at + timedelta(hours=14), self.start_at + timedelta(hours=20)),
            (self.start_at + timedelta(hours=25), self.start_at + timedelta(hours=28)),
            (self.start_at + timedelta(hours=38), self.start_at + timedelta(hours=44)),
        ]
        shoulder_probability = 0.45 if engagement == "ガチ勢" else 0.25
        for window_start, window_end in shoulder_windows:
            start = max(join_at, window_start)
            if window_end <= start or self.rng.random() >= shoulder_probability:
                continue
            capacity = int((window_end - start).total_seconds() // 60)
            maximum = min(capacity, 120, max_continuous_hours * 60)
            if maximum >= 30:
                sessions.append(self._place_session((start, window_end), self.rng.randint(30, maximum)))

        # 04:00〜14:00は原則休憩。従来と同じ少数のガチ勢だけ短時間アクセスしうる。
        if engagement == "ガチ勢" and include_offpeak:
            offpeak_windows = [
                (self.start_at + timedelta(hours=4), self.start_at + timedelta(hours=14)),
                (self.start_at + timedelta(hours=28), self.start_at + timedelta(hours=38)),
            ]
            candidates = [
                (max(join_at, start), end)
                for start, end in offpeak_windows
                if end > max(join_at, start)
            ]
            if candidates:
                window = self.rng.choice(candidates)
                duration = self.rng.randint(30, min(60, max_continuous_hours * 60))
                sessions.append(self._place_session(window, duration))
        return cap_continuous_sessions(sessions, max_continuous_hours)

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
        if self.activity_policy == "legacy":
            for player in hardcore:
                if not HARDCORE_PEAK_MINUTES_MIN <= peak_active_minutes(player, self.start_at) <= 12 * 60:
                    self.invariant_errors.append(f"player_setup: {player.name} peak minutes out of range")
                if player.total_active_minutes() > HARDCORE_TOTAL_MINUTES_MAX:
                    self.invariant_errors.append(f"player_setup: {player.name} exceeds 28 hours")
            for player in casual:
                if not CASUAL_MINUTES_MIN <= player.total_active_minutes() <= CASUAL_MINUTES_MAX:
                    self.invariant_errors.append(f"player_setup: {player.name} casual minutes out of range")
        else:
            for player in self.players.values():
                if not 1 <= player.max_continuous_hours <= 5:
                    self.invariant_errors.append(f"player_setup: {player.name} invalid continuous hours")
        counts = {name: sum(player.personality == name for player in self.players.values()) for name in PERSONALITY_BASE_COUNTS}
        for name, base in PERSONALITY_BASE_COUNTS.items():
            if abs(counts[name] - base) > 1:
                self.invariant_errors.append(f"player_setup: {name} count {counts[name]} outside ±1")

    def _setup_events(self) -> None:
        for player in self.players.values():
            self.queue.push(player.join_at, "join", {"player": player.name})
            for start, _end in player.active_sessions:
                if start >= player.join_at:
                    self._queue_decision(player.name, start)
        slot = self.start_at
        while slot <= self.end_at:
            self.queue.push(slot, "subsidy")
            self.queue.push(slot, "half_hour_snapshot")
            slot += SUBSIDY_INTERVAL
        self.queue.push(self.end_at - TAKE_CLOSE_BEFORE_END - timedelta(microseconds=1), "take_close_attempt")
        self.queue.push(self.end_at, "final")

    def run(self) -> dict[str, Any]:
        log_path = self.jsonl_path if self.write_outputs else Path(os.devnull)
        with log_path.open("w", encoding="utf-8") as fh:
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
                    self.pending_decisions.discard((data["player"], at))
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
        if self.write_outputs:
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
        participant_count = self.participant_count()
        for player in self.players.values():
            if not player.joined:
                continue
            flag_due = player.subsidy_flag_slot_at is not None and player.subsidy_flag_slot_at <= self.now
            empty_field_due = empty_field_subsidy_eligible(player.points, len(player.hand), field_empty)
            if not empty_field_due and not flag_due:
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
            self._record("subsidy", None, {
                "paid": paid,
                "field_empty": field_empty,
                "participant_count": participant_count,
            })
        if self.dynamic_wealth_tax_pot:
            taxed: list[dict[str, Any]] = []
            for player in self.players.values():
                if not player.joined:
                    continue
                level = sqrt_take_level(len(player.take_times))
                threshold = wealth_tax_threshold(level)
                if player.points <= threshold:
                    continue
                player.points -= 1
                self.pot_points += 1
                self.pot_tax_inflow += 1
                self.wealth_tax_events += 1
                taxed.append({"player": player.name, "level": level, "threshold": threshold})
            if taxed:
                self._record("wealth_tax", None, {
                    "taxed": taxed,
                    "tax_per_player": 1,
                    "pot_points": self.pot_points,
                })

    def _handle_half_hour_snapshot(self) -> None:
        if self._cooldown_stall_now():
            self.cooldown_stall_snapshot_count += 1
        self.half_hour_snapshots.append(self._half_hour_summary_snapshot())

    def _handle_take_close_attempts(self) -> None:
        players = [player for player in self.players.values() if player.joined]
        self.rng.shuffle(players)
        for player in players:
            player.actions["take_close_attempt"] = player.actions.get("take_close_attempt", 0) + 1
            if len(player.hand) < self._required_take_hand(player):
                self._record("take_close_attempt", player.name, {
                    "result": "insufficient_hand",
                    "hand_count": len(player.hand),
                })
                continue
            card_id = self._select_take_card(player)
            if card_id is None or not self._can_take(player):
                reason = self._take_block_reason(player)
                if reason == "take_cooldown" and player.points > 0:
                    self.endgame_cooldown_blocked_players.add(player.name)
                self._record("take_close_attempt", player.name, {
                    "result": "take_not_allowed",
                    "reason": reason,
                    "hand_count": len(player.hand),
                    "field_count": len(self.field),
                    "next_take_at": self._iso(self._cooldown_until(player)),
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
            if self.activity_policy == "legacy":
                self.invariant_errors.append(f"decision_while_busy: {player.name} at {self._iso(self.now)}")
            return
        # UI操作は0分とし、同一時刻内で状態が変わる限り次の意思決定へ進む。
        # 時間が進むのはミニゲームのプレイと手札練習だけとする。
        for _step in range(MAX_ZERO_TIME_ACTIONS):
            due = self._collect_due_cards()
            for card_id in due:
                self._collect_card(card_id)
            action = self._choose_action(player)
            if action.get("draw_deferred"):
                player.actions["draw_deferred"] = player.actions.get("draw_deferred", 0) + 1
                self._record("draw_deferred", player.name, {
                    "reason": "protect_desired_card",
                    "card_id": action.get("committed_card_id"),
                    "chosen_action": action["type"],
                    "hand_count": len(player.hand),
                    "required_hand": self._required_take_hand(player),
                })
            if action.get("consensus"):
                player.actions["consensus_resolution"] = player.actions.get("consensus_resolution", 0) + 1
                self._record("consensus", player.name, {
                    "resolution": action["consensus"],
                    "action": action["type"],
                    "card_id": action.get("card_id"),
                })
            if action["type"] == "wait":
                if self._waiting_only_for_cooldown(player):
                    self.all_field_posted_cooldown_waits += 1
                    if self.now >= self.end_at - ENDGAME_FREE_BEFORE_END and player.points > 0:
                        self.endgame_cooldown_blocked_cycles.add((
                            player.name,
                            self._iso(player.last_take_at) or "first_take",
                        ))
                player.actions["wait"] = player.actions.get("wait", 0) + 1
                self._record("wait", player.name, {"reason": action.get("reason", "no_action")})
                self._schedule_next_decision(player, WAIT_RECHECK_MINUTES)
                return
            if action["type"] == "draw":
                self._draw(player)
                continue
            if action["type"] == "return_to_deck":
                self._return_to_deck(player, action["card_id"])
                continue
            if action["type"] == "take":
                self._take(player, action["card_id"], trigger=action.get("consensus", "decision"))
                continue
            if action["type"] == "extend":
                self._buy_card_extension(player, action["card_id"], action.get("required_extensions", 1))
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
        trap = self._contrarian_action(player)
        if trap is not None:
            return trap
        options = self._legal_actions(player)
        target = self.trap_targets.get(player.name)
        if player.name in self.trap_returns and target in self.field and self.cards[target].taker != player.name:
            traps = [a for a in options if a.get("card_id") == target and a["type"] in {"initial_post", "update"}]
            if traps:
                player.actions["trap_attempt"] = player.actions.get("trap_attempt", 0) + 1
                return min(traps, key=lambda a: a["duration"])
        if not options:
            return {"type": "wait", "reason": "no_legal_action"}
        attachment_action = self._attachment_action(player, options)
        if attachment_action is not None:
            return attachment_action
        coverage_action = self._last_chance_initial_post(player, options)
        if coverage_action is not None:
            return coverage_action
        consensus_action = self._consensus_stall_action(player, options)
        if consensus_action is not None:
            return consensus_action
        commitment_action = self._commitment_preserving_action(player, options)
        if commitment_action is not None:
            return commitment_action
        rank_point_action = self._rank_point_efficiency_action(player, options)
        if rank_point_action is not None:
            return rank_point_action
        return_action = self._return_to_reduce_stack(player, options)
        if return_action is not None:
            return return_action
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

    def _attachment_action(
        self,
        player: Player,
        options: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        for card_id in self.field:
            card = self.cards[card_id]
            reasons = player.attachment_reasons.setdefault(card_id, set())
            if card_id in player.favorite_card_ids or self.player_tastes[player.name][card_id] >= 0.9:
                reasons.add("favorite")
            if "hierarchy_upset" in reasons and not self._is_below_normal_hierarchy(player, card):
                reasons.discard("hierarchy_upset")
            if not reasons:
                player.attachment_reasons.pop(card_id, None)
        attached = [
            action for action in options
            if action["type"] in {"initial_post", "update", "extend"}
            and player.attachment_reasons.get(action.get("card_id"))
        ]
        if not attached:
            return None
        if self.paid_update_policy == "legacy":
            player.actions["attachment_action"] = player.actions.get("attachment_action", 0) + 1
            return max(
                attached,
                key=lambda action: (
                    action["type"] == "extend",
                    action["type"] == "update",
                    self._forecast_action_value(player, action),
                    -action.get("duration", 0),
                ),
            )
        best = max(
            attached,
            key=lambda action: (
                self._forecast_action_value(player, action),
                action["type"] == "extend",
                -action.get("duration", 0),
            ),
        )
        if self._forecast_action_value(player, best) <= 0:
            return None
        player.actions["attachment_action"] = player.actions.get("attachment_action", 0) + 1
        return best

    def _last_chance_initial_post(
        self,
        player: Player,
        options: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        urgent: list[dict[str, Any]] = []
        for action in options:
            if action["type"] != "initial_post":
                continue
            card = self.cards[action["card_id"]]
            remaining = ((card.limit_at or self.now) - self.now).total_seconds() / 60.0
            retry_floor = {1: 10, 2: 16, 3: 24, 4: 34, 5: 45}[min(5, max(1, card.difficulty or 1))]
            if remaining <= action["duration"] + retry_floor + WAIT_RECHECK_MINUTES:
                urgent.append(action)
        if not urgent:
            return None
        return min(urgent, key=lambda action: self.cards[action["card_id"]].limit_at or self.end_at)

    def _rank_point_efficiency_action(
        self,
        player: Player,
        options: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        if not self._is_point_return_sensitive(player):
            return None
        candidates = [action for action in options if action["type"] in {"initial_post", "update"}]
        if not candidates:
            return None

        def efficiency(action: dict[str, Any]) -> float:
            card = self.cards[action["card_id"]]
            participants = self._forecast_field_participants(card, player.name)
            predicted_rank = self._forecast_rank_after_future_posts(
                player,
                card,
                action["duration"],
                participants,
            )
            future = self._rank_points_for(predicted_rank, participants, card.stack_count)
            if action["type"] == "update" and self.paid_update_policy == "legacy":
                current = self._rank_points_for(
                    self._current_rank(player, card),
                    participants,
                    card.stack_count,
                )
                gain = max(0, future - current)
            elif action["type"] == "update":
                gain = action.get("expected_rank_point_gain", 0)
            else:
                gain = max(0, future)
            cost = self._initial_post_cost(card, player) if action["type"] == "initial_post" else self._update_post_cost(card)
            return gain / max(1.0, action["duration"] + cost * 10.0)

        best = max(candidates, key=efficiency)
        return best if efficiency(best) > 0 else None

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

    def _take_desire(self, player: Player, card_id: int) -> float:
        """本人にしか見えない、カードをテイクしたい複合的な強さ。"""
        card = self.cards[card_id]
        taste = self.player_tastes[player.name][card_id]
        public_appeal = self.card_appeal[card_id]
        difficulty = card.difficulty or 1
        if player.skill_tier == "X":
            confidence = 0.75
        elif player.skill_tier == "Y":
            confidence = 0.55
        else:
            confidence = max(0.08, 0.34 - (difficulty - 1) * 0.055 + (player.skill_multiplier - 1.0) * 0.12)
        creator_bonus = 1.35 if card.creator_name == player.name else 0.0
        favorite_bonus = (
            0.95 if player.personality == "ホルダー優先派" else 0.45
        ) if card_id in player.favorite_card_ids else 0.0
        individuality = max(0.0, taste - public_appeal) * (
            0.55 if player.personality == "ネガティブ派" else 0.25
        )
        return taste * 0.75 + public_appeal * 0.45 + confidence + creator_bonus + favorite_bonus + individuality

    def _committed_hand_card(self, player: Player) -> int | None:
        if self.behavior_policy != "commitment_aware" or not player.hand:
            return None
        card_id = max(player.hand, key=lambda cid: self._take_desire(player, cid))
        threshold = TAKE_DESIRE_THRESHOLDS[player.personality]
        return card_id if self._take_desire(player, card_id) >= threshold else None

    def _draw_commitment_penalty(self, player: Player) -> float:
        committed = self._committed_hand_card(player)
        if committed is None:
            return 0.0
        threshold = TAKE_DESIRE_THRESHOLDS[player.personality]
        desired_scores = [
            self._take_desire(player, cid)
            for cid in player.hand
            if self._take_desire(player, cid) >= threshold
        ]
        penalty = 0.8 + max(0.0, max(desired_scores) - threshold) * 1.2
        penalty += max(0, len(desired_scores) - 1) * 0.6
        if len(player.hand) < self._required_take_hand(player):
            penalty *= 0.2
        return min(3.0, penalty)

    def _commitment_preserving_action(
        self,
        player: Player,
        options: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        committed = self._committed_hand_card(player)
        if committed is None:
            return None
        if len(player.hand) < self._required_take_hand(player):
            return None
        commitment_metadata = {"committed_card_id": committed}
        if any(action["type"] == "draw" for action in options):
            commitment_metadata["draw_deferred"] = True
        takes = [
            action for action in options
            if action["type"] == "take" and action.get("card_id") == committed
        ]
        if takes:
            return {**takes[0], **commitment_metadata}
        alternatives = [
            action for action in options
            if action["type"] not in {"draw", "return_to_deck", "take"}
        ]
        if alternatives:
            best = max(alternatives, key=lambda action: (
                action.get("card_id") == committed and action["type"] == "practice",
                self._forecast_action_value(player, action),
            ))
            return {**best, **commitment_metadata}
        return {
            "type": "wait",
            "reason": "protect_desired_card_until_take",
            **commitment_metadata,
        }

    def _legal_actions(self, player: Player) -> list[dict[str, Any]]:
        actions: list[dict[str, Any]] = []
        selected_take_card_id: int | None = None
        can_still_take = self.now < self.end_at - TAKE_CLOSE_BEFORE_END
        future_take_count = self._forecast_take_opportunities(player)
        # テイク締切後は、新たに引いたカードや手札練習の成果を場に出せない。
        # 残り時間は場札への投稿・更新に使う方が合理的なので候補から除外する。
        if (
            can_still_take
            and future_take_count > 0
            and player.points >= 1
            and self.deck_or_trash_available()
            and (not self.dynamic_hand_limit or len(player.hand) < self._hand_limit(player))
        ):
            actions.append({"type": "draw"})
        if self._can_take(player):
            card_id = self._select_take_card(player)
            if card_id and self._feasible_new_field_posters(self.cards[card_id]) > 0:
                selected_take_card_id = card_id
                actions.append({"type": "take", "card_id": card_id})
        for card_id in self.field:
            card = self.cards[card_id]
            if player.name not in card.paid_players:
                max_duration = self._max_initial_play_minutes(player, card)
                if max_duration >= difficulty_minimum_minutes(card.difficulty):
                    duration = self._initial_play_duration(player, card, max_duration)
                    post_action = {
                        "type": "initial_post",
                        "card_id": card_id,
                        "duration": duration,
                        "participation_probability": self._post_participation_probability(player, card, duration),
                        "expected_point_net": self._expected_initial_post_point_net(player, card, duration),
                    }
                    if self._paid_post_is_acceptable(player, card, post_action["expected_point_net"]):
                        actions.append(post_action)
            elif player.name in card.posted_players:
                plan = self._update_play_plan(player, card)
                update_cost = self._update_post_cost(card)
                if (
                    plan is not None
                    and self._can_finish_timed_action(player, plan["duration"], card.limit_at)
                ):
                    assessment = self._paid_update_assessment(player, card, plan["duration"])
                    update_action = {
                        "type": "update",
                        "card_id": card_id,
                        "cost": update_cost,
                        **assessment,
                        **plan,
                    }
                    if self._paid_update_is_acceptable(update_action, include_time=True):
                        actions.append(update_action)
                    else:
                        player.actions["update_plan_rejected_rank_value"] = (
                            player.actions.get("update_plan_rejected_rank_value", 0) + 1
                        )
            extension_plan = self._extension_plan(player, card)
            if extension_plan is not None:
                actions.append({
                    "type": "extend",
                    "card_id": card_id,
                    **extension_plan,
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
        if (
            self.return_to_deck_enabled
            and player.points >= RETURN_TO_DECK_COST
            and len(player.hand) > self._required_take_hand(player)
            and self._can_take(player)
        ):
            return_candidates = [
                card_id for card_id in player.hand
                if card_id != selected_take_card_id
            ]
            if return_candidates:
                actions.append({
                    "type": "return_to_deck",
                    "card_id": min(
                        return_candidates,
                        key=lambda card_id: (
                            card_id in player.favorite_card_ids,
                            player.private_practice.get(card_id, 0),
                            self.cards[card_id].difficulty or 1,
                        ),
                    ),
                })
        return actions

    def _return_to_reduce_stack(
        self,
        player: Player,
        options: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        """非スタック派がテイク可能な余剰手札を最小枚数まで戻す積極利用シナリオ。"""
        if player.personality == "スタック派":
            return None
        returns = [action for action in options if action["type"] == "return_to_deck"]
        takes = [action for action in options if action["type"] == "take"]
        if returns and takes:
            cid = returns[0]["card_id"]
            if self.player_tastes[player.name][cid] < 0.25 and player.points >= 3:
                return returns[0]
        return None

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

    def _expected_score_trial_minutes(self, player: Player, card: Card) -> int:
        difficulty = min(5, max(1, card.difficulty or 1))
        lower = {1: 10, 2: 16, 3: 24, 4: 34, 5: 45}[difficulty]
        upper = {1: 24, 2: 34, 3: 44, 4: 54, 5: 60}[difficulty]
        return min(60, max(lower, round((lower + upper) / 2 * player.motivation_multiplier)))

    def _extension_plan(self, player: Player, card: Card) -> dict[str, Any] | None:
        if (
            not self.player_extension_enabled
            or not self._is_point_return_sensitive(player)
            or player.points < PLAYER_EXTENSION_COST
            or card.limit_at is None
            or self.now >= self.end_at - PLAYER_EXTENSION_CUTOFF
            or card.limit_at >= self.end_at
        ):
            return None
        reasons = player.attachment_reasons.setdefault(card.id, set())
        if card.id in player.favorite_card_ids or self.player_tastes[player.name][card.id] >= 0.9:
            reasons.add("favorite")
        if not reasons:
            player.attachment_reasons.pop(card.id, None)
            return None
        if card.trial_count.get(player.name, 0) >= MAX_FIELD_SCORE_TRIALS:
            return None
        trial_minutes = self._expected_score_trial_minutes(player, card)
        remaining_minutes = max(0.0, (card.limit_at - self.now).total_seconds() / 60.0)
        if remaining_minutes > trial_minutes:
            return None
        required_extensions = max(
            1,
            math.ceil((trial_minutes - remaining_minutes + 0.001) / PLAYER_EXTENSION_MINUTES),
        )
        extended_limit = min(
            self.end_at,
            card.limit_at + timedelta(minutes=PLAYER_EXTENSION_MINUTES * required_extensions),
        )
        if (extended_limit - self.now).total_seconds() / 60.0 <= trial_minutes:
            return None
        if player.points < required_extensions:
            return None
        participants = max(1, self._forecast_field_participants(card, player.name))
        if player.name in card.posted_players:
            current_rank = self._current_rank(player, card)
            current_rank_points = self._rank_points_for(current_rank, participants, card.stack_count)
        else:
            current_rank = participants
            current_rank_points = 0
        predicted_rank = self._forecast_rank_after_future_posts(
            player,
            card,
            trial_minutes,
            participants,
        )
        predicted_rank_points = self._rank_points_for(predicted_rank, participants, card.stack_count)
        improvement_value = max(0, predicted_rank_points - current_rank_points)
        defense_value = 0.0
        if current_rank == 1 and reasons.intersection({"favorite", "upward_score"}):
            defense_value = max(1.0, current_rank_points * 0.5)
        rank_point_value = max(float(improvement_value), defense_value)
        if rank_point_value < required_extensions:
            return None
        return {
            "required_extensions": required_extensions,
            "rank_point_value": round(rank_point_value, 3),
            "trial_minutes": trial_minutes,
            "attachment_reasons": sorted(reasons),
        }

    def _buy_card_extension(self, player: Player, card_id: int, planned_extensions: int) -> None:
        if card_id not in self.field:
            self._record("wait", player.name, {"reason": "extension_target_not_field", "card_id": card_id})
            return
        card = self.cards[card_id]
        plan = self._extension_plan(player, card)
        if plan is None or player.points < PLAYER_EXTENSION_COST:
            self._record("wait", player.name, {"reason": "extension_no_longer_rational", "card_id": card_id})
            return
        previous_limit = card.limit_at
        player.points -= PLAYER_EXTENSION_COST
        card.paid_points_total += PLAYER_EXTENSION_COST
        card.paid_extension_points_total += PLAYER_EXTENSION_COST
        card.paid_points_by_player[player.name] = (
            card.paid_points_by_player.get(player.name, 0) + PLAYER_EXTENSION_COST
        )
        card.extension_counts_by_player[player.name] = card.extension_counts_by_player.get(player.name, 0) + 1
        card.extension_players.add(player.name)
        card.limit_at = min(
            self.end_at,
            card.limit_at + timedelta(minutes=PLAYER_EXTENSION_MINUTES),
        )
        self.queue.push(card.limit_at, "collect", {"card_id": card.id, "limit_at": card.limit_at.isoformat()})
        self._extend_activity_for_card(card)
        player.actions["paid_extension"] = player.actions.get("paid_extension", 0) + 1
        self._record("paid_extension", player.name, {
            "card_id": card.id,
            "cost": PLAYER_EXTENSION_COST,
            "minutes": PLAYER_EXTENSION_MINUTES,
            "previous_limit_at": self._iso(previous_limit),
            "limit_at": self._iso(card.limit_at),
            "planned_extensions": planned_extensions,
            "remaining_required_extensions": max(0, plan["required_extensions"] - 1),
            "rank_point_value": plan["rank_point_value"],
            "attachment_reasons": plan["attachment_reasons"],
        })

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
        required_hand = self._required_take_hand(player)
        reachable_target = (
            min(max(STACK_TARGET_HAND, required_hand), len(player.hand) + max(0, player.points))
            if self.behavior_policy == "legacy"
            else self._forecast_orthodox_stack_target(player)
        )
        if self.dynamic_hand_limit:
            reachable_target = min(reachable_target, self._hand_limit(player))
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
        if draws and len(player.hand) < max(6, self._required_take_hand(player)):
            return draws[0]
        return {"type": "wait", "reason": "orthodox_no_rank_point_gain"}

    def _choose_negative_action(self, player: Player, options: list[dict[str, Any]]) -> dict[str, Any]:
        # ネガティブ派：練習成果を締切前に場へ出せる見込みがある場合に練習を優先する。
        draws = [a for a in options if a["type"] == "draw"]
        if draws and len(player.hand) < self._required_take_hand(player):
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
            if self.paid_update_policy == "legacy":
                card = self.cards[action["card_id"]]
                if action["type"] == "update":
                    return 100.0 - self._predicted_rank_after_play(player, card, action["duration"]) * 10.0
                if action["type"] == "initial_post":
                    return 90.0 - self._predicted_rank_after_play(player, card, action["duration"]) * 10.0
                if action["type"] == "practice":
                    return 60.0 + action["duration"] / 10.0
                if action["type"] == "take":
                    return 70.0 + self._take_value(player, action["card_id"])
            if action["type"] == "update":
                return self._forecast_action_value(player, action) + 0.5
            if action["type"] == "initial_post":
                return self._forecast_action_value(player, action) + 0.75
            if action["type"] == "practice":
                return self._forecast_action_value(player, action) + 0.5
            if action["type"] == "take":
                return self._forecast_action_value(player, action) + 0.75
            return self._forecast_action_value(player, action)

        return max(favorite_actions, key=holder_value)

    def _take_to_avoid_large_hand(self, player: Player, options: list[dict[str, Any]]) -> dict[str, Any] | None:
        pressure_threshold = max(8, self._required_take_hand(player))
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
            cost = self._initial_post_cost(card, player)
            coverage_value = 0.6 + card.stack_count / 12.0
            expected_utility = self._post_expected_utility(player, card, action["duration"])
            return expected_utility + coverage_value + cost * point_shadow + self._sharing_appeal(player, card.id) * 0.5
        if action["type"] == "update":
            if self.paid_update_policy == "legacy":
                card = self.cards[action["card_id"]]
                current_rank = self._current_rank(player, card)
                participant_count = self._forecast_field_participants(card, player.name)
                predicted_rank = self._forecast_rank_after_future_posts(
                    player,
                    card,
                    action["duration"],
                    participant_count,
                )
                gain = self._rank_points_for(predicted_rank, participant_count, card.stack_count)
                gain -= self._rank_points_for(current_rank, participant_count, card.stack_count)
                return gain - self._update_post_cost(card) - play_time_cost(action["duration"])
            gain = float(action.get("expected_rank_point_gain", 0))
            cost = float(action.get("cost", 0))
            # ポイントは勝利得点ではない。将来行動を狭める流動性費用だけを
            # 小さく差し引き、ランクP増分と時間効率を主目的にする。
            return gain - action["duration"] / 60.0 - cost * 0.1
        if action["type"] == "extend":
            return action.get("rank_point_value", 0.0) - action.get("required_extensions", 1)
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
            completion_bonus = 1.0 if len(player.hand) < self._required_take_hand(player) else 0.35
            if self.behavior_policy == "legacy":
                return pipeline_value + completion_bonus + point_shadow
            return commitment_aware_draw_value(
                pipeline_value,
                completion_bonus,
                self._draw_commitment_penalty(player),
            )
        if action["type"] == "return_to_deck":
            # 直後のテイクで余剰1枚をスタックから救う価値。料金1Pを差し引く。
            return 0.35 + point_shadow - RETURN_TO_DECK_COST
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
        next_ready = max(self.now, self._cooldown_until(player) or self.now)
        hypothetical_last = player.last_take_at
        opportunities = 0
        for session_start, session_end in player.active_sessions:
            window_start = max(self.now, session_start)
            window_end = min(close_at, session_end)
            candidate = max(window_start, next_ready)
            while candidate < window_end and opportunities < FIELD_LIMIT:
                opportunities += 1
                hypothetical_last = candidate
                if self.take_cooldown_policy in ENDGAME_FREE_POLICIES and candidate >= self.end_at - ENDGAME_FREE_BEFORE_END:
                    candidate += timedelta(microseconds=1)
                else:
                    candidate += TAKE_COOLDOWN
                next_ready = candidate

        # 締切直前試行だけは活動セッション外でも全員が1回試みる。
        take_close_attempt_at = close_at - timedelta(microseconds=1)
        if (
            take_close_attempt_at >= self.now
            and (
                hypothetical_last is None
                or take_close_attempt_at >= hypothetical_last + TAKE_COOLDOWN
                or (
                    self.take_cooldown_policy in ENDGAME_FREE_POLICIES
                    and take_close_attempt_at >= self.end_at - ENDGAME_FREE_BEFORE_END
                )
            )
        ):
            opportunities += 1
        return opportunities

    def _forecast_spend_capacity(self, player: Player) -> int:
        unposted_cost = sum(
            self._initial_post_cost(self.cards[card_id], player)
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
        required_hand = self._required_take_hand(player)
        if self.behavior_policy == "legacy":
            surplus_target = required_hand + min(7, max(0, player.points - 5) // 8)
            return max(required_hand, min(affordable, surplus_target))
        if self._committed_hand_card(player) is not None:
            return min(affordable, required_hand)
        surplus = rational_stack_surplus(player.personality, affordable, required_hand)
        surplus_target = required_hand + surplus
        return max(required_hand, min(affordable, surplus_target))

    def _forecast_field_participants(self, card: Card, actor_name: str) -> int:
        deadline = min(
            card.limit_at or (self.now + timedelta(minutes=initial_countdown_minutes(card.difficulty))),
            self.end_at,
        )
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
        fee = self._initial_post_cost(card, player)
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
        fee = self._initial_post_cost(card, player)
        time_cost = play_time_cost(duration)
        return (
            rank_points
            + expected_reward * rank_reward_weight * 0.35
            - fee
            - time_cost
            - self._practice_risk_penalty(card)
        )

    def _is_point_return_sensitive(self, player: Player) -> bool:
        return player.skill_tier == "Y" or player.personality in POINT_RETURN_SENSITIVE_PERSONALITIES

    def _paid_post_is_acceptable(self, player: Player, card: Card, expected_point_net: int) -> bool:
        cost = self._initial_post_cost(card, player)
        if not self.allow_post_debt and player.points < cost:
            return False
        if self.post_cost_policy == "taker_initial_and_retries_paid":
            return True
        return should_accept_initial_post(cost, self._is_point_return_sensitive(player), expected_point_net)

    def _expected_initial_post_point_net(self, player: Player, card: Card, duration: int) -> int:
        cost = self._initial_post_cost(card, player)
        participant_count = self._forecast_field_participants(card, player.name)
        predicted_rank = self._forecast_rank_after_future_posts(player, card, duration, participant_count)
        base = card.stack_count + card.paid_points_total + cost
        total_reward = calculate_total_reward(
            base,
            card.difficulty or 1,
            participant_count,
            self.reward_formula,
        )
        expected_reward = (
            proposed_rank_distribution(total_reward, participant_count)[predicted_rank - 1]
            if self.reward_formula == "proposal" and 0 < predicted_rank <= participant_count
            else predicted_rank_reward(
                total_reward,
                predicted_rank,
                participant_count,
                player.name == card.taker,
                self.remainder_policy,
            )
        )
        return expected_reward - cost

    def _post_participation_probability(self, player: Player, card: Card, duration: int) -> float:
        utility = self._post_expected_utility(player, card, duration)
        base = FORECAST_POST_PARTICIPATION[player.personality]
        logit = math.log(base / (1.0 - base)) + utility / 3.0
        return min(0.98, max(0.02, 1.0 / (1.0 + math.exp(-logit))))

    def _forecast_new_field_participants(self, player: Player, card: Card | None = None) -> int:
        deadline = min(
            self.now + timedelta(minutes=initial_countdown_minutes(card.difficulty if card else None)),
            self.end_at,
        )
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
        limit = min(
            deadline or (self.now + timedelta(minutes=initial_countdown_minutes(card.difficulty))),
            self.end_at,
        )
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
        if self.score_policy == "stochastic_card_skill":
            predicted_score = self._expected_card_score(player, card, duration)
        else:
            predicted_time = card.play_time.get(player.name, 0) + duration
            predicted_score = self._score_for_minutes(
                player,
                predicted_time,
                player.private_practice.get(card.id, 0),
            )
        return self._forecast_score_rank_after_future_posts(
            player,
            card,
            predicted_score,
            participant_count,
        )

    def _forecast_score_rank_after_future_posts(
        self,
        player: Player,
        card: Card,
        score: float,
        participant_count: int,
    ) -> int:
        known_rank = 1 + sum(
            1
            for name, other_score in card.scores.items()
            if name != player.name and other_score > score
        )
        known_participants = len(card.posted_players | {player.name})
        future_competitors = max(0, participant_count - known_participants)
        expected_rank = self._forecast_rank_from_skill(player, participant_count)
        return min(participant_count, max(known_rank, min(known_rank + future_competitors, expected_rank)))

    def _paid_update_assessment(
        self,
        player: Player,
        card: Card,
        duration: int,
        candidate_score: float | None = None,
    ) -> dict[str, Any]:
        participant_count = self._forecast_field_participants(card, player.name)
        current_score = card.scores[player.name]
        if candidate_score is not None:
            proposed_score = candidate_score
        elif self.score_policy == "stochastic_card_skill":
            proposed_score = self._expected_card_score(player, card, duration)
        else:
            proposed_score = self._score_for_minutes(
                player,
                card.play_time.get(player.name, 0) + duration,
                player.private_practice.get(card.id, 0),
            )
        before_rank = self._forecast_score_rank_after_future_posts(
            player,
            card,
            current_score,
            participant_count,
        )
        after_rank = self._forecast_score_rank_after_future_posts(
            player,
            card,
            proposed_score,
            participant_count,
        )
        before_points = self._rank_points_for(before_rank, participant_count, card.stack_count)
        after_points = self._rank_points_for(after_rank, participant_count, card.stack_count)
        gain = max(0, after_points - before_points)
        cost = self._update_post_cost(card)
        return {
            "expected_rank_before": before_rank,
            "expected_rank_after": after_rank,
            "expected_rank_point_gain": gain,
            "rank_points_per_paid_point": gain / cost if cost > 0 else None,
        }

    def _paid_update_is_acceptable(
        self,
        action: dict[str, Any],
        include_time: bool,
    ) -> bool:
        cost = int(action.get("cost", 0))
        if cost <= 0 or self.paid_update_policy == "legacy":
            return True
        return paid_update_is_rational(
            int(action.get("expected_rank_point_gain", 0)),
            cost,
            int(action.get("duration", 0)),
            include_time,
        )

    def _forecast_post_rank_points(self, player: Player, card: Card, duration: int) -> int:
        participant_count = self._forecast_field_participants(card, player.name)
        predicted_rank = self._forecast_rank_after_future_posts(player, card, duration, participant_count)
        return self._rank_points_for(predicted_rank, participant_count, card.stack_count)

    def _expected_play_minutes(self, player: Player) -> int:
        return 18

    def _forecast_rank_from_skill(self, player: Player, participant_count: int) -> int:
        player_strength = (SKILL_TIER_ORDER[player.skill_tier], player.skill_multiplier)
        stronger = sum(
            1
            for other in self.players.values()
            if other.joined
            and other.name != player.name
            and (SKILL_TIER_ORDER[other.skill_tier], other.skill_multiplier) > player_strength
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
            return self._field_reward_potential(action["card_id"]) - self._initial_post_cost(card, player)
        if action["type"] == "update":
            card = self.cards[action["card_id"]]
            return self._field_reward_potential(action["card_id"]) * 0.5 - self._update_post_cost(card)
        if action["type"] == "extend":
            return action.get("rank_point_value", 0.0) - action.get("required_extensions", 1)
        if action["type"] == "practice":
            return 0.2
        return 0.0

    def _take_value(self, player: Player, card_id: int) -> float:
        card = self.cards[card_id]
        practice = self._effective_practice_minutes(player.private_practice.get(card_id, 0))
        difficulty = card.difficulty or 1
        stack = len(player.hand)
        if self.behavior_policy == "legacy":
            return stack * 2.0 + practice / 20.0 + difficulty * 0.25
        return (
            self._take_desire(player, card_id) * 2.0
            + stack * 0.25
            + practice / 20.0
            + difficulty * 0.15
        )

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

    def _initial_post_cost(self, card: Card, player: Player | None = None) -> int:
        if self.post_cost_policy == "taker_initial_and_retries_paid":
            return calculate_attempt_post_cost(
                card.difficulty or 1,
                player is not None and player.name == card.taker,
                1,
            )
        amount = (
            card.difficulty or 1
            if self.post_cost_policy == "first_second_free_difficulty"
            else card.rarity or 1
        )
        return calculate_initial_post_cost(amount, len(card.posted_players), self.post_cost_policy)

    def _update_post_cost(self, card: Card) -> int:
        return calculate_attempt_post_cost(card.difficulty or 1, False, 2) if self.post_cost_policy == "taker_initial_and_retries_paid" else 0

    def _current_rank(self, player: Player, card: Card) -> int:
        if player.name not in card.scores:
            return len(card.posted_players) + 1
        higher = sum(1 for score in card.scores.values() if score > card.scores[player.name])
        return higher + 1

    def _predicted_rank_after_play(self, player: Player, card: Card, duration: int) -> int:
        if self.score_policy == "stochastic_card_skill":
            predicted_score = self._expected_card_score(player, card, duration)
        else:
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
        if self.score_policy == "stochastic_card_skill":
            return self._score_trial_duration(player, card, max_duration)
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
        if self.score_policy == "stochastic_card_skill":
            trial_count = card.trial_count.get(player.name, 0)
            attached = bool(player.attachment_reasons.get(card.id))
            if trial_count >= MAX_FIELD_SCORE_TRIALS:
                return None
            if not attached and current_score >= max(card.scores.values(), default=current_score):
                return None
            duration = self._score_trial_duration(player, card, MAX_INITIAL_PLAY_MINUTES)
            return {
                "duration": duration,
                "target_score": round(max(card.scores.values(), default=current_score), 6),
                "raw_gap": None,
                "planned_update_count": card.update_count.get(player.name, 0) + 1,
            }
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

    def _score_trial_duration(self, player: Player, card: Card, max_duration: int) -> int:
        difficulty = min(5, max(1, card.difficulty or 1))
        lower_by_difficulty = {1: 10, 2: 16, 3: 24, 4: 34, 5: 45}
        upper_by_difficulty = {1: 24, 2: 34, 3: 44, 4: 54, 5: 60}
        lower = min(max_duration, lower_by_difficulty[difficulty])
        upper = min(max_duration, upper_by_difficulty[difficulty])
        if upper <= lower:
            return max(1, upper)
        duration = round(self.score_rng.randint(lower, upper) * player.motivation_multiplier)
        return min(upper, max(lower, duration))

    def _effective_practice_minutes(self, raw_minutes: int) -> float:
        return effective_practice_minutes(raw_minutes)

    def _score_for_minutes(self, player: Player, play_minutes: int, practice_minutes: int) -> float:
        if self.score_policy == "stochastic_card_skill":
            effective_minutes = play_minutes + self._effective_practice_minutes(practice_minutes)
            learned = effective_minutes * SCORE_SKILL_EFFICIENCY[player.skill_tier]
            return (
                SCORE_TIER_BASE[player.skill_tier]
                + (player.skill_multiplier - 1.0) * 8.0
                + learned * SCORE_SKILL_POINT_PER_MINUTE
            )
        effective_time = play_minutes + self._effective_practice_minutes(practice_minutes)
        epsilon = int(player.name.split("_")[-1]) / 1000.0
        tier_base = SKILL_TIER_ORDER[player.skill_tier] * 1_000_000.0
        return tier_base + effective_time * player.skill_multiplier + epsilon

    def _expected_card_score(self, player: Player, card: Card, additional_minutes: int = 0) -> float:
        learned = player.card_skill_minutes.get(card.id, 0.0)
        learned += additional_minutes * SCORE_SKILL_EFFICIENCY[player.skill_tier]
        return (
            SCORE_TIER_BASE[player.skill_tier]
            + (player.skill_multiplier - 1.0) * 8.0
            + learned * SCORE_SKILL_POINT_PER_MINUTE
        )

    def _schedule_next_decision(self, player: Player, after_minutes: int) -> None:
        next_at = self.now + timedelta(minutes=after_minutes)
        if next_at < self.end_at and player.is_active_during(self.now, next_at):
            self._queue_decision(player.name, next_at)

    def _queue_decision(self, player_name: str, at: datetime) -> None:
        key = (player_name, at)
        if at >= self.end_at or key in self.pending_decisions:
            return
        self.pending_decisions.add(key)
        self.queue.push(at, "decision", {"player": player_name})

    def _extend_activity_for_card(self, card: Card) -> None:
        if self.activity_policy != "peak_engagement" or card.limit_at is None:
            return
        involved = {card.taker, *card.posted_players, *card.extension_players}
        for player_name in involved:
            if player_name is None:
                continue
            player = self.players[player_name]
            indexes = [
                index for index, (start, end) in enumerate(player.active_sessions)
                if start <= self.now <= end
            ]
            if not indexes:
                continue
            index = max(indexes, key=lambda item: player.active_sessions[item][0])
            start, old_end = player.active_sessions[index]
            continuous_cap = start + timedelta(hours=player.max_continuous_hours)
            target_end = min(card.limit_at, continuous_cap, self.end_at)
            if target_end <= old_end:
                continue
            player.active_sessions[index] = (start, target_end)
            previous_starts = {session_start for session_start, _end in player.active_sessions}
            player.active_sessions = cap_continuous_sessions(
                player.active_sessions,
                player.max_continuous_hours,
            )
            for session_start, _session_end in player.active_sessions:
                if session_start >= self.now and session_start not in previous_starts:
                    self._queue_decision(player.name, session_start)
            added = int((target_end - old_end).total_seconds() // 60)
            self.activity_extension_events += 1
            self.activity_extension_minutes += added
            resume_at = max(
                self.now + timedelta(microseconds=1),
                old_end + timedelta(microseconds=1),
            )
            if resume_at < target_end and (player.busy_until is None or player.busy_until <= resume_at):
                self._queue_decision(player.name, resume_at)
            self._record("activity_extended", player.name, {
                "card_id": card.id,
                "old_end": self._iso(old_end),
                "new_end": self._iso(target_end),
                "added_minutes": added,
                "continuous_cap_hours": player.max_continuous_hours,
            })

    def deck_or_trash_available(self) -> bool:
        return bool(self.deck or self.trash)

    def _draw(self, player: Player) -> None:
        hand_limit_reached = self.dynamic_hand_limit and len(player.hand) >= self._hand_limit(player)
        if player.points < 1 or not self.deck_or_trash_available() or hand_limit_reached:
            self.hand_limit_blocked_draws += int(hand_limit_reached)
            self._record("wait", player.name, {"reason": "draw_not_allowed"})
            return
        if not self.deck:
            self.deck = self.trash[:]
            self.trash = []
            self.rng.shuffle(self.deck)
        difficulty = self._draw_available_difficulty()
        candidates = [card_id for card_id in self.deck if self.cards[card_id].difficulty == difficulty]
        card_id = self.rng.choice(candidates)
        self.deck.remove(card_id)
        card = self.cards[card_id]
        if card.pending_returned_by is not None:
            self.returned_card_redraw_count += 1
            if card.pending_returned_by != player.name:
                self.returned_card_other_player_redraw_count += 1
            card.pending_returned_by = None
        card.state = player.name
        card.drawn_at = self.now
        rarity_distribution = rarity_distribution_at(self.elapsed_minutes())
        rarity_assigned_now = card.rarity is None
        if rarity_assigned_now:
            card.rarity = self._weighted_choice(rarity_distribution)
        player.points -= 1
        self.rarity_draw_counts[card.rarity] += 1
        player.hand.append(card_id)
        card.draw_history.append(player.name)
        player.actions["draw"] = player.actions.get("draw", 0) + 1
        self._record("draw", player.name, {
            "card_id": card_id,
            "self_created": card.creator_name == player.name,
            "rarity": card.rarity,
            "difficulty": card.difficulty,
            "cost": 1,
            "rarity_assigned_now": rarity_assigned_now,
            "rare_probability": round(sum(weight for rarity, weight in rarity_distribution if rarity >= 2), 6),
        })

    def _return_to_deck(self, player: Player, card_id: int) -> None:
        if not can_return_to_deck(self.return_to_deck_enabled, player.points, card_id in player.hand):
            self._record("wait", player.name, {"reason": "return_to_deck_not_allowed"})
            return
        player.hand.remove(card_id)
        player.points -= RETURN_TO_DECK_COST
        card = self.cards[card_id]
        practiced = player.private_practice.get(card_id, 0) > 0
        card.practiced_before_return = card.practiced_before_return or practiced
        card.return_history.append(player.name)
        card.pending_returned_by = player.name
        card.state = "_deck"
        self.deck.append(card_id)
        self.rng.shuffle(self.deck)
        self.return_to_deck_count += 1
        if self.dynamic_wealth_tax_pot:
            self.pot_points += RETURN_TO_DECK_COST
            self.pot_return_inflow += RETURN_TO_DECK_COST
        self.practiced_return_count += int(practiced)
        subsidy_flagged = (
            self.return_subsidy_enabled
            and should_flag_return_subsidy(player.points)
        )
        if subsidy_flagged:
            self._set_subsidy_flag(player)
            self.return_subsidy_flag_count += 1
        player.actions["return_to_deck"] = player.actions.get("return_to_deck", 0) + 1
        self._record("return_to_deck", player.name, {
            "card_id": card_id,
            "cost": RETURN_TO_DECK_COST,
            "practiced_before_return": practiced,
            "subsidy_flagged": subsidy_flagged,
            "public": False,
        })

    def _draw_available_difficulty(self) -> int:
        available = {self.cards[card_id].difficulty for card_id in self.deck}
        weights = dict(DIFFICULTY_DISTRIBUTION)
        missing_weight = sum(weight for difficulty, weight in weights.items() if difficulty not in available)
        weights = {difficulty: weight for difficulty, weight in weights.items() if difficulty in available}
        lowest = min(weights)
        weights[lowest] += missing_weight
        return self._weighted_choice(list(weights.items()))

    def _cooldown_until(self, player: Player) -> datetime | None:
        if player.last_take_at is None:
            return None
        if (
            self.take_cooldown_policy in ALL_FIELD_FIRST_POLICIES
            and player.cooldown_released_take_at == player.last_take_at
        ):
            return player.last_take_at
        credit = player.cooldown_credit_minutes if self.take_cooldown_policy in POST_CREDIT_POLICIES else 0
        ready_at = player.last_take_at + TAKE_COOLDOWN - timedelta(minutes=min(90, credit))
        if self.take_cooldown_policy in ENDGAME_FREE_POLICIES:
            ready_at = min(ready_at, self.end_at - ENDGAME_FREE_BEFORE_END)
        return ready_at

    def _all_field_first_condition(self, player: Player) -> bool:
        if len(self.field) < 2:
            return False
        if not any(self.cards[card_id].taker != player.name for card_id in self.field):
            return False
        for card_id in self.field:
            card = self.cards[card_id]
            player_score = card.scores.get(player.name)
            if player_score is None or player_score < max(card.scores.values(), default=float("inf")):
                return False
        return True

    def _cooldown_ready(self, player: Player, at: datetime, mutate_release: bool = True) -> bool:
        ready_at = self._cooldown_until(player)
        if ready_at is None or at >= ready_at:
            return True
        if self.take_cooldown_policy not in ALL_FIELD_FIRST_POLICIES or not self._all_field_first_condition(player):
            return False
        if mutate_release and player.cooldown_released_take_at != player.last_take_at:
            player.cooldown_released_take_at = player.last_take_at
            self.cooldown_release_count += 1
        return True

    def _take_non_cooldown_conditions(self, player: Player) -> bool:
        return (
            len(player.hand) >= self._required_take_hand(player)
            and self.now < self.end_at - TAKE_CLOSE_BEFORE_END
            and len(self.field) < self._field_cap()
        )

    def _waiting_only_for_cooldown(self, player: Player) -> bool:
        return (
            bool(self.field)
            and all(player.name in self.cards[card_id].posted_players for card_id in self.field)
            and self._take_non_cooldown_conditions(player)
            and not self._cooldown_ready(player, self.now, mutate_release=False)
        )

    def _cooldown_stall_now(self) -> bool:
        if not self.field:
            return False
        candidates = [
            player
            for player in self.players.values()
            if player.is_active(self.now)
            and (player.busy_until is None or player.busy_until <= self.now)
            and self._take_non_cooldown_conditions(player)
        ]
        return bool(candidates) and all(
            not self._cooldown_ready(player, self.now, mutate_release=False)
            for player in candidates
        )

    def _apply_post_cooldown_credit(self, player: Player) -> int:
        if self.take_cooldown_policy not in POST_CREDIT_POLICIES or player.last_take_at is None:
            return 0
        if self._cooldown_ready(player, self.now, mutate_release=False):
            return 0
        before = player.cooldown_credit_minutes
        player.cooldown_credit_minutes = min(90, before + POST_COOLDOWN_CREDIT_MINUTES)
        applied = player.cooldown_credit_minutes - before
        if applied > 0:
            self.cooldown_post_credit_events += 1
            self.cooldown_post_credit_minutes += applied
        return applied

    def _can_take(self, player: Player) -> bool:
        return self._take_block_reason(player) is None

    def _take_block_reason(self, player: Player) -> str | None:
        if len(player.hand) < self._required_take_hand(player):
            return "insufficient_hand"
        if self.now >= self.end_at - TAKE_CLOSE_BEFORE_END:
            return "take_closed"
        if len(self.field) >= self._field_cap():
            return "field_cap"
        if not self._cooldown_ready(player, self.now):
            return "take_cooldown"
        return None

    def _take_level(self, player: Player) -> int:
        if self.take_cost_mode == "level_sqrt":
            return sqrt_take_level(len(player.take_times))
        return take_level_for_count(len(player.take_times), self.take_level_up_every)

    def _required_take_hand(self, player: Player) -> int:
        if self.take_cost_mode in {"level_linear", "level_sqrt"}:
            return level_take_requirement(self._take_level(player))
        return required_take_hand(len(self.field))

    def _hand_limit(self, player: Player) -> int:
        return player_hand_limit(sqrt_take_level(len(player.take_times)))

    def _field_cap(self) -> int:
        return field_cap(self.participant_count())

    def _select_take_card(self, player: Player) -> int | None:
        if not player.hand:
            return None
        if self.behavior_policy == "commitment_aware":
            return max(
                player.hand,
                key=lambda cid: (
                    self._take_desire(player, cid),
                    self._effective_practice_minutes(player.private_practice.get(cid, 0)),
                    self._sharing_appeal(player, cid),
                ),
            )
        preferred_hand = [cid for cid in player.hand if cid in player.favorite_card_ids]
        selection_pool = preferred_hand or player.hand
        max_practice = max(player.private_practice.get(cid, 0) for cid in selection_pool)
        candidates = [cid for cid in selection_pool if player.private_practice.get(cid, 0) == max_practice]
        return max(candidates, key=lambda cid: self._sharing_appeal(player, cid))

    def _sharing_appeal(self, player: Player, cid: int) -> float:
        # Stable, private preferences; no privileged access to other players' hands.
        return self.player_tastes[player.name][cid] + self.card_appeal[cid] * 0.6

    def _contrarian_action(self, player: Player) -> dict[str, Any] | None:
        if player.name not in self.contrarians or player.name in self.trap_returns:
            return None
        if not self.field or self.now >= self.end_at - timedelta(hours=3):
            return None
        cid = self.trap_targets.get(player.name)
        if cid is None and player.hand and player.points >= 2:
            cid = max(player.hand, key=lambda c: self.player_tastes[player.name][c])
            self.trap_targets[player.name] = cid
        if cid not in player.hand:
            return None
        practiced = player.private_practice.get(cid, 0)
        if practiced >= 30 and player.points >= 1 and self.return_to_deck_enabled:
            self.trap_returns.add(player.name)
            player.actions["trap_return"] = player.actions.get("trap_return", 0) + 1
            return {"type": "return_to_deck", "card_id": cid}
        duration = max(difficulty_minimum_minutes(self.cards[cid].difficulty), 30 - practiced)
        if practiced < 30 and self._can_finish_timed_action(player, duration, self.end_at - TAKE_CLOSE_BEFORE_END):
            return {"type": "practice", "card_id": cid, "duration": duration}
        return None

    def _take(self, player: Player, card_id: int, trigger: str = "decision") -> None:
        take_level = self._take_level(player)
        required_hand = self._required_take_hand(player)
        if not self._can_take(player) or card_id not in player.hand:
            reason = "card_not_in_hand" if card_id not in player.hand else self._take_block_reason(player)
            self._record("wait", player.name, {
                "reason": reason or "take_not_allowed",
                "next_take_at": self._iso(self._cooldown_until(player)),
            })
            return
        previous_take_at = player.last_take_at
        stack_cards = player.hand[:]
        committed_card = self._committed_hand_card(player)
        player.hand = []
        card = self.cards[card_id]
        card.state = "_field"
        card.taker = player.name
        card.stack_count = len(stack_cards)
        player.max_stack_count = max(player.max_stack_count, card.stack_count)
        card.stack_ids = [cid for cid in stack_cards if cid != card_id]
        card.scores.clear()
        card.play_time.clear()
        card.attempt_count.clear()
        card.trial_count.clear()
        card.update_count.clear()
        card.last_update_duration.clear()
        card.posted_players.clear()
        card.paid_players.clear()
        card.reward_log.clear()
        card.pot_bonus_points = 0
        card.late_first_extension = False
        card.paid_points_total = 0
        card.paid_points_by_player.clear()
        card.paid_extension_points_total = 0
        card.extension_counts_by_player.clear()
        card.extension_players.clear()
        card.taken_at = self.now
        card.collected_at = None
        if previous_take_at is not None and self.now - previous_take_at < TAKE_COOLDOWN:
            player.relaxed_take_times.append(self.now)
        player.last_take_at = self.now
        player.take_times.append(self.now)
        player.take_stack_counts.append(card.stack_count)
        player.take_costs.append(required_hand)
        player.cooldown_credit_minutes = 0
        player.cooldown_released_take_at = None
        if (
            self.take_cooldown_policy in ENDGAME_FREE_POLICIES
            and previous_take_at is not None
            and self.now >= self.end_at - ENDGAME_FREE_BEFORE_END
            and self.now - previous_take_at < TAKE_COOLDOWN
        ):
            self.endgame_free_take_count += 1
        card.limit_at = self.now + timedelta(minutes=initial_countdown_minutes(card.difficulty))
        card.holder_names = []
        self.queue.push(card.limit_at, "collect", {"card_id": card.id, "limit_at": card.limit_at.isoformat()})
        for stack_id in card.stack_ids:
            self.cards[stack_id].state = "_stack"
        self.field.append(card_id)
        self._extend_activity_for_card(card)
        if player.points < self.participant_count():
            self._set_subsidy_flag(player)
        player.actions["take"] = player.actions.get("take", 0) + 1
        if committed_card == card_id:
            player.actions["committed_take"] = player.actions.get("committed_take", 0) + 1
        self._record("take", player.name, {
            "card_id": card_id,
            "take_desire": round(self._take_desire(player, card_id), 4),
            "self_created": card.creator_name == player.name,
            "favorite": card_id in player.favorite_card_ids,
            "committed": committed_card == card_id,
            "stack_count": card.stack_count,
            "required_hand": required_hand,
            "take_level": take_level,
            "trigger": trigger,
            "stack_ids": card.stack_ids,
            "cooldown_until": self._iso(self._cooldown_until(player)),
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
        cost = self._initial_post_cost(card, player)
        expected_point_net = self._expected_initial_post_point_net(player, card, duration)
        if not self._paid_post_is_acceptable(player, card, expected_point_net):
            player.actions["post_withheld_expected_loss"] = (
                player.actions.get("post_withheld_expected_loss", 0) + 1
            )
            self._record("wait", player_name, {
                "reason": "post_withheld_expected_loss",
                "card_id": card_id,
                "cost": cost,
                "expected_point_net": expected_point_net,
                "participant_order": existing_participants + 1,
            })
            self._schedule_next_decision(player, 0)
            return
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
        if paid_now:
            player.points -= cost
            card.paid_players.add(player.name)
            card.paid_points_total += cost
            card.paid_points_by_player[player.name] = card.paid_points_by_player.get(player.name, 0) + cost
        score_result = self._submit_score_trial(player, card, duration, outcome, is_update=False)
        self._refresh_attachment(player, card, outcome)
        cooldown_credit = self._apply_post_cooldown_credit(player) if paid_now else 0
        extension_minutes = 0
        if card.limit_at is None:
            card.limit_at = (card.taken_at or self.now) + timedelta(
                minutes=initial_countdown_minutes(card.difficulty)
            )
            self.queue.push(card.limit_at, "collect", {"card_id": card.id, "limit_at": card.limit_at.isoformat()})
        elif paid_now:
            participant_order = existing_participants + 1
            remaining_minutes = (card.limit_at - self.now).total_seconds() / 60
            if participant_order == 1 and remaining_minutes < LATE_FIRST_POST_THRESHOLD_MINUTES:
                card.late_first_extension = True
            extension_minutes = initial_post_extension_minutes(participant_order, remaining_minutes)
            card.limit_at += timedelta(minutes=extension_minutes)
            self.queue.push(card.limit_at, "collect", {"card_id": card.id, "limit_at": card.limit_at.isoformat()})
        self._extend_activity_for_card(card)
        player.actions["initial_post"] = player.actions.get("initial_post", 0) + 1
        self._record("initial_post", player.name, {
            "card_id": card_id,
            "duration": duration,
            "paid_now": paid_now,
            "cost": cost if paid_now else 0,
            "score": card.scores[player.name],
            "candidate_score": round(outcome["candidate_score"], 6),
            "score_improved": score_result["improved"],
            "participant_order": existing_participants + 1,
            "extension_minutes": extension_minutes,
            "attempt_count": card.attempt_count[player.name],
            "effective_practice_minutes": round(
                self._effective_practice_minutes(player.private_practice.get(card.id, 0)),
                3,
            ),
            "cooldown_credit_minutes": cooldown_credit,
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
        update_cost = self._update_post_cost(card)
        if not self.allow_post_debt and player.points < update_cost:
            self._record("wait", player_name, {
                "reason": "update_cost_unaffordable",
                "card_id": card_id,
                "cost": update_cost,
            })
            self._schedule_next_decision(player, 0)
            return
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
        assessment = self._paid_update_assessment(
            player,
            card,
            duration,
            candidate_score=outcome["candidate_score"],
        )
        completed_action = {
            "cost": update_cost,
            "duration": duration,
            **assessment,
        }
        if not self._paid_update_is_acceptable(completed_action, include_time=False):
            player.actions["update_score_withheld_rank_value"] = (
                player.actions.get("update_score_withheld_rank_value", 0) + 1
            )
            self._record("score_trial_withheld", player.name, {
                "card_id": card_id,
                "duration": duration,
                "candidate_score": round(outcome["candidate_score"], 6),
                "expected_score": round(outcome["expected_score"], 6),
                "reason": "update_rank_point_roi_too_low",
                "cost": update_cost,
                **assessment,
            })
            self._refresh_attachment(player, card, outcome)
            self._schedule_next_decision(player, 0)
            return
        player.points -= update_cost
        card.paid_points_total += update_cost
        card.paid_points_by_player[player.name] = card.paid_points_by_player.get(player.name, 0) + update_cost
        if assessment["expected_rank_point_gain"] <= 0:
            player.actions["update_paid_without_rank_point_gain"] = (
                player.actions.get("update_paid_without_rank_point_gain", 0) + 1
            )
        if update_cost > 0 and not paid_update_is_rational(
            assessment["expected_rank_point_gain"],
            update_cost,
            duration,
            include_time=False,
        ):
            player.actions["update_paid_below_point_roi"] = (
                player.actions.get("update_paid_below_point_roi", 0) + 1
            )
        player.actions["update_points_spent"] = player.actions.get("update_points_spent", 0) + update_cost
        player.actions["update_forecast_rank_point_gain"] = (
            player.actions.get("update_forecast_rank_point_gain", 0)
            + assessment["expected_rank_point_gain"]
        )
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
            **assessment,
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
        if self.score_policy == "stochastic_card_skill":
            player.card_skill_minutes[card_id] = player.card_skill_minutes.get(card_id, 0.0) + (
                duration * SCORE_SKILL_EFFICIENCY[player.skill_tier]
            )
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

    def _run_score_trial(self, player: Player, card: Card, duration: int) -> dict[str, float]:
        total_time = card.play_time.get(player.name, 0) + duration
        card.play_time[player.name] = total_time
        card.trial_count[player.name] = card.trial_count.get(player.name, 0) + 1
        if self.score_policy == "stochastic_card_skill":
            player.card_skill_minutes[card.id] = player.card_skill_minutes.get(card.id, 0.0) + (
                duration * SCORE_SKILL_EFFICIENCY[player.skill_tier]
            )
            expected_score = self._expected_card_score(player, card)
            candidate_score = self.score_rng.gauss(expected_score, SCORE_TRIAL_NOISE)
        else:
            expected_score = self._score_for_minutes(
                player,
                total_time,
                player.private_practice.get(card.id, 0),
            )
            candidate_score = expected_score
        return {
            "candidate_score": candidate_score,
            "expected_score": expected_score,
        }

    def _submit_score_trial(
        self,
        player: Player,
        card: Card,
        duration: int,
        outcome: dict[str, float],
        is_update: bool,
    ) -> dict[str, bool]:
        previous_score = card.scores.get(player.name, float("-inf"))
        candidate_score = outcome["candidate_score"]
        improved = candidate_score > previous_score
        card.attempt_count[player.name] = card.attempt_count.get(player.name, 0) + 1
        if is_update:
            card.update_count[player.name] = card.update_count.get(player.name, 0) + 1
            card.last_update_duration[player.name] = duration
        card.scores[player.name] = max(previous_score, candidate_score)
        card.posted_players.add(player.name)
        return {"improved": improved}

    def _should_withhold_initial_score(
        self,
        player: Player,
        card: Card,
        outcome: dict[str, float],
    ) -> bool:
        if self.score_policy != "stochastic_card_skill":
            return False
        if card.trial_count.get(player.name, 0) >= 3:
            return False
        remaining = max(0.0, ((card.limit_at or self.now) - self.now).total_seconds() / 60.0)
        retry_floor = {1: 10, 2: 16, 3: 24, 4: 34, 5: 45}[min(5, max(1, card.difficulty or 1))]
        if remaining <= retry_floor + WAIT_RECHECK_MINUTES:
            return False
        return outcome["candidate_score"] < outcome["expected_score"] - SCORE_TRIAL_NOISE

    def _is_below_normal_hierarchy(self, player: Player, card: Card) -> bool:
        player_score = card.scores.get(player.name)
        if player_score is None:
            return False
        player_tier = SKILL_TIER_ORDER[player.skill_tier]
        return any(
            SKILL_TIER_ORDER[self.players[other_name].skill_tier] < player_tier
            and other_score > player_score
            for other_name, other_score in card.scores.items()
            if other_name != player.name
        )

    def _refresh_attachment(
        self,
        actor: Player,
        card: Card,
        outcome: dict[str, float],
    ) -> None:
        actor_reasons = actor.attachment_reasons.setdefault(card.id, set())
        if card.id in actor.favorite_card_ids or self.player_tastes[actor.name][card.id] >= 0.9:
            actor_reasons.add("favorite")
        if outcome["candidate_score"] >= outcome["expected_score"] + SCORE_TRIAL_NOISE * 0.9:
            actor_reasons.add("upward_score")
        for player_name in card.posted_players:
            player = self.players[player_name]
            reasons = player.attachment_reasons.setdefault(card.id, set())
            if self._is_below_normal_hierarchy(player, card):
                reasons.add("hierarchy_upset")
            else:
                reasons.discard("hierarchy_upset")
            if not reasons:
                player.attachment_reasons.pop(card.id, None)

    def _apply_score(self, player: Player, card: Card, duration: int, is_update: bool) -> dict[str, Any]:
        outcome = self._run_score_trial(player, card, duration)
        submitted = self._submit_score_trial(player, card, duration, outcome, is_update)
        return {**outcome, **submitted}

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
        if ranking and self.dynamic_wealth_tax_pot and self.pot_points > 0:
            card.pot_bonus_points += self.pot_points
            self.pot_distributed_points += self.pot_points
            self.pot_distribution_events += 1
            self.pot_points = 0
        x_score = card.scores.get("player_01")
        other_scores = [
            score for name, score in card.scores.items()
            if self.players[name].skill_tier == "other"
        ]
        if x_score is not None and other_scores:
            self.x_other_score_fields += 1
            self.x_other_upset_fields += int(max(other_scores) > x_score)
            self.x_other_score_pairs += len(other_scores)
            self.x_other_upset_pairs += sum(score > x_score for score in other_scores)
        rank_points = self._apply_rank_points(card, ranking)
        rewards = self._apply_collection_rewards(card, ranking)
        for player in self.players.values():
            player.attachment_reasons.pop(card_id, None)
        card.holder_names = holder_names_from_ranking(ranking)
        participant_count = sum(len(group["players"]) for group in ranking)
        self.collection_participant_counts[participant_count] = (
            self.collection_participant_counts.get(participant_count, 0) + 1
        )
        subsidy_flagged_holders: list[str] = []
        if self.now < self.end_at:
            for player_name in card.holder_names:
                player = self.players[player_name]
                if player.points < self.participant_count():
                    self._set_subsidy_flag(player)
                    subsidy_flagged_holders.append(player_name)
        card.collected_at = self.now
        if card_id in self.field:
            self.field.remove(card_id)
        recycled_unposted = self.recycle_unposted and participant_count == 0
        if recycled_unposted:
            card.state = "_trash"
            self.trash.append(card_id)
            self.unposted_recycle_count += 1
        else:
            card.state = "_collected"
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
            "subsidy_flagged_holders": subsidy_flagged_holders,
            "recycled_unposted": recycled_unposted,
            "pot_bonus_points": card.pot_bonus_points,
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
            amount = self._total_reward_points(card)
            self.players[only].points += amount
            card.reward_log.append({"player": only, "points": amount, "type": "single_poster"})
            return {"total_reward": amount, "rank_distribution": {only: amount}, "taker_remainder": 0}
        total_reward = self._total_reward_points(card)
        eligible_groups = self._eligible_reward_groups(ranking)
        if self.reward_formula == "proposal":
            rank_distribution, taker_remainder = proposed_position_distribution(ranking, total_reward)
            eligible_groups = [group["players"][:] for group in ranking]
        else:
            rank_distribution, taker_remainder = distribute_rank_rewards(total_reward, eligible_groups)
        for player_name, amount in rank_distribution.items():
            self.players[player_name].points += amount
            card.reward_log.append({"player": player_name, "points": amount, "type": "rank_distribution"})
        remainder_distribution: dict[str, int] = {}
        if taker_remainder:
            if self.remainder_policy == "last_poster":
                last_players = sorted(ranking[-1]["players"])
                share, extra = divmod(taker_remainder, len(last_players))
                remainder_distribution = {
                    player_name: share + int(index < extra)
                    for index, player_name in enumerate(last_players)
                    if share + int(index < extra) > 0
                }
            elif card.taker:
                remainder_distribution = {card.taker: taker_remainder}
            for player_name, amount in remainder_distribution.items():
                self.players[player_name].points += amount
                card.reward_log.append({
                    "player": player_name,
                    "points": amount,
                    "type": "last_poster_remainder" if self.remainder_policy == "last_poster" else "taker_remainder",
                })
        return {
            "total_reward": total_reward,
            "rank_distribution": rank_distribution,
            "taker_remainder": taker_remainder,
            "remainder_policy": self.remainder_policy,
            "remainder_distribution": remainder_distribution,
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
        return calculate_total_reward(
            base,
            card.difficulty or 1,
            len(card.posted_players),
            self.reward_formula,
        ) + card.pot_bonus_points

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
        return calculate_total_reward(
            base,
            card.difficulty or 1,
            max(1, len(card.posted_players)),
            self.reward_formula,
        )

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
        for player in self.players.values():
            player.max_points = max(player.max_points, player.points)
        if self.write_outputs:
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
        if event_type != "empty_field_floor_grant":
            self._apply_empty_field_floor_grant()

    def _apply_empty_field_floor_grant(self) -> None:
        if not self.empty_field_floor_grant or self.field or self.now >= self.end_at:
            return
        participants = [player for player in self.players.values() if player.joined]
        grants = empty_field_floor_grants(
            [(player.name, player.points, len(player.hand)) for player in participants],
            field_empty=True,
        )
        if not grants:
            return
        for player in participants:
            player.points += grants[player.name]
        total_points = sum(grants.values())
        self.empty_field_floor_grant_events += 1
        self.empty_field_floor_grant_points += total_points
        self._record("empty_field_floor_grant", None, {
            "grants": grants,
            "total_points": total_points,
            "resource_floor": 3,
            "participant_count": len(participants),
        })

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
            "creator": card.creator_name,
            "rarity": card.rarity,
            "difficulty": card.difficulty,
            "taker": card.taker,
            "stack_count": card.stack_count,
            "paid_points_total": card.paid_points_total,
            "paid_points_by_player": card.paid_points_by_player,
            "paid_extension_points_total": card.paid_extension_points_total,
            "pot_bonus_points": card.pot_bonus_points,
            "extension_counts_by_player": card.extension_counts_by_player,
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
            "history_icon_cards": [
                card_id for card_id in player.hand
                if self.cards[card_id].return_history
            ],
            "subsidy_flag_slot_at": self._iso(player.subsidy_flag_slot_at),
            "last_take_at": self._iso(player.last_take_at),
            "next_take_at": self._iso(self._cooldown_until(player)),
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
            if self.dynamic_hand_limit and len(player.hand) > self._hand_limit(player):
                self.invariant_errors.append(
                    f"{context}: {player.name} hand {len(player.hand)} exceeded limit {self._hand_limit(player)}"
                )
        for card in self.cards.values():
            if sum(card.paid_points_by_player.values()) != card.paid_points_total:
                self.invariant_errors.append(
                    f"{context}: card {card.id} paid point ledger mismatch"
                )
        for player in self.players.values():
            for previous, current in zip(player.take_times, player.take_times[1:]):
                if current - previous < TAKE_COOLDOWN and current not in player.relaxed_take_times:
                    self.invariant_errors.append(
                        f"{context}: {player.name} unapproved take cooldown violation "
                        f"{self._iso(previous)} -> {self._iso(current)}"
                    )
        for card_id in self.field:
            card = self.cards[card_id]
            minimum_stack = 2 if self.take_cost_mode == "level_sqrt" else 3
            if card.stack_count < minimum_stack:
                self.invariant_errors.append(
                    f"{context}: field card {card_id} stack_count < {minimum_stack}"
                )
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
                    "creator_cards_taken": sum(
                        1 for card in self.cards.values() if card.creator_name == p.name and card.taker == p.name
                    ),
                    "skill_multiplier": p.skill_multiplier,
                    "skill_tier": p.skill_tier,
                    "points": p.points,
                    "max_points": p.max_points,
                    "rank_points": p.rank_points,
                    "total_active_minutes": p.total_active_minutes(),
                    "total_active_hours": round(p.total_active_minutes() / 60, 2),
                    "max_continuous_hours": p.max_continuous_hours,
                    "max_stack_count": p.max_stack_count,
                    "take_count": len(p.take_times),
                    "draw_count": p.actions.get("draw", 0),
                    "mean_take_stack": round(statistics.mean(p.take_stack_counts), 3) if p.take_stack_counts else None,
                    "take_stack_counts": p.take_stack_counts,
                    "take_costs": p.take_costs,
                    "take_levels": [
                        (
                            sqrt_take_level(index)
                            if self.take_cost_mode == "level_sqrt"
                            else take_level_for_count(index, self.take_level_up_every)
                            if self.take_cost_mode == "level_linear"
                            else None
                        )
                        for index in range(len(p.take_times))
                    ],
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
        take_counts = [len(player.take_times) for player in self.players.values()]
        total_takes = sum(take_counts)
        max_player_takes = max(take_counts, default=0)
        collection_rewards = sum(
            entry["points"]
            for card in self.cards.values()
            for entry in card.reward_log
        )
        field_payments = sum(card.paid_points_total for card in self.cards.values())
        paid_extensions = sum(card.paid_extension_points_total for card in self.cards.values())
        post_fees = field_payments - paid_extensions
        tournament_max_points = max((player.max_points for player in self.players.values()), default=0)
        tournament_max_point_players = sorted(
            player.name
            for player in self.players.values()
            if player.max_points == tournament_max_points
        )
        submitted_score_attempts = sum(
            player.actions.get("initial_post", 0) + player.actions.get("update", 0)
            for player in self.players.values()
        )
        withheld_initial = sum(player.actions.get("initial_score_withheld", 0) for player in self.players.values())
        withheld_updates = sum(player.actions.get("update_score_withheld", 0) for player in self.players.values())
        summary = {
            "seed": self.seed,
            "jsonl_path": str(self.jsonl_path),
            "summary_path": str(self.summary_path),
            "start_at": self._iso(self.start_at),
            "end_at": self._iso(self.end_at),
            "events_written": self.events_written,
            "collections": self.collections,
            "subsidy_payments": self.subsidy_payments,
            "empty_field_floor_grant": {
                "events": self.empty_field_floor_grant_events,
                "points": self.empty_field_floor_grant_points,
            },
            "activity_extension": {
                "events": self.activity_extension_events,
                "minutes": self.activity_extension_minutes,
            },
            "policy": {
                "rarity_growth": "exponential",
                "rarity_initial_rate": RARITY_INITIAL_RATE,
                "rarity_boost_peak_hour": RARITY_BOOST_PEAK_HOUR,
                "rarity_peak_rate": RARITY_PEAK_RATE,
                "decision_model": "multi_step_forecast_v3_skill_aware",
                "paid_update_policy": self.paid_update_policy,
                "allow_post_debt": self.allow_post_debt,
                "dynamic_wealth_tax_pot": self.dynamic_wealth_tax_pot,
                "dynamic_hand_limit": self.dynamic_hand_limit,
                "wealth_tax_threshold": "strictly above (player level + 2) * 5; 1P per subsidy slot",
                "player_hand_limit": "(player level + 2) * 3",
                "paid_update_min_rank_points_per_point": MIN_PAID_UPDATE_RANK_POINTS_PER_POINT,
                "score_policy": self.score_policy,
                "remainder_policy": self.remainder_policy,
                "player_extension_enabled": self.player_extension_enabled,
                "paid_extension_cost": PLAYER_EXTENSION_COST,
                "paid_extension_minutes": PLAYER_EXTENSION_MINUTES,
                "paid_extension_cutoff": "event end minus 1 hour",
                "behavior_policy": self.behavior_policy,
                "activity_policy": self.activity_policy,
                "peak_hours_jst": "20:00-01:00",
                "offpeak_hours_jst": "04:00-14:00",
                "engagement_extension": self.activity_policy == "peak_engagement",
                "take_desire_factors": "confidence + private taste + public appeal + creator + personality interest",
                "participant_creator_card_rate": PARTICIPANT_CREATOR_CARD_RATE,
                "draw_cost_in_action_value": self.behavior_policy == "commitment_aware",
                "desired_card_draw_hesitation": self.behavior_policy == "commitment_aware",
                "time_model": (
                    "random_trial_duration_by_difficulty"
                    if self.score_policy == "stochastic_card_skill"
                    else "target_score_cost_v1"
                ),
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
                "take_audience_horizon_minutes_by_difficulty": [
                    initial_countdown_minutes(level) for level in range(1, 6)
                ],
                "first_post_extension_minutes": FIRST_POST_EXTENSION_MINUTES,
                "late_first_post_threshold_minutes": LATE_FIRST_POST_THRESHOLD_MINUTES,
                "late_first_post_extension_minutes": LATE_FIRST_POST_EXTENSION_MINUTES,
                "subsequent_post_extension_minutes": SUBSEQUENT_POST_EXTENSION_MINUTES,
                "take_cooldown_minutes": int(TAKE_COOLDOWN.total_seconds() // 60),
                "take_cooldown_policy": self.take_cooldown_policy,
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
                "initial_limit_minutes_by_difficulty": [
                    initial_countdown_minutes(level) for level in range(1, 6)
                ],
                "initial_post_extension": "first: 15 or 30 minutes; later: 10 minutes",
                "stack_time_bonus": False,
                "take_cost_mode": self.take_cost_mode,
                "take_level_up_every": self.take_level_up_every if self.take_cost_mode == "level_linear" else None,
                "take_hand_requirement": (
                    "3 + floor(current_field_count / 2)"
                    if self.take_cost_mode == "field"
                    else "level L = 1 + floor(successful_takes / k); required stack = L + 2"
                    if self.take_cost_mode == "level_linear"
                    else "level L = floor(sqrt(successful_takes)); required stack = L + 2"
                ),
                "skill_tier_order": (
                    "expected X > Y > other with stochastic upsets"
                    if self.score_policy == "stochastic_card_skill"
                    else "X > Y > other; multiplier breaks ties within a tier"
                ),
                "paid_post_loss_avoidance": sorted(POINT_RETURN_SENSITIVE_PERSONALITIES),
                "paid_post_loss_avoidance_also_applies_to_tier": "Y",
                "free_first_second_posts_ignore_expected_point_loss": self.post_cost_policy != "taker_initial_and_retries_paid",
                "field_cap": "min(max(1, cumulative_participants - 1), 16)",
                "entry_cost": (
                    "non-taker initial free; taker initial and every submitted update cost difficulty"
                    if self.post_cost_policy == "taker_initial_and_retries_paid"
                    else "free for 1st and 2nd; difficulty for 3rd+"
                    if self.post_cost_policy == "first_second_free_difficulty"
                    else "legacy rarity-based order policy"
                ),
                "post_cost_policy": self.post_cost_policy,
                "reward_formula": self.reward_formula,
                "recycle_unposted": self.recycle_unposted,
                "empty_field_floor_grant": self.empty_field_floor_grant,
                "rank_point_first_bonus": 1,
                "rank_point_basis": "participant_count",
                "rank_point_display": "confirmed + live field provisional",
                "subsidy_threshold": "empty: points + hand < 8; take/winner: points < cumulative participants",
                "subsidy_action_flags": "take and natural-collection winner; one slot; no payout-time recheck",
                "subsidy_empty_field": "recurs while field is empty and points + hand < 8",
                "difficulty_assignment": "intrinsic_card_value",
                "missing_difficulty_weight": "lowest_available_difficulty",
                "return_to_deck_enabled": self.return_to_deck_enabled,
                "return_to_deck_cost": RETURN_TO_DECK_COST,
                "return_subsidy_flag_threshold_after_payment": RETURN_SUBSIDY_FLAG_THRESHOLD,
                "return_subsidy_enabled": self.return_subsidy_enabled,
                "returned_card_rarity": "preserve first draw rarity",
                "return_event_visibility": "private",
                "return_history_icon": "visible in hand after redraw",
                "return_to_deck_policy": "disliked surplus returns; bounded contrarian practice-return ambush",
                "return_cost_destination": "pot" if self.dynamic_wealth_tax_pot else "sink",
            },
            "rarity_draw_counts": self.rarity_draw_counts,
            "score_model": {
                "trials": submitted_score_attempts + withheld_initial + withheld_updates,
                "submitted_attempts": submitted_score_attempts,
                "withheld_initial": withheld_initial,
                "withheld_updates": withheld_updates,
                "withheld_update_rank_value": sum(
                    player.actions.get("update_score_withheld_rank_value", 0)
                    for player in self.players.values()
                ),
                "rejected_update_plans_rank_value": sum(
                    player.actions.get("update_plan_rejected_rank_value", 0)
                    for player in self.players.values()
                ),
                "attachment_actions": sum(player.actions.get("attachment_action", 0) for player in self.players.values()),
                "x_vs_other_fields": self.x_other_score_fields,
                "x_upset_fields": self.x_other_upset_fields,
                "x_upset_rate": round(self.x_other_upset_fields / self.x_other_score_fields, 6) if self.x_other_score_fields else None,
                "x_vs_other_pairs": self.x_other_score_pairs,
                "x_upset_pairs": self.x_other_upset_pairs,
                "x_pairwise_upset_rate": round(self.x_other_upset_pairs / self.x_other_score_pairs, 6) if self.x_other_score_pairs else None,
            },
            "paid_extensions": {
                "count": paid_extensions,
                "points_spent": paid_extensions,
                "minutes_added": paid_extensions * PLAYER_EXTENSION_MINUTES,
            },
            "players": players,
            "deck_count": len(self.deck),
            "trash_count": len(self.trash),
            "field_count": len(self.field),
            "collected_count": len(self.collected),
            "unposted_recycle_count": self.unposted_recycle_count,
            "return_to_deck": {
                "count": self.return_to_deck_count,
                "points_spent": self.return_to_deck_count * RETURN_TO_DECK_COST,
                "redraw_count": self.returned_card_redraw_count,
                "other_player_redraw_count": self.returned_card_other_player_redraw_count,
                "practiced_before_return_count": self.practiced_return_count,
                "subsidy_flag_count": self.return_subsidy_flag_count,
            },
            "cooldown": {
                "policy": self.take_cooldown_policy,
                "release_count": self.cooldown_release_count,
                "post_credit_events": self.cooldown_post_credit_events,
                "post_credit_minutes": self.cooldown_post_credit_minutes,
                "endgame_free_takes": self.endgame_free_take_count,
                "endgame_cooldown_blocked_players": len(self.endgame_cooldown_blocked_players),
                "endgame_cooldown_blocked_cycles": len(self.endgame_cooldown_blocked_cycles),
                "rapid_take_count": sum(len(player.relaxed_take_times) for player in self.players.values()),
                "max_zero_time_burst": max(
                    (max_take_burst(player.take_times, timedelta(0)) for player in self.players.values()),
                    default=0,
                ),
                "max_sub90_burst": max(
                    (max_take_burst(player.take_times, TAKE_COOLDOWN) for player in self.players.values()),
                    default=0,
                ),
                "max_takes_by_player": max_player_takes,
                "max_take_share": round(max_player_takes / total_takes, 4) if total_takes else 0.0,
                "cooldown_stall_snapshots": self.cooldown_stall_snapshot_count,
                "all_field_posted_cooldown_waits": self.all_field_posted_cooldown_waits,
            },
            "economy": {
                "ending_points": sum(player.points for player in self.players.values()),
                "tournament_max_player_points": tournament_max_points,
                "tournament_max_point_players": tournament_max_point_players,
                "draw_costs": sum(player.actions.get("draw", 0) for player in self.players.values()),
                "post_fees": post_fees,
                "extension_costs": paid_extensions,
                "field_payments": field_payments,
                "return_costs": self.return_to_deck_count * RETURN_TO_DECK_COST,
                "collection_rewards": collection_rewards,
                "organic_collection_rewards": collection_rewards - self.pot_distributed_points,
                "pot": {
                    "ending_points": self.pot_points,
                    "tax_inflow": self.pot_tax_inflow,
                    "return_inflow": self.pot_return_inflow,
                    "distributed_points": self.pot_distributed_points,
                    "distribution_events": self.pot_distribution_events,
                },
                "wealth_tax_events": self.wealth_tax_events,
                "hand_limit_blocked_draws": self.hand_limit_blocked_draws,
                "subsidy_payments": self.subsidy_payments,
                "empty_field_floor_grant_points": self.empty_field_floor_grant_points,
                "confirmed_rank_points": sum(player.rank_points for player in self.players.values()),
            },
            "collection_participant_counts": {
                str(count): amount
                for count, amount in sorted(self.collection_participant_counts.items())
            },
            "invariant_errors": self.invariant_errors,
        }
        if not minimal:
            summary["half_hour_snapshots"] = self.half_hour_snapshots
        if not minimal:
            summary["fixed_reward_tests"] = fixed_reward_tests()
            summary["fixed_rarity_tests"] = fixed_rarity_tests()
            summary["fixed_difficulty_tests"] = fixed_difficulty_tests()
            summary["fixed_rank_point_tests"] = fixed_rank_point_tests()
            summary["fixed_prediction_tests"] = fixed_prediction_tests()
            summary["fixed_time_model_tests"] = fixed_time_model_tests()
            summary["fixed_entry_rule_tests"] = fixed_entry_rule_tests()
            summary["fixed_countdown_tests"] = fixed_countdown_tests()
            summary["fixed_holder_tests"] = fixed_holder_tests()
            summary["fixed_take_cooldown_tests"] = fixed_take_cooldown_tests()
            summary["fixed_relaxed_take_tests"] = fixed_relaxed_take_tests()
            summary["fixed_return_to_deck_tests"] = fixed_return_to_deck_tests()
            summary["fixed_subsidy_tests"] = fixed_subsidy_tests()
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
                "pot_points": self.pot_points,
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


def max_take_burst(take_times: list[datetime], threshold: timedelta) -> int:
    if not take_times:
        return 0
    longest = 1
    current = 1
    for previous, taken_at in zip(take_times, take_times[1:]):
        gap = taken_at - previous
        within = gap == timedelta(0) if threshold == timedelta(0) else gap < threshold
        current = current + 1 if within else 1
        longest = max(longest, current)
    return longest


def can_return_to_deck(enabled: bool, points: int, card_in_hand: bool) -> bool:
    return enabled and points >= RETURN_TO_DECK_COST and card_in_hand


def should_flag_return_subsidy(points_after_payment: int) -> bool:
    return points_after_payment <= RETURN_SUBSIDY_FLAG_THRESHOLD


def empty_field_subsidy_eligible(points: int, hand_count: int, field_empty: bool) -> bool:
    return field_empty and points + hand_count < 8


def empty_field_floor_grants(
    player_resources: list[tuple[str, int, int]],
    field_empty: bool,
) -> dict[str, int]:
    if not field_empty or not player_resources:
        return {}
    if not all(points + hand_count < 3 for _name, points, hand_count in player_resources):
        return {}
    return {
        name: 3 - (points + hand_count)
        for name, points, hand_count in player_resources
    }


def play_time_cost(duration: int) -> float:
    return max(0, duration) / 12.0


def paid_update_is_rational(
    expected_rank_point_gain: int,
    point_cost: int,
    duration_minutes: int,
    include_time: bool = True,
) -> bool:
    if point_cost <= 0:
        return True
    if expected_rank_point_gain <= 0:
        return False
    if expected_rank_point_gain / point_cost < MIN_PAID_UPDATE_RANK_POINTS_PER_POINT:
        return False
    # 試行開始時は1時間あたり1ランクPを超える見込みを要求する。
    # 試行完了後は時間が埋没費用なので、投稿費のROIだけを再判定する。
    return not include_time or expected_rank_point_gain > duration_minutes / 60.0


def commitment_aware_draw_value(
    pipeline_value: float,
    completion_bonus: float,
    commitment_penalty: float,
) -> float:
    return pipeline_value + completion_bonus - 1.0 - max(0.0, commitment_penalty)


def rational_stack_surplus(personality: str, affordable: int, required_hand: int) -> int:
    surplus_caps = {
        "投稿優先派": 1,
        "スタック派": RATIONAL_STACK_SURPLUS_CAP,
        "ホルダー優先派": 1,
        "正統派": 2,
        "ネガティブ派": 0,
    }
    # ドロー中に残高だけが減って目標も縮むことを避け、手札+Pの総資源を基準にする。
    # ただし次の投稿・ドロー余力として3P分を残す。
    surplus_budget = max(0, affordable - required_hand - 3)
    return min(surplus_caps[personality], surplus_budget)


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


def personality_continuous_hours(personality: str, motivation_multiplier: float) -> int:
    base = PERSONALITY_CONTINUOUS_HOURS[personality]
    if motivation_multiplier >= 1.1:
        base += 1
    elif motivation_multiplier < 0.9:
        base -= 1
    return min(5, max(1, base))


def is_peak_time(at: datetime) -> bool:
    return at.hour >= 20 or at.hour < 1


def is_offpeak_time(at: datetime) -> bool:
    return 4 <= at.hour < 14


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


def cap_continuous_sessions(
    sessions: list[tuple[datetime, datetime]],
    max_continuous_hours: int,
    break_minutes: int = 30,
) -> list[tuple[datetime, datetime]]:
    capped: list[tuple[datetime, datetime]] = []
    limit = timedelta(hours=min(5, max(1, max_continuous_hours)))
    rest = timedelta(minutes=max(1, break_minutes))
    for start, end in merge_sessions(sessions):
        cursor = start
        while cursor < end:
            chunk_end = min(end, cursor + limit)
            capped.append((cursor, chunk_end))
            cursor = chunk_end + rest
    return capped


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


def calculate_initial_post_cost(
    amount: int,
    existing_participants: int,
    policy: str = "first_second_free",
) -> int:
    if policy in {"first_second_free", "first_second_free_difficulty"}:
        return 0 if existing_participants < 2 else amount
    if policy == "second_third_free":
        return 0 if 1 <= existing_participants < 3 else amount
    return amount


def calculate_attempt_post_cost(
    difficulty: int,
    is_taker: bool,
    submission_number: int,
) -> int:
    return max(1, difficulty) if is_taker or submission_number >= 2 else 0


def calculate_total_reward(
    base: int,
    difficulty: int,
    participant_count: int,
    formula: str = "balanced",
) -> int:
    if participant_count <= 0:
        return 0
    if formula == "proposal":
        return max(0, base)
    bonus = 0 if participant_count == 1 else max(1, difficulty) * (max(0, base) // 5)
    if formula == "balanced":
        return math.ceil(max(0, base) * 3 / 5) + bonus // 2
    return max(0, base) + bonus


def minimum_proposed_distribution(participants: int) -> list[int]:
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
    if total <= 0 or participants <= 0:
        return [0] * max(0, participants)
    if participants == 1:
        return [total]
    rewards = minimum_proposed_distribution(participants)
    while sum(rewards) > total:
        lowest_reducible = participants - 1 if participants == 2 else participants - 2
        for index in range(lowest_reducible, -1, -1):
            if rewards[index] > 0:
                rewards[index] -= 1
                break
        else:
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


def proposed_position_distribution(
    ranking: list[dict[str, Any]],
    total: int,
) -> tuple[dict[str, int], int]:
    participant_count = sum(len(group["players"]) for group in ranking)
    positional = proposed_rank_distribution(total, participant_count)
    distribution: dict[str, int] = {}
    remainder = 0
    cursor = 0
    for group in ranking:
        names = sorted(group["players"])
        pool = sum(positional[cursor:cursor + len(names)])
        share, extra = divmod(pool, len(names))
        distribution.update({name: share for name in names if share > 0})
        remainder += extra
        cursor += len(names)
    return distribution, remainder


def initial_countdown_minutes(difficulty: int | None) -> int:
    level = min(5, max(1, difficulty or 1))
    return 60 + max(0, level - 2) * 20


def initial_post_extension_minutes(participant_order: int, remaining_minutes: float | None = None) -> int:
    if participant_order <= 0:
        return 0
    if participant_order == 1:
        return (
            LATE_FIRST_POST_EXTENSION_MINUTES
            if remaining_minutes is not None and remaining_minutes < LATE_FIRST_POST_THRESHOLD_MINUTES
            else FIRST_POST_EXTENSION_MINUTES
        )
    return SUBSEQUENT_POST_EXTENSION_MINUTES


def holder_names_from_ranking(ranking: list[dict[str, Any]]) -> list[str]:
    if not ranking or ranking[0].get("rank") != 1:
        return []
    return list(ranking[0].get("players", []))


def take_level_for_count(successful_takes: int, level_up_every: int) -> int:
    return 1 + max(0, successful_takes) // max(1, level_up_every)


def sqrt_take_level(successful_takes: int) -> int:
    return math.isqrt(max(0, successful_takes))


def wealth_tax_threshold(level: int) -> int:
    return (max(0, level) + 2) * 5


def player_hand_limit(level: int) -> int:
    return (max(0, level) + 2) * 3


def level_take_requirement(level: int) -> int:
    return 2 + max(0, level)


def required_take_hand(field_count: int) -> int:
    return 3 + max(0, field_count) // 2


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


def predicted_rank_reward(
    total: int,
    rank: int,
    participant_count: int,
    is_taker: bool,
    remainder_policy: str = "taker",
) -> int:
    if total <= 0 or rank <= 0 or participant_count <= 0 or rank > participant_count:
        return 0
    if participant_count == 1:
        return total
    groups = [[f"rank_{index}"] for index in range(1, participant_count + 1)]
    eligible_groups = groups[:-1] if participant_count >= 4 else groups
    distribution, taker_remainder = distribute_rank_rewards(total, eligible_groups)
    reward = distribution.get(f"rank_{rank}", 0)
    if remainder_policy == "last_poster" and rank == participant_count:
        return reward + taker_remainder
    return reward + (taker_remainder if remainder_policy == "taker" and is_taker else 0)


def should_accept_initial_post(cost: int, point_return_sensitive: bool, expected_point_net: int) -> bool:
    return cost == 0 or not point_return_sensitive or expected_point_net >= 0


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
    results.extend([
        {
            "name": "proposal_total_reward_has_no_deduction_or_difficulty_bonus",
            "ok": calculate_total_reward(10, 5, 6, "proposal") == 10,
            "total": calculate_total_reward(10, 5, 6, "proposal"),
        },
        {
            "name": "proposal_four_player_distribution_cycle",
            "ok": [proposed_rank_distribution(total, 4) for total in range(7, 14)] == [
                [4, 2, 1, 0],
                [5, 2, 1, 0],
                [5, 3, 1, 0],
                [5, 3, 2, 0],
                [6, 3, 2, 0],
                [6, 4, 2, 0],
                [6, 4, 3, 0],
            ],
        },
        {
            "name": "balanced_reward_reduces_base_and_bonus",
            "ok": calculate_total_reward(10, 4, 3, "balanced") == 10,
            "total": calculate_total_reward(10, 4, 3, "balanced"),
        },
        {
            "name": "balanced_single_poster_has_no_difficulty_bonus",
            "ok": calculate_total_reward(8, 5, 1, "balanced") == 5,
            "total": calculate_total_reward(8, 5, 1, "balanced"),
        },
    ])
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


def fixed_difficulty_tests() -> list[dict[str, Any]]:
    base = dict(DIFFICULTY_DISTRIBUTION)
    available = {1, 2, 4}
    missing_weight = sum(weight for difficulty, weight in base.items() if difficulty not in available)
    adjusted = {difficulty: weight for difficulty, weight in base.items() if difficulty in available}
    adjusted[min(adjusted)] += missing_weight
    return [
        {
            "name": "difficulty_distribution_total",
            "ok": math.isclose(sum(base.values()), 100.0),
            "distribution": base,
        },
        {
            "name": "missing_difficulty_moves_to_lowest_available",
            "ok": adjusted == {1: 65.0, 2: 30.0, 4: 5.0},
            "distribution": adjusted,
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
        {
            "name": "skill_tier_order_is_x_then_y_then_other",
            "ok": SKILL_TIER_ORDER["X"] > SKILL_TIER_ORDER["Y"] > SKILL_TIER_ORDER["other"],
        },
        {
            "name": "predicted_reward_uses_rank_distribution",
            "ok": predicted_rank_reward(10, 1, 4, False) == 7
            and predicted_rank_reward(10, 4, 4, False) == 0,
        },
        {
            "name": "commitment_aware_draw_value_charges_point_and_hesitation",
            "ok": math.isclose(commitment_aware_draw_value(1.2, 0.35, 0.8), -0.25),
        },
        {
            "name": "rational_stack_surplus_preserves_personality_order",
            "ok": rational_stack_surplus("スタック派", 12, 3) == 4
            and rational_stack_surplus("正統派", 12, 3) == 2
            and rational_stack_surplus("投稿優先派", 12, 3) == 1
            and rational_stack_surplus("ネガティブ派", 12, 3) == 0,
        },
        {
            "name": "paid_update_rejects_no_rank_point_gain",
            "ok": not paid_update_is_rational(0, 1, 10),
        },
        {
            "name": "paid_update_rejects_low_point_roi",
            "ok": not paid_update_is_rational(2, 5, 20),
        },
        {
            "name": "paid_update_accepts_rank_point_roi",
            "ok": paid_update_is_rational(3, 5, 30),
        },
        {
            "name": "paid_update_start_considers_time_opportunity",
            "ok": not paid_update_is_rational(1, 1, 60, include_time=True)
            and paid_update_is_rational(1, 1, 60, include_time=False),
        },
    ]


def fixed_entry_rule_tests() -> list[dict[str, Any]]:
    rarity_five_costs = [calculate_initial_post_cost(5, count) for count in range(4)]
    legacy_costs = [
        calculate_initial_post_cost(5, count, "second_third_free")
        for count in range(4)
    ]
    caps = [field_cap(count) for count in (0, 1, 2, 16, 30)]
    return [
        {
            "name": "first_and_second_posters_are_free",
            "ok": rarity_five_costs == [0, 0, 5, 5],
            "costs": rarity_five_costs,
        },
        {
            "name": "legacy_second_and_third_free_policy_is_reproducible",
            "ok": legacy_costs == [5, 0, 0, 5],
            "costs": legacy_costs,
        },
        {
            "name": "proposal_non_taker_initial_post_is_free",
            "ok": calculate_attempt_post_cost(5, False, 1) == 0,
        },
        {
            "name": "proposal_taker_initial_post_costs_difficulty",
            "ok": calculate_attempt_post_cost(5, True, 1) == 5,
        },
        {
            "name": "proposal_every_retry_costs_difficulty",
            "ok": calculate_attempt_post_cost(5, False, 2) == 5
            and calculate_attempt_post_cost(5, True, 3) == 5,
        },
        {
            "name": "legacy_field_take_hand_requirement",
            "ok": required_take_hand(0) == 3 and required_take_hand(7) == 6,
            "at_zero_fields": required_take_hand(0),
            "at_seven_fields": required_take_hand(7),
        },
        {
            "name": "level_take_requirement_linear",
            "ok": [take_level_for_count(takes, 2) for takes in range(5)] == [1, 1, 2, 2, 3]
            and [level_take_requirement(level) for level in range(1, 4)] == [3, 4, 5],
        },
        {
            "name": "level_take_requirement_square_root",
            "ok": [sqrt_take_level(takes) for takes in (0, 1, 3, 4, 8, 9)] == [0, 1, 1, 2, 2, 3]
            and [level_take_requirement(sqrt_take_level(takes)) for takes in (0, 1, 3, 4, 8, 9)]
            == [2, 3, 3, 4, 4, 5],
        },
        {
            "name": "paid_post_rejects_expected_point_loss",
            "ok": not should_accept_initial_post(3, True, -1)
            and should_accept_initial_post(3, True, 0),
        },
        {
            "name": "free_post_ignores_expected_point_loss",
            "ok": should_accept_initial_post(0, True, -5),
        },
        {
            "name": "last_poster_receives_indivisible_remainder",
            "ok": predicted_rank_reward(11, 6, 6, False, "last_poster") == 3
            and predicted_rank_reward(11, 1, 6, True, "last_poster") == 2,
            "last_reward": predicted_rank_reward(11, 6, 6, False, "last_poster"),
            "taker_reward": predicted_rank_reward(11, 1, 6, True, "last_poster"),
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
    capped_sessions = cap_continuous_sessions(
        [(datetime(2026, 1, 1, 20, tzinfo=JST), datetime(2026, 1, 2, 4, tzinfo=JST))],
        3,
    )
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
        {
            "name": "stochastic_score_expected_order_and_learning_efficiency",
            "ok": SCORE_TIER_BASE["X"] > SCORE_TIER_BASE["Y"] > SCORE_TIER_BASE["other"]
            and SCORE_SKILL_EFFICIENCY["X"] > SCORE_SKILL_EFFICIENCY["Y"] > SCORE_SKILL_EFFICIENCY["other"],
        },
        {
            "name": "player_extension_cost_duration_and_cutoff",
            "ok": PLAYER_EXTENSION_COST == 1
            and PLAYER_EXTENSION_MINUTES == 15
            and PLAYER_EXTENSION_CUTOFF == timedelta(hours=1),
        },
        {
            "name": "peak_and_offpeak_hours_use_jst_boundaries",
            "ok": is_peak_time(datetime(2026, 1, 1, 20, tzinfo=JST))
            and is_peak_time(datetime(2026, 1, 2, 0, 59, tzinfo=JST))
            and not is_peak_time(datetime(2026, 1, 2, 1, tzinfo=JST))
            and is_offpeak_time(datetime(2026, 1, 2, 4, tzinfo=JST))
            and not is_offpeak_time(datetime(2026, 1, 2, 14, tzinfo=JST)),
        },
        {
            "name": "personality_continuous_hours_are_bounded",
            "ok": personality_continuous_hours("投稿優先派", 1.2) == 5
            and personality_continuous_hours("ネガティブ派", 0.8) == 1
            and all(
                1 <= personality_continuous_hours(name, motivation) <= 5
                for name in PERSONALITY_CONTINUOUS_HOURS
                for motivation in (0.8, 1.0, 1.2)
            ),
        },
        {
            "name": "continuous_activity_is_split_by_rest",
            "ok": len(capped_sessions) == 3
            and all(end - start <= timedelta(hours=3) for start, end in capped_sessions)
            and all(
                next_start - end == timedelta(minutes=30)
                for (_start, end), (next_start, _next_end) in zip(capped_sessions, capped_sessions[1:])
            ),
        },
    ]


def fixed_countdown_tests() -> list[dict[str, Any]]:
    orders = [1, 2, 3, 4, 12, 16]
    extensions = [initial_post_extension_minutes(order) for order in orders]
    return [
        {
            "name": "countdown_uses_difficulty",
            "ok": [initial_countdown_minutes(level) for level in range(1, 6)] == [60, 60, 80, 100, 120],
            "initial_minutes": [initial_countdown_minutes(level) for level in range(1, 6)],
        },
        {
            "name": "first_post_uses_strict_fifteen_minute_boundary",
            "ok": initial_post_extension_minutes(1, 15) == 15
            and initial_post_extension_minutes(1, 14.999) == 30,
            "at_fifteen": initial_post_extension_minutes(1, 15),
            "below_fifteen": initial_post_extension_minutes(1, 14.999),
        },
        {
            "name": "subsequent_posts_add_ten_minutes",
            "ok": extensions == [15, 10, 10, 10, 10, 10],
            "orders": orders,
            "extensions": extensions,
        },
        {
            "name": "difficulty_three_three_posters_total_limit_is_115_minutes",
            "ok": initial_countdown_minutes(3)
            + initial_post_extension_minutes(1, 15)
            + initial_post_extension_minutes(2)
            + initial_post_extension_minutes(3)
            == 115,
            "total_minutes": initial_countdown_minutes(3)
            + initial_post_extension_minutes(1, 15)
            + initial_post_extension_minutes(2)
            + initial_post_extension_minutes(3),
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


def fixed_relaxed_take_tests() -> list[dict[str, Any]]:
    output_dir = Path(".")

    proposal_a = Simulation(1, output_dir, write_outputs=False, take_cooldown_policy="all_field_first")
    a_player = proposal_a.players["player_01"]
    a_player.last_take_at = proposal_a.start_at
    proposal_a.now = proposal_a.start_at + timedelta(minutes=30)
    proposal_a.field = [1]
    proposal_a.cards[1].taker = "player_02"
    proposal_a.cards[1].scores = {a_player.name: 100}
    a_rejects_single_card = not proposal_a._cooldown_ready(a_player, proposal_a.now, mutate_release=False)
    proposal_a.field = [1, 2]
    proposal_a.cards[2].taker = a_player.name
    proposal_a.cards[2].scores = {a_player.name: 100, "player_03": 100}
    a_accepts_tied_first_with_other_take = proposal_a._cooldown_ready(
        a_player,
        proposal_a.now,
        mutate_release=False,
    )
    proposal_a.cards[1].taker = a_player.name
    a_rejects_own_cards_only = not proposal_a._cooldown_ready(a_player, proposal_a.now, mutate_release=False)

    proposal_b = Simulation(2, output_dir, write_outputs=False, take_cooldown_policy="endgame_free")
    b_player = proposal_b.players["player_01"]
    b_threshold = proposal_b.end_at - ENDGAME_FREE_BEFORE_END
    b_player.last_take_at = b_threshold - timedelta(minutes=10)
    b_before_threshold = not proposal_b._cooldown_ready(
        b_player,
        b_threshold - timedelta(microseconds=1),
        mutate_release=False,
    )
    b_at_threshold = proposal_b._cooldown_ready(b_player, b_threshold, mutate_release=False)

    proposal_c = Simulation(3, output_dir, write_outputs=False, take_cooldown_policy="post_credit")
    c_player = proposal_c.players["player_01"]
    c_player.last_take_at = proposal_c.start_at
    proposal_c.now = proposal_c.start_at + timedelta(minutes=1)
    c_credits = [proposal_c._apply_post_cooldown_credit(c_player) for _ in range(7)]

    combined = Simulation(
        4,
        output_dir,
        write_outputs=False,
        take_cooldown_policy="all_field_first_endgame_free",
    )
    combined_player = combined.players["player_01"]
    combined_player.last_take_at = combined.start_at
    combined.now = combined.start_at + timedelta(minutes=30)
    combined.field = [1, 2]
    combined.cards[1].taker = "player_02"
    combined.cards[2].taker = combined_player.name
    combined.cards[1].scores = {combined_player.name: 100}
    combined.cards[2].scores = {combined_player.name: 100}
    combined_accepts_a = combined._cooldown_ready(combined_player, combined.now, mutate_release=False)
    combined.field = []
    combined_threshold = combined.end_at - ENDGAME_FREE_BEFORE_END
    combined_player.last_take_at = combined_threshold - timedelta(minutes=10)
    combined_accepts_b = combined._cooldown_ready(
        combined_player,
        combined_threshold,
        mutate_release=False,
    )

    return [
        {
            "name": "proposal_a_requires_at_least_two_field_cards",
            "ok": a_rejects_single_card,
        },
        {
            "name": "proposal_a_accepts_tied_first_when_another_player_took_a_card",
            "ok": a_accepts_tied_first_with_other_take,
        },
        {
            "name": "proposal_a_rejects_field_made_only_from_own_takes",
            "ok": a_rejects_own_cards_only,
        },
        {
            "name": "proposal_b_starts_exactly_two_and_a_half_hours_before_end",
            "ok": b_before_threshold and b_at_threshold,
        },
        {
            "name": "proposal_c_grants_fifteen_minutes_per_card_and_caps_at_ninety",
            "ok": c_credits == [15, 15, 15, 15, 15, 15, 0]
            and c_player.cooldown_credit_minutes == 90,
            "credits": c_credits,
        },
        {
            "name": "combined_policy_accepts_both_a_and_b_release_paths",
            "ok": combined_accepts_a and combined_accepts_b,
        },
    ]


def fixed_return_to_deck_tests() -> list[dict[str, Any]]:
    return [
        {
            "name": "return_cost_is_one_point",
            "ok": RETURN_TO_DECK_COST == 1,
            "cost": RETURN_TO_DECK_COST,
        },
        {
            "name": "return_is_allowed_with_one_point",
            "ok": can_return_to_deck(True, 1, True),
        },
        {
            "name": "return_is_blocked_at_zero_points",
            "ok": not can_return_to_deck(True, 0, True),
        },
        {
            "name": "return_is_blocked_for_non_hand_card",
            "ok": not can_return_to_deck(True, 10, False),
        },
        {
            "name": "return_is_blocked_when_rule_disabled",
            "ok": not can_return_to_deck(False, 10, True),
        },
        {
            "name": "return_subsidy_flag_is_set_at_four_points",
            "ok": should_flag_return_subsidy(4),
        },
        {
            "name": "return_subsidy_flag_is_not_set_at_five_points",
            "ok": not should_flag_return_subsidy(5),
        },
    ]


def fixed_subsidy_tests() -> list[dict[str, Any]]:
    return [
        {
            "name": "empty_field_uses_combined_resources_below_eight",
            "ok": empty_field_subsidy_eligible(4, 3, True),
        },
        {
            "name": "combined_resources_equal_eight_is_not_eligible",
            "ok": not empty_field_subsidy_eligible(5, 3, True),
        },
        {
            "name": "nonempty_field_does_not_create_recurring_subsidy",
            "ok": not empty_field_subsidy_eligible(-1, 5, False),
        },
        {
            "name": "return_threshold_is_independent_at_four_points",
            "ok": should_flag_return_subsidy(4) and not should_flag_return_subsidy(5),
        },
        {
            "name": "empty_field_floor_grant_fills_everyone_to_three",
            "ok": empty_field_floor_grants(
                [("A", 0, 0), ("B", -1, 2), ("C", 1, 1)],
                True,
            ) == {"A": 3, "B": 2, "C": 1},
        },
        {
            "name": "empty_field_floor_grant_requires_every_player_below_three",
            "ok": empty_field_floor_grants([("A", 0, 0), ("B", 2, 1)], True) == {},
        },
    ]


def comparison_metrics(summary: dict[str, Any]) -> dict[str, float | int]:
    players = summary["players"]
    return_stats = summary["return_to_deck"]
    cooldown = summary["cooldown"]
    economy = summary["economy"]
    return {
        "collections": summary["collections"],
        "subsidy_payments": summary["subsidy_payments"],
        "end_points": sum(player["points"] for player in players),
        "zero_point_players": sum(player["points"] <= 0 for player in players),
        "draws": sum(player["actions"].get("draw", 0) for player in players),
        "takes": sum(player["actions"].get("take", 0) for player in players),
        "rank_points": sum(player["rank_points"] for player in players),
        "max_player_rank_points": max((player["rank_points"] for player in players), default=0),
        "mean_max_stack": statistics.mean(player["max_stack_count"] for player in players),
        "collection_rewards": economy["collection_rewards"],
        "post_fees": economy["post_fees"],
        "max_takes_by_player": cooldown["max_takes_by_player"],
        "max_take_share": cooldown["max_take_share"],
        "rapid_takes": cooldown["rapid_take_count"],
        "max_zero_time_burst": cooldown["max_zero_time_burst"],
        "max_sub90_burst": cooldown["max_sub90_burst"],
        "cooldown_stall_snapshots": cooldown["cooldown_stall_snapshots"],
        "all_field_posted_cooldown_waits": cooldown["all_field_posted_cooldown_waits"],
        "cooldown_releases": cooldown["release_count"],
        "post_credit_events": cooldown["post_credit_events"],
        "endgame_free_takes": cooldown["endgame_free_takes"],
        "endgame_cooldown_blocked_players": cooldown["endgame_cooldown_blocked_players"],
        "endgame_cooldown_blocked_cycles": cooldown["endgame_cooldown_blocked_cycles"],
        "returns": return_stats["count"],
        "return_redraws": return_stats["redraw_count"],
        "other_player_redraws": return_stats["other_player_redraw_count"],
        "practiced_returns": return_stats["practiced_before_return_count"],
        "return_subsidy_flags": return_stats["subsidy_flag_count"],
        "invariant_errors": len(summary["invariant_errors"]),
    }


def compare_return_rule(start_seed: int, runs: int, output_dir: Path) -> dict[str, Any]:
    scenarios: list[dict[str, dict[str, float | int]]] = []
    for seed in range(start_seed, start_seed + runs):
        baseline = Simulation(seed, output_dir, False, False).run()
        without_subsidy = Simulation(seed, output_dir, True, False, False).run()
        with_subsidy = Simulation(seed, output_dir, True, False, True).run()
        scenarios.append({
            "baseline": comparison_metrics(baseline),
            "return_without_subsidy": comparison_metrics(without_subsidy),
            "return_with_subsidy": comparison_metrics(with_subsidy),
        })

    report: dict[str, Any] = {
        "runs": runs,
        "start_seed": start_seed,
        "scenario": "non-stack players actively return every surplus card before taking",
        "baseline_mean": {},
        "return_without_subsidy_mean": {},
        "return_with_subsidy_mean": {},
        "subsidy_effect_mean_delta": {},
        "return_rule_effect_mean_delta": {},
    }
    for key in scenarios[0]["baseline"]:
        baseline_values = [float(row["baseline"][key]) for row in scenarios]
        without_values = [float(row["return_without_subsidy"][key]) for row in scenarios]
        with_values = [float(row["return_with_subsidy"][key]) for row in scenarios]
        baseline_mean = statistics.mean(baseline_values)
        without_mean = statistics.mean(without_values)
        with_mean = statistics.mean(with_values)
        report["baseline_mean"][key] = round(baseline_mean, 3)
        report["return_without_subsidy_mean"][key] = round(without_mean, 3)
        report["return_with_subsidy_mean"][key] = round(with_mean, 3)
        report["subsidy_effect_mean_delta"][key] = round(with_mean - without_mean, 3)
        report["return_rule_effect_mean_delta"][key] = round(with_mean - baseline_mean, 3)
    report["baseline_runs_with_zero_point_player"] = sum(
        row["baseline"]["zero_point_players"] > 0 for row in scenarios
    )
    report["return_without_subsidy_runs_with_zero_point_player"] = sum(
        row["return_without_subsidy"]["zero_point_players"] > 0 for row in scenarios
    )
    report["return_with_subsidy_runs_with_zero_point_player"] = sum(
        row["return_with_subsidy"]["zero_point_players"] > 0 for row in scenarios
    )
    return report


def percentile(values: list[float], ratio: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    index = min(len(ordered) - 1, max(0, math.ceil(len(ordered) * ratio) - 1))
    return ordered[index]


def compare_cooldown_rules(start_seed: int, runs: int, output_dir: Path) -> dict[str, Any]:
    policies = {
        "baseline": "現行90分",
        "all_field_first": "案A・全場札1位で解除",
        "endgame_free": "案B・終了2時間半前から免除",
        "all_field_first_endgame_free": "案A+B・条件解除と終盤免除",
        "post_credit": "案C・初投稿ごとに15分免除",
    }
    scenarios: dict[str, list[dict[str, float | int]]] = {policy: [] for policy in policies}
    for seed in range(start_seed, start_seed + runs):
        for policy in policies:
            summary = Simulation(
                seed,
                output_dir,
                return_to_deck_enabled=True,
                write_outputs=False,
                return_subsidy_enabled=True,
                take_cooldown_policy=policy,
            ).run()
            scenarios[policy].append(comparison_metrics(summary))

    report: dict[str, Any] = {
        "runs": runs,
        "start_seed": start_seed,
        "policies": policies,
        "assumptions": {
            "return_to_deck_enabled": True,
            "return_subsidy_enabled": True,
            "other_take_conditions_unchanged": True,
            "ui_action_minutes": 0,
            "take_hand_requirement": "level = floor(sqrt(successful takes)); required stack = level + 2",
            "field_cap": "min(max(1, participants - 1), 16)",
        },
        "statistics": {},
        "mean_delta_from_baseline": {},
        "mean_percent_from_baseline": {},
        "risk_runs": {},
    }
    metric_names = list(scenarios["baseline"][0])
    baseline_means = {
        metric: statistics.mean(float(row[metric]) for row in scenarios["baseline"])
        for metric in metric_names
    }
    for policy, rows in scenarios.items():
        report["statistics"][policy] = {}
        report["mean_delta_from_baseline"][policy] = {}
        report["mean_percent_from_baseline"][policy] = {}
        for metric in metric_names:
            values = [float(row[metric]) for row in rows]
            mean_value = statistics.mean(values)
            baseline_mean = baseline_means[metric]
            report["statistics"][policy][metric] = {
                "mean": round(mean_value, 3),
                "median": round(statistics.median(values), 3),
                "p95": round(percentile(values, 0.95), 3),
                "max": round(max(values), 3),
            }
            report["mean_delta_from_baseline"][policy][metric] = round(mean_value - baseline_mean, 3)
            report["mean_percent_from_baseline"][policy][metric] = (
                round((mean_value / baseline_mean - 1.0) * 100.0, 2) if baseline_mean else None
            )
        report["risk_runs"][policy] = {
            "with_rapid_take": sum(row["rapid_takes"] > 0 for row in rows),
            "with_zero_time_multi_take": sum(row["max_zero_time_burst"] > 1 for row in rows),
            "with_single_player_majority": sum(row["max_take_share"] > 0.5 for row in rows),
            "with_cooldown_stall_snapshot": sum(row["cooldown_stall_snapshots"] > 0 for row in rows),
            "with_all_field_posted_cooldown_wait": sum(
                row["all_field_posted_cooldown_waits"] > 0 for row in rows
            ),
            "with_endgame_cooldown_blocked_cycle": sum(
                row["endgame_cooldown_blocked_cycles"] > 0 for row in rows
            ),
            "with_invariant_error": sum(row["invariant_errors"] > 0 for row in rows),
        }

    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(JST).strftime("%Y%m%d_%H%M%S")
    report_path = output_dir / f"tricks_cooldown_comparison_{stamp}.json"
    report["report_path"] = str(report_path)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="トリックテイキング制ルール検証シミュレーション")
    parser.add_argument("--seed", type=int, default=260704, help="乱数シード")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "outputs",
        help="出力ディレクトリ",
    )
    parser.add_argument(
        "--return-to-deck",
        action="store_true",
        default=True,
        help="1Pで手札を山札へ戻す追加ルールを有効にする",
    )
    parser.add_argument(
        "--summary-only",
        action="store_true",
        help="イベントログと要約ファイルを書き出さない（複数シード比較向け）",
    )
    parser.add_argument(
        "--no-return-subsidy",
        action="store_true",
        help="返却後4P以下でも給付金フラグを立てない比較条件",
    )
    parser.add_argument(
        "--compare-runs",
        type=int,
        default=0,
        metavar="N",
        help="連続するNシードで追加ルール無効・有効を比較する",
    )
    parser.add_argument(
        "--cooldown-policy",
        choices=sorted(TAKE_COOLDOWN_POLICIES),
        default="all_field_first_endgame_free",
        help="テイクのクールダウンルールを選択する",
    )
    parser.add_argument(
        "--take-cost-mode",
        choices=["field", "level_linear", "level_sqrt"],
        default="level_sqrt",
        help="テイク必要スタックを平方根レベル式、旧場札数式、または旧線形レベル式で算出する",
    )
    parser.add_argument(
        "--take-level-up-every",
        type=int,
        default=2,
        metavar="K",
        help="level_linear時、成功テイクK回ごとにレベルを1上げる",
    )
    parser.add_argument(
        "--post-cost-policy",
        choices=sorted(POST_COST_POLICIES),
        default="taker_initial_and_retries_paid",
        help="投稿費ポリシーを選択する",
    )
    parser.add_argument(
        "--paid-update-policy",
        choices=sorted(PAID_UPDATE_POLICIES),
        default="rank_point_roi",
        help="有料更新を従来判断またはランクPの費用対効果で判定する",
    )
    parser.add_argument(
        "--reward-formula",
        choices=sorted(REWARD_FORMULAS),
        default="proposal",
        help="回収時の総還元ポイント式を選択する",
    )
    parser.add_argument(
        "--behavior-policy",
        choices=sorted(BEHAVIOR_POLICIES),
        default="commitment_aware",
        help="旧行動評価または有望手札の取捨選択リスクを考慮する行動評価を選択する",
    )
    parser.add_argument(
        "--activity-policy",
        choices=sorted(ACTIVITY_POLICIES),
        default="peak_engagement",
        help="旧固定セッションまたはピーク集中・関与場札待機型の活動時間を選択する",
    )
    parser.add_argument(
        "--score-policy",
        choices=sorted(SCORE_POLICIES),
        default="stochastic_card_skill",
        help="固定序列またはカード別スキル蓄積を伴う確率的スコア試行を選択する",
    )
    parser.add_argument(
        "--remainder-policy",
        choices=sorted(REMAINDER_POLICIES),
        default="last_poster",
        help="順位配分後の余剰Pをテイカーまたは最下位投稿者へ還元する",
    )
    parser.add_argument(
        "--no-player-extension",
        action="store_true",
        help="執着中のランクP重視プレイヤーによる1P・15分延長を無効にする",
    )
    parser.add_argument(
        "--no-recycle-unposted",
        action="store_true",
        help="投稿者0人で回収された場札本体を捨て札へ移さない",
    )
    parser.add_argument(
        "--no-empty-field-floor-grant",
        action="store_true",
        help="空場時に全参加者のポイント+手札を3へ補充する施策を無効にする",
    )
    parser.add_argument(
        "--compare-cooldown-runs",
        type=int,
        default=0,
        metavar="N",
        help="連続するNシードで現行ルールと案A・B・Cを比較する",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.compare_cooldown_runs > 0:
        print(json.dumps(
            compare_cooldown_rules(args.seed, args.compare_cooldown_runs, args.output_dir),
            ensure_ascii=False,
            indent=2,
        ))
        return
    if args.compare_runs > 0:
        print(json.dumps(
            compare_return_rule(args.seed, args.compare_runs, args.output_dir),
            ensure_ascii=False,
            indent=2,
        ))
        return
    sim = Simulation(
        seed=args.seed,
        output_dir=args.output_dir,
        return_to_deck_enabled=args.return_to_deck,
        write_outputs=not args.summary_only,
        return_subsidy_enabled=not args.no_return_subsidy,
        take_cooldown_policy=args.cooldown_policy,
        take_cost_mode=args.take_cost_mode,
        take_level_up_every=args.take_level_up_every,
        post_cost_policy=args.post_cost_policy,
        paid_update_policy=args.paid_update_policy,
        recycle_unposted=not args.no_recycle_unposted,
        empty_field_floor_grant=not args.no_empty_field_floor_grant,
        reward_formula=args.reward_formula,
        behavior_policy=args.behavior_policy,
        activity_policy=args.activity_policy,
        score_policy=args.score_policy,
        remainder_policy=args.remainder_policy,
        player_extension_enabled=not args.no_player_extension,
    )
    summary = sim.run()
    print(json.dumps({
        "jsonl_path": summary["jsonl_path"],
        "summary_path": summary["summary_path"],
        "events_written": summary["events_written"],
        "collections": summary["collections"],
        "invariant_errors": summary["invariant_errors"],
        "fixed_reward_tests": summary["fixed_reward_tests"],
        "fixed_rarity_tests": summary["fixed_rarity_tests"],
        "fixed_difficulty_tests": summary["fixed_difficulty_tests"],
        "fixed_rank_point_tests": summary["fixed_rank_point_tests"],
        "fixed_prediction_tests": summary["fixed_prediction_tests"],
        "fixed_time_model_tests": summary["fixed_time_model_tests"],
        "fixed_entry_rule_tests": summary["fixed_entry_rule_tests"],
        "fixed_countdown_tests": summary["fixed_countdown_tests"],
        "fixed_holder_tests": summary["fixed_holder_tests"],
        "fixed_take_cooldown_tests": summary["fixed_take_cooldown_tests"],
        "fixed_relaxed_take_tests": summary["fixed_relaxed_take_tests"],
        "fixed_return_to_deck_tests": summary["fixed_return_to_deck_tests"],
        "fixed_subsidy_tests": summary["fixed_subsidy_tests"],
        "rarity_draw_counts": summary["rarity_draw_counts"],
        "empty_field_floor_grant": summary["empty_field_floor_grant"],
        "activity_extension": summary["activity_extension"],
        "score_model": summary["score_model"],
        "paid_extensions": summary["paid_extensions"],
        "unposted_recycle_count": summary["unposted_recycle_count"],
        "return_to_deck": summary["return_to_deck"],
        "cooldown": summary["cooldown"],
        "economy": summary["economy"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
