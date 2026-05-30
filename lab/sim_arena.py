from __future__ import annotations

from dataclasses import dataclass
from random import Random
from typing import Optional


# =========================
# データ構造
# =========================

@dataclass
class Player:
    name: str
    rating: int = 1000
    base_win_rate: float = 0.5

    wins: int = 0
    losses: int = 0
    holder_wins: int = 0
    challenger_wins: int = 0
    receiver_fees_paid: int = 0

    def reset_record(self) -> None:
        self.wins = 0
        self.losses = 0
        self.holder_wins = 0
        self.challenger_wins = 0
        self.receiver_fees_paid = 0


# =========================
# 設定値
# =========================

MATCH_COUNT = 20
SEED: Optional[int] = 42

# 支払いポイント設定
PAYMENT_RATE = 0.10
PAYMENT_EXTRA_DIVISOR = 10000
MIN_PAYMENT = 50
MAX_PAYMENT = 220

# レシーバー参加費設定
RECEIVER_FEE_RATE = 0.10
MIN_RECEIVER_FEE = 5
MAX_RECEIVER_FEE = 15

# 勝っても赤字にならないための最低利益
MIN_WIN_PROFIT = 5

# 勝者取り分の最大値
MAX_WINNER_SHARE = 0.90

# ホルダーが防衛成功した場合の勝者取り分
HOLDER_WIN_SHARE_BY_STREAK = {
    0: 0.70,
    1: 0.70,
    2: 0.71,
    3: 0.72,
    4: 0.73,
}

# チャレンジャーが連勝ホルダーを倒した場合の勝者取り分
CHALLENGER_WIN_SHARE_BY_STREAK = {
    0: 0.70,
    1: 0.72,
    2: 0.74,
    3: 0.76,
    4: 0.78,
}

MAX_STREAK_SHARE = {
    "holder": 0.75,
    "challenger": 0.80,
}


# =========================
# 入力例
# =========================
# rating:
#   初期レート
#
# base_win_rate:
#   プレイヤーの基本勝率・地力。
#   絶対的な勝率ではなく、対戦相手との比率で勝率を決める。
#
#   例:
#   A=0.6, B=0.4 なら Aの勝率は 0.6 / (0.6 + 0.4) = 60%

PLAYERS = [
    Player(name="Alice", rating=1000, base_win_rate=0.62),
    Player(name="Bob", rating=1000, base_win_rate=0.58),
    Player(name="Carol", rating=1000, base_win_rate=0.52),
    Player(name="Dave", rating=1000, base_win_rate=0.50),
    Player(name="Eve", rating=1000, base_win_rate=0.48),
    Player(name="Frank", rating=1000, base_win_rate=0.44),
    Player(name="Grace", rating=1000, base_win_rate=0.40),
]


# =========================
# ユーティリティ
# =========================

def clamp(value: int | float, min_value: int | float, max_value: int | float) -> int | float:
    return max(min_value, min(value, max_value))


def payment_from_rating(rating: int) -> int:
    """
    対戦前にホルダー・チャレンジャーが支払うポイントを計算する。

    基本は所持ポイントの10%。
    ただし1000点を超えるプレイヤーは、
    1000点超過分の二乗補正で支払いが重くなる。
    """
    extra = max(0, rating - 1000)
    payment = round(rating * PAYMENT_RATE + (extra * extra) / PAYMENT_EXTRA_DIVISOR)

    return int(clamp(payment, MIN_PAYMENT, MAX_PAYMENT))


def receiver_fee_from_holder_payment(holder_payment: int) -> int:
    """
    レシーバー参加費を計算する。

    原則としてホルダー支払い額の10%。
    ただし5〜15点に制限する。
    """
    fee = round(holder_payment * RECEIVER_FEE_RATE)

    return int(clamp(fee, MIN_RECEIVER_FEE, MAX_RECEIVER_FEE))


def receiver_fee_from_holder_payment_and_streak(holder_payment: int, streak: int) -> int:
    """
    観戦者の観戦料を計算する。

    仕様書に合わせ、ホルダーの連勝数が0のときは観戦料を発生させない。
    1連勝以上のときはホルダー参加費の10%を5〜15点に制限する。
    """
    if streak <= 0:
        return 0

    return receiver_fee_from_holder_payment(holder_payment)


