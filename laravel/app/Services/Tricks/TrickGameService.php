<?php

namespace App\Services\Tricks;

use App\Models\LimitLog;
use App\Models\Player;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TrickGameService
{
    public function __construct(
        private readonly TrickClock $clock,
        private readonly TrickRuleCalculator $rules,
        private readonly TrickStageAllocator $stages,
        private readonly TrickStateService $state,
    ) {
    }

    public function join(TrickEvent $event, string $userId, Request $request = null): array
    {
        return DB::transaction(function () use ($event, $userId, $request): array {
            $event = $this->lockAvailableEvent($event);
            $now = $this->clock->now($event);
            $players = Player::query()->where('event_id', $event->event_id)->lockForUpdate()->get();
            $existing = $players->firstWhere('name', $userId);
            if ($existing !== null) {
                $this->log($event, 'join_existing', $userId, ['player_snapshot' => $existing->toArray()], $request);

                return [
                    'player' => $this->playerPayload($existing),
                    'created' => false,
                    'hand' => $this->state->cards($event, $userId),
                ];
            }

            Player::query()->where('event_id', $event->event_id)->increment('draw_points');
            $player = Player::query()->create([
                'event_id' => $event->event_id,
                'name' => $userId,
                'draw_points' => 5,
                'rank_points' => 0,
                'card_count' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $this->log($event, 'join', $userId, [
                'points_delta' => 5,
                'player_snapshot' => $player->toArray(),
                'context' => ['existing_players_bonus' => $players->count()],
            ], $request);

            return ['player' => $this->playerPayload($player), 'created' => true, 'hand' => []];
        });
    }

    public function draw(TrickEvent $event, string $userId, Request $request = null): array
    {
        return DB::transaction(function () use ($event, $userId, $request): array {
            $event = $this->lockAvailableEvent($event);
            $player = $this->lockPlayer($event, $userId);
            if ($player->draw_points <= 0) {
                abort(response()->json(['message' => 'ポイントが0P以下のためドローできません'], 422));
            }

            $deckQuery = TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_deck');
            if (! $deckQuery->exists()) {
                TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_trash')
                    ->lockForUpdate()->update(['state' => '_deck', 'stack_parent_id' => null]);
            }
            $available = TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_deck')
                ->lockForUpdate()->get();
            if ($available->isEmpty()) {
                abort(response()->json(['message' => '山札と捨て札が空です'], 409));
            }

            $drawSequence = LimitLog::query()->where('event_id', $event->event_id)->where('event', 'draw')->count() + 1;
            $seedPrefix = $event->test_mode ? $event->random_seed.':'.$drawSequence : null;
            $difficulty = $this->drawDifficulty($available->pluck('difficulty')->unique()->all(), $seedPrefix);
            $card = $available->where('difficulty', $difficulty)->random();
            $now = $this->clock->now($event);
            $card->state = $userId;
            $card->rarity = $this->drawRarity($event, $now, $seedPrefix);
            $card->drawn_order = ((int) TrickEventCard::query()->where('event_id', $event->event_id)
                ->where('state', $userId)->max('drawn_order')) + 1;
            $card->save();
            $player->decrement('draw_points');
            $player->card_count = TrickEventCard::query()->where('event_id', $event->event_id)->where('state', $userId)->count();
            $player->save();
            $card->load('deck');
            $this->log($event, 'draw', $userId, [
                'event_card_id' => $card->id,
                'card_id' => $card->deck_id,
                'stage_id' => $card->deck?->stage_id,
                'points_delta' => -1,
                'remaining_draw_points' => $player->draw_points,
                'remaining_deck_count' => $available->count() - 1,
                'card_snapshot' => $card->toArray(),
            ], $request);

            return [
                'card' => $this->state->normalizeCard($card),
                'player' => $this->playerPayload($player),
                'hand' => $this->state->cards($event, $userId),
            ];
        });
    }

    public function take(TrickEvent $event, string $userId, int $deckId, Request $request = null): array
    {
        return DB::transaction(function () use ($event, $userId, $deckId, $request): array {
            $event = $this->lockAvailableEvent($event);
            $player = $this->lockPlayer($event, $userId);
            $now = $this->clock->now($event);
            $fieldCount = TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_field')
                ->lockForUpdate()->count();
            $hand = TrickEventCard::query()->with('deck')->where('event_id', $event->event_id)
                ->where('state', $userId)->lockForUpdate()->get();
            $selected = $hand->firstWhere('deck_id', $deckId);
            if ($selected === null) {
                abort(response()->json(['message' => '対象カードが手札にありません'], 409));
            }
            $required = $this->rules->requiredHand($fieldCount);
            if ($hand->count() < $required) {
                abort(response()->json(['message' => "テイクには手札が{$required}枚以上必要です"], 422));
            }
            if ($now->greaterThanOrEqualTo(CarbonImmutable::instance($event->end_at)->subHour())) {
                abort(response()->json(['message' => '大会終了1時間前以降はテイクできません'], 403));
            }
            $participantCount = Player::query()->where('event_id', $event->event_id)->count();
            if ($fieldCount >= $this->rules->fieldCap($participantCount)) {
                abort(response()->json(['message' => '場札の上限に達しています'], 409));
            }
            $nextTakeAt = $player->last_take_at?->copy()->addMinutes(90);
            if ($nextTakeAt !== null && $now->lessThan($nextTakeAt)) {
                abort(response()->json([
                    'message' => 'テイクのクールダウン中です',
                    'next_take_at' => $nextTakeAt->toIso8601String(),
                ], 409));
            }

            $stageId = $this->stages->ensure($event, $selected->deck);
            $stackIds = $hand->where('id', '!=', $selected->id)->pluck('id');
            TrickEventCard::query()->whereIn('id', $stackIds)->update([
                'state' => '_stack',
                'stack_parent_id' => $selected->id,
            ]);
            $selected->fill([
                'state' => '_field',
                'taker' => $userId,
                'stack_count' => $hand->count(),
                'taken_at' => $now,
                'limit_at' => $now->addMinutes(90),
                'paid_points_total' => 0,
                'stack_parent_id' => null,
            ])->save();
            $player->fill([
                'card_count' => 0,
                'last_take_at' => $now,
                'subsidy_flag' => true,
                'subsidy_flag_slot_at' => $this->nextSubsidySlot($now),
            ])->save();
            $selected->load('deck');
            $this->log($event, 'take', $userId, [
                'event_card_id' => $selected->id,
                'card_id' => $selected->deck_id,
                'stage_id' => $stageId,
                'to_state' => '_field',
                'hand_count' => $hand->count(),
                'rewards' => $hand->count(),
                'stacked_card_ids' => $stackIds->values()->all(),
                'card_snapshot' => $selected->toArray(),
            ], $request);

            return [
                'card' => $this->state->normalizeCard($selected),
                'player' => $this->playerPayload($player),
                'hand' => [],
            ];
        });
    }

    private function lockAvailableEvent(TrickEvent $event): TrickEvent
    {
        $event = TrickEvent::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();
        $now = $this->clock->now($event);
        if ($event->initialized_at === null || $event->state === 'ended'
            || $now->lessThan($event->start_at) || $now->greaterThanOrEqualTo($event->end_at)) {
            abort(response()->json(['message' => '大会開催時間外です'], 403));
        }

        return $event;
    }

    private function lockPlayer(TrickEvent $event, string $userId): Player
    {
        $player = Player::query()->where('event_id', $event->event_id)->where('name', $userId)
            ->lockForUpdate()->first();
        if ($player === null) {
            abort(response()->json(['message' => '大会へ参加してください'], 403));
        }

        return $player;
    }

    private function drawDifficulty(array $available, string $seedPrefix = null): int
    {
        $weights = [1 => 54.0, 2 => 30.0, 3 => 10.0, 4 => 5.0, 5 => 1.0];
        $missing = 0.0;
        foreach ($weights as $difficulty => $weight) {
            if (! in_array($difficulty, $available, true)) {
                $missing += $weight;
                unset($weights[$difficulty]);
            }
        }
        $weights[min(array_keys($weights))] += $missing;

        return $this->weightedDraw($weights, $seedPrefix === null ? null : $seedPrefix.':difficulty');
    }

    private function drawRarity(TrickEvent $event, CarbonImmutable $now, string $seedPrefix = null): int
    {
        $elapsedHours = max(0.0, min(46.0, $event->start_at->diffInSeconds($now, false) / 3600));
        $rareRate = min(100.0, 10.0 * (10 ** ($elapsedHours / 46.0)));
        $scale = $rareRate / 10.0;

        return $this->weightedDraw([
            1 => 100.0 - $rareRate,
            2 => 6.0 * $scale,
            3 => 3.0 * $scale,
            4 => 0.9 * $scale,
            5 => 0.1 * $scale,
        ], $seedPrefix === null ? null : $seedPrefix.':rarity');
    }

    private function weightedDraw(array $weights, string $seed = null): int
    {
        $scale = 100000;
        $total = (int) round(array_sum($weights) * $scale);
        $roll = $seed === null
            ? random_int(1, $total)
            : ((int) hexdec(substr(hash('sha256', $seed), 0, 12)) % $total) + 1;
        foreach ($weights as $value => $weight) {
            $roll -= (int) round($weight * $scale);
            if ($roll <= 0) {
                return (int) $value;
            }
        }

        return (int) array_key_last($weights);
    }

    private function nextSubsidySlot(CarbonImmutable $now): CarbonImmutable
    {
        $base = $now->setSecond(0)->setMicrosecond(0);
        if ($now->minute < 30) {
            return $base->setMinute(30);
        }

        return $base->setMinute(0)->addHour();
    }

    private function playerPayload(Player $player): array
    {
        return [
            ...$player->fresh()->toArray(),
            'points' => $player->draw_points,
            'next_take_at' => $player->last_take_at?->copy()->addMinutes(90)->toIso8601String(),
        ];
    }

    private function log(TrickEvent $event, string $action, ?string $actor, array $data, ?Request $request): void
    {
        LimitLog::query()->create(array_merge([
            'event' => $action,
            'event_id' => $event->event_id,
            'actor_name' => $actor,
            'route' => $request?->path(),
            'ip' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'request_id' => (string) ($request?->header('X-Request-Id') ?: Str::uuid()),
        ], $data));
    }
}