def get_holder_win_share(streak: int) -> float:
    """
    ホルダーが勝った場合の基本勝者取り分を返す。
    """
    return HOLDER_WIN_SHARE_BY_STREAK.get(streak, MAX_STREAK_SHARE["holder"])


def get_challenger_win_share(streak: int) -> float:
    """
    チャレンジャーが勝った場合の基本勝者取り分を返す。
    """
    return CHALLENGER_WIN_SHARE_BY_STREAK.get(streak, MAX_STREAK_SHARE["challenger"])


def apply_winner_share_floor(
        base_share: float,
        winner_payment: int,
        pot: int,
) -> float:
    """
    勝者が赤字にならないように、勝者取り分に安全下限を適用する。

    最低でも winner_payment + MIN_WIN_PROFIT を受け取れるようにする。
    ただし取り分が大きくなりすぎないよう、MAX_WINNER_SHARE を上限にする。
    """
    min_share = (winner_payment + MIN_WIN_PROFIT) / pot
    adjusted_share = max(base_share, min_share)

    return float(clamp(adjusted_share, 0.0, MAX_WINNER_SHARE))


def win_probability(player_a: Player, player_b: Player) -> float:
    """
    player_a が player_b に勝つ確率を計算する。
    """
    total = player_a.base_win_rate + player_b.base_win_rate

    if total <= 0:
        return 0.5

    return player_a.base_win_rate / total


def sort_by_rating_with_random_tiebreak(players: list[Player], rng: Random) -> list[Player]:
    """
    レート降順で並べる。
    同一レートの場合はランダム順にする。
    """
    shuffled = players[:]
    rng.shuffle(shuffled)

    return sorted(shuffled, key=lambda player: player.rating, reverse=True)


def reset_records(players: list[Player]) -> None:
    """
    レートは維持し、勝敗などの試合記録だけをリセットする。
    """
    for player in players:
        player.reset_record()


def clone_players(players: list[Player]) -> list[Player]:
    """
    入力プレイヤーを破壊しないための簡易コピー。
    勝敗記録はコピーせず、レートと基本勝率だけを引き継ぐ。
    """
    return [
        Player(
            name=player.name,
            rating=player.rating,
            base_win_rate=player.base_win_rate,
        )
        for player in players
    ]


# =========================
# シミュレーション本体
# =========================

def simulate(
        players: list[Player],
        match_count: int = MATCH_COUNT,
        seed: Optional[int] = SEED,
        copy_players: bool = True,
) -> tuple[list[Player], list[dict]]:
    """
    1対1負け抜け戦をシミュレートする。

    戻り値:
      final_players:
        最終状態のプレイヤー一覧

      logs:
        各対戦の詳細ログ
    """
    if len(players) < 3:
        raise ValueError("ホルダー、チャレンジャー、レシーバーが必要なため、3人以上を指定してください")

    rng = Random(seed)

    active_players = clone_players(players) if copy_players else players
    reset_records(active_players)

    ordered_players = sort_by_rating_with_random_tiebreak(active_players, rng)

    holder = ordered_players[0]
    challenger = ordered_players[1]
    waiting_queue = ordered_players[2:]

    # 最初のホルダーはまだ連勝していない扱い。
    holder_streak = 0

    logs: list[dict] = []

    for match_no in range(1, match_count + 1):
        current_holder = holder
        current_challenger = challenger
        current_receivers = waiting_queue[:]
        streak_before = holder_streak

        holder_before = current_holder.rating
        challenger_before = current_challenger.rating
        receivers_before = {
            receiver.name: receiver.rating
            for receiver in current_receivers
        }

        holder_payment = payment_from_rating(current_holder.rating)
        challenger_payment = payment_from_rating(current_challenger.rating)
        receiver_fee_each = receiver_fee_from_holder_payment_and_streak(
            holder_payment=holder_payment,
            streak=streak_before,
        )
        receiver_count = len(current_receivers)
        receiver_fee_total = receiver_fee_each * receiver_count
        pot = holder_payment + challenger_payment + receiver_fee_total

        holder_win_prob = win_probability(current_holder, current_challenger)
        is_holder_win = rng.random() < holder_win_prob

        if is_holder_win:
            base_winner_share = get_holder_win_share(streak_before)
            winner_share = apply_winner_share_floor(
                base_share=base_winner_share,
                winner_payment=holder_payment,
                pot=pot,
            )

            holder_gain_from_pot = round(pot * winner_share)
            challenger_gain_from_pot = pot - holder_gain_from_pot

            current_holder.rating += holder_gain_from_pot - holder_payment
            current_challenger.rating += challenger_gain_from_pot - challenger_payment

            for receiver in current_receivers:
                receiver.rating -= receiver_fee_each
                receiver.receiver_fees_paid += receiver_fee_each

            current_holder.wins += 1
            current_holder.holder_wins += 1
            current_challenger.losses += 1

            winner = current_holder
            loser = current_challenger

            # 敗者のチャレンジャーを最後尾へ
            waiting_queue.append(current_challenger)

            # 控え1番が次のチャレンジャー
            challenger = waiting_queue.pop(0)

            # ホルダーは継続し、連勝数を増やす
            holder_streak += 1

        else:
            base_winner_share = get_challenger_win_share(streak_before)
            winner_share = apply_winner_share_floor(
                base_share=base_winner_share,
                winner_payment=challenger_payment,
                pot=pot,
            )

            challenger_gain_from_pot = round(pot * winner_share)
            holder_gain_from_pot = pot - challenger_gain_from_pot

            current_challenger.rating += challenger_gain_from_pot - challenger_payment
            current_holder.rating += holder_gain_from_pot - holder_payment

            for receiver in current_receivers:
                receiver.rating -= receiver_fee_each
                receiver.receiver_fees_paid += receiver_fee_each

            current_challenger.wins += 1
            current_challenger.challenger_wins += 1
            current_holder.losses += 1

            winner = current_challenger
            loser = current_holder

            # 敗者の旧ホルダーを最後尾へ
            waiting_queue.append(current_holder)

            # チャレンジャーが新ホルダーになる
            holder = current_challenger

            # 控え1番が次のチャレンジャー
            challenger = waiting_queue.pop(0)

            # 新ホルダーは直前の勝利により1連勝扱い
            holder_streak = 1

        receivers_after = {
            receiver.name: receiver.rating
            for receiver in current_receivers
        }

        logs.append(
            {
                "match_no": match_no,
                "holder": current_holder.name,
                "challenger": current_challenger.name,
                "winner": winner.name,
                "loser": loser.name,

                "holder_win_probability": round(holder_win_prob, 4),
                "is_holder_win": is_holder_win,

                "holder_before": holder_before,
                "challenger_before": challenger_before,
                "holder_after": current_holder.rating,
                "challenger_after": current_challenger.rating,
                "holder_delta": current_holder.rating - holder_before,
                "challenger_delta": current_challenger.rating - challenger_before,

                "holder_payment": holder_payment,
                "challenger_payment": challenger_payment,
                "pot": pot,

                "base_winner_share": round(base_winner_share, 4),
                "winner_share": round(winner_share, 4),

                "receiver_fee_each": receiver_fee_each,
                "receiver_count": receiver_count,
                "receiver_fee_total": receiver_fee_total,
                "receivers_before": receivers_before,
                "receivers_after": receivers_after,

                "holder_streak_before": streak_before,
                "holder_streak_after": holder_streak,

                "next_holder": holder.name,
                "next_challenger": challenger.name,
                "waiting_queue": [player.name for player in waiting_queue],
            }
        )

    return active_players, logs


# =========================
# 出力用
# =========================

def sorted_players_by_rating(players: list[Player]) -> list[Player]:
    return sorted(players, key=lambda player: player.rating, reverse=True)


def print_match_logs(logs: list[dict]) -> None:
    print("Match logs")
    print("-" * 120)

    for log in logs:
        print(
            f"{log['match_no']:02d}: "
            f"{log['holder']} vs {log['challenger']} "
            f"→ winner={log['winner']} "
            f"| H {log['holder_before']}→{log['holder_after']} ({log['holder_delta']:+}) "
            f"| C {log['challenger_before']}→{log['challenger_after']} ({log['challenger_delta']:+}) "
            f"| pay H={log['holder_payment']} C={log['challenger_payment']} "
            f"R={log['receiver_fee_each']}x{log['receiver_count']} "
            f"| pot={log['pot']} "
            f"| share={log['winner_share']:.2%} "
            f"| streak {log['holder_streak_before']}→{log['holder_streak_after']} "
            f"| next: {log['next_holder']} vs {log['next_challenger']}"
        )


def print_final_ratings(players: list[Player]) -> None:
    print("\nFinal ratings")
    print("-" * 100)

    for rank, player in enumerate(sorted_players_by_rating(players), start=1):
        delta = player.rating - 1000

        print(
            f"{rank:02d}. {player.name:<10} "
            f"rating={player.rating:>4} "
            f"delta={delta:+5} "
            f"W-L={player.wins}-{player.losses} "
            f"holderW={player.holder_wins} "
            f"challengerW={player.challenger_wins} "
            f"receiverFees={player.receiver_fees_paid}"
        )


def print_final_ratings_as_markdown(players: list[Player]) -> None:
    print("| 順位 | プレイヤー | 最終レート | 増減 | 勝敗 | ホルダー勝利 | チャレンジャー勝利 | 支払った観戦料 |")
    print("|---:|---|---:|---:|---|---:|---:|---:|")

    for rank, player in enumerate(sorted_players_by_rating(players), start=1):
        delta = player.rating - 1000

        print(
            f"| {rank} "
            f"| {player.name} "
            f"| {player.rating} "
            f"| {delta:+} "
            f"| {player.wins}-{player.losses} "
            f"| {player.holder_wins} "
            f"| {player.challenger_wins} "
            f"| {player.receiver_fees_paid} |"
        )


# =========================
# 複数回実行用
# =========================

def run_many(
        players: list[Player],
        seeds: list[int],
        match_count: int = MATCH_COUNT,
) -> list[tuple[int, list[Player], list[dict]]]:
    results = []

    for seed in seeds:
        final_players, logs = simulate(
            players=players,
            match_count=match_count,
            seed=seed,
            copy_players=True,
        )
        results.append((seed, final_players, logs))

    return results


def print_many_results_as_markdown(
        results: list[tuple[int, list[Player], list[dict]]],
        base_rating: int = 1000,
) -> None:
    print("| 回 | seed | 順位 | プレイヤー | 最終レート | 増減 | 勝敗 | ホルダー勝利 | チャレンジャー勝利 | 支払った観戦料 |")
    print("|---:|---:|---:|---|---:|---:|---|---:|---:|---:|")

    for run_index, (seed, players, _logs) in enumerate(results, start=1):
        for rank, player in enumerate(sorted_players_by_rating(players), start=1):
            delta = player.rating - base_rating

            print(
                f"| {run_index} "
                f"| {seed} "
                f"| {rank} "
                f"| {player.name} "
                f"| {player.rating} "
                f"| {delta:+} "
                f"| {player.wins}-{player.losses} "
                f"| {player.holder_wins} "
                f"| {player.challenger_wins} "
                f"| {player.receiver_fees_paid} |"
            )


# =========================
# 実行例
# =========================

if __name__ == "__main__":
    final_players, match_logs = simulate(
        players=PLAYERS,
        match_count=MATCH_COUNT,
        seed=SEED,
        copy_players=True,
    )

    print_match_logs(match_logs)
    print_final_ratings(final_players)

    print("\nMarkdown table")
    print("-" * 100)
    print_final_ratings_as_markdown(final_players)

    print("\nMultiple runs")
    print("-" * 100)

    many_results = run_many(
        players=PLAYERS,
        seeds=[42, 43, 44, 45, 46],
        match_count=MATCH_COUNT,
    )

    print_many_results_as_markdown(many_results)
