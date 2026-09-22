<?php

namespace App\Services\Tricks;

use App\Models\LimitLog;
use App\Models\Player;
use App\Models\TrickCardPayment;
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
        private readonly TrickEmergencyGrantService $emergencyGrants,
        private readonly TrickRuleCalculator $rules,
        private readonly TrickTakeCooldownService $cooldowns,
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
                    'player' => $this->playerPayload($event, $existing, $now),
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
                'take_count' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $this->log($event, 'join', $userId, [
                'points_delta' => 5,
                'player_snapshot' => $player->toArray(),
                'context' => ['existing_players_bonus' => $players->count()],
            ], $request);

            return ['player' => $this->playerPayload($event, $player, $now), 'created' => true, 'hand' => []];
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
            $handCount = TrickEventCard::query()->where('event_id', $event->event_id)
                ->where('state', $userId)->lockForUpdate()->count();
            $handLimit = $this->rules->handLimit((int) $player->take_count);
            if ($handCount >= $handLimit) {
                abort(response()->json(['message' => "手札上限 {$handLimit}枚に達しています"], 422));
            }

            $recycledCount = $this->recycleTrashIfDeckEmpty($event);
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
            if ($card->rarity === null) {
                $card->rarity = $this->drawRarity($event, $now, $seedPrefix);
            }
            $card->drawn_order = ((int) TrickEventCard::query()->where('event_id', $event->event_id)
                ->where('state', $userId)->max('drawn_order')) + 1;
            $card->save();
            $recycledCount += $this->recycleTrashIfDeckEmpty($event);
            $remainingDeckCount = TrickEventCard::query()
                ->where('event_id', $event->event_id)->where('state', '_deck')->count();
            $remainingTrashCount = TrickEventCard::query()
                ->where('event_id', $event->event_id)->where('state', '_trash')->count();
            $player->decrement('draw_points');
            $player->card_count = TrickEventCard::query()->where('event_id', $event->event_id)->where('state', $userId)->count();
            $this->flagSubsidyAfterPointSpend($event, $player, $now);
            $player->save();
            $card->load('deck');
            $this->log($event, 'draw', $userId, [
                'event_card_id' => $card->id,
                'card_id' => $card->deck_id,
                'stage_id' => $card->deck?->stage_id,
                'points_delta' => -1,
                'remaining_draw_points' => $player->draw_points,
                'remaining_deck_count' => $remainingDeckCount,
                'card_snapshot' => $card->toArray(),
                'context' => [
                    'recycled_count' => $recycledCount,
                    'remaining_trash_count' => $remainingTrashCount,
                ],
            ], $request);
            $this->emergencyGrants->apply($event, $now, $userId, $request);

            return [
                'card' => $this->state->normalizeCard($card),
                'player' => $this->playerPayload($event, $player, $now),
                'hand' => $this->state->cards($event, $userId),
                'deck_count' => $remainingDeckCount,
                'trash_count' => $remainingTrashCount,
                'recycled_count' => $recycledCount,
            ];
        });
    }

    public function take(TrickEvent $event, string $userId, int $deckId, Request $request = null): array
    {
        return DB::transaction(function () use ($event, $userId, $deckId, $request): array {
            $event = $this->lockAvailableEvent($event);
            $player = $this->lockPlayer($event, $userId);
            $now = $this->clock->now($event);
            $fieldCards = TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_field')
                ->lockForUpdate()->get();
            $fieldCount = $fieldCards->count();
            $hand = TrickEventCard::query()->with('deck')->where('event_id', $event->event_id)
                ->where('state', $userId)->lockForUpdate()->get();
            $selected = $hand->firstWhere('deck_id', $deckId);
            if ($selected === null) {
                abort(response()->json(['message' => '対象カードが手札にありません'], 409));
            }
            $required = $this->rules->requiredHand((int) $player->take_count);
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
            $nextTakeAt = $this->cooldowns->nextTakeAt($event, $player, $now);
            if ($nextTakeAt !== null) {
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
                'limit_at' => $now->addMinutes($this->rules->initialCountdownMinutes((int) $selected->difficulty)),
                'paid_points_total' => 0,
                'stack_parent_id' => null,
                'post_count' => 0,
                'top_player' => null,
                'collected_at' => null,
                'late_first_extension' => false,
            ])->save();
            $participantCount = Player::query()->where('event_id', $event->event_id)->count();
            $subsidyEligible = $this->rules->subsidyEligible($player->draw_points, $participantCount);
            $playerData = [
                'card_count' => 0,
                'last_take_at' => $now,
                'take_count' => ((int) $player->take_count) + 1,
                'take_cooldown_released_for' => null,
            ];
            if ($subsidyEligible) {
                $playerData['subsidy_flag'] = true;
                $playerData['subsidy_flag_slot_at'] = $this->nextSubsidySlot($now);
            }
            $player->fill($playerData)->save();
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
            $this->emergencyGrants->apply($event, $now, $userId, $request);

            return [
                'card' => $this->state->normalizeCard($selected),
                'player' => $this->playerPayload($event, $player, $now),
                'hand' => [],
            ];
        });
    }

    public function returnToDeck(
        TrickEvent $event,
        string $userId,
        int $deckId,
        Request $request = null,
    ): array {
        return DB::transaction(function () use ($event, $userId, $deckId, $request): array {
            $event = $this->lockAvailableEvent($event);
            $player = $this->lockPlayer($event, $userId);
            if ($player->draw_points <= 0) {
                abort(response()->json(['message' => 'ポイントが0P以下のため山札に戻せません'], 422));
            }

            $card = TrickEventCard::query()->with('deck')
                ->where('event_id', $event->event_id)
                ->where('deck_id', $deckId)
                ->lockForUpdate()
                ->firstOrFail();
            if ($card->state !== $userId) {
                abort(response()->json(['message' => '対象カードが手札にありません'], 409));
            }

            $now = $this->clock->now($event);
            $card->fill([
                'state' => '_deck',
                'drawn_order' => null,
                'returned_count' => $card->returned_count + 1,
            ])->save();
            $player->decrement('draw_points');
            $event->increment('pot_points');
            $player->card_count = TrickEventCard::query()
                ->where('event_id', $event->event_id)
                ->where('state', $userId)
                ->count();
            $this->flagSubsidyAfterPointSpend($event, $player, $now, true);
            $player->save();

            $this->log($event, 'return_to_deck', $userId, [
                'event_card_id' => $card->id,
                'card_id' => $card->deck_id,
                'points_delta' => -1,
                'remaining_draw_points' => $player->draw_points,
                'remaining_deck_count' => TrickEventCard::query()
                    ->where('event_id', $event->event_id)->where('state', '_deck')->count(),
                'context' => ['public' => false, 'subsidy_flag' => (bool) $player->subsidy_flag],
            ], $request);
            $this->emergencyGrants->apply($event, $now, $userId, $request);

            return [
                'card' => $this->state->normalizeCard($card->fresh('deck')),
                'player' => $this->playerPayload($event, $player, $now),
                'hand' => $this->state->cards($event, $userId),
            ];
        });
    }

    public function extend(
        TrickEvent $event,
        string $userId,
        int $deckId,
        string $idempotencyKey,
        Request $request = null,
    ): array {
        return DB::transaction(function () use ($event, $userId, $deckId, $idempotencyKey, $request): array {
            $event = $this->lockAvailableEvent($event);
            $player = $this->lockPlayer($event, $userId);
            $card = TrickEventCard::query()->with('deck')->where('event_id', $event->event_id)
                ->where('deck_id', $deckId)->lockForUpdate()->firstOrFail();
            $existing = TrickCardPayment::query()->where('event_id', $event->event_id)
                ->where('event_card_id', $card->id)->where('idempotency_key', $idempotencyKey)->first();
            if ($existing !== null) {
                return [
                    'card' => $this->state->normalizeCard($card),
                    'player' => $this->playerPayload($event, $player, $this->clock->now($event)),
                    'extended' => false,
                    'idempotent_replay' => true,
                ];
            }

            $now = $this->clock->now($event);
            if ($card->state !== '_field' || $card->limit_at === null || $now->greaterThanOrEqualTo($card->limit_at)) {
                abort(response()->json(['message' => '期限到達後または場札でないカードは延長できません'], 409));
            }
            if ($now->greaterThanOrEqualTo(CarbonImmutable::instance($event->end_at)->subHour())) {
                abort(response()->json(['message' => '大会終了1時間前以降は延長できません'], 403));
            }
            if ($player->draw_points < 1) {
                abort(response()->json(['message' => '延長には1P必要です'], 422));
            }

            $previousLimit = CarbonImmutable::instance($card->limit_at);
            $newLimit = $previousLimit->addMinutes(15)->min(CarbonImmutable::instance($event->end_at));
            if ($newLimit->lessThanOrEqualTo($previousLimit)) {
                abort(response()->json(['message' => 'これ以上延長できません'], 409));
            }
            $player->decrement('draw_points');
            $card->limit_at = $newLimit;
            $card->paid_points_total = (int) $card->paid_points_total + 1;
            $card->save();
            TrickCardPayment::query()->create([
                'event_id' => $event->event_id,
                'event_card_id' => $card->id,
                'deck_id' => $card->deck_id,
                'stage_id' => (int) ($card->deck?->stage_id ?? 0),
                'player_name' => $userId,
                'payment_type' => 'player_extension',
                'submission_number' => null,
                'points_paid' => 1,
                'record_id' => null,
                'idempotency_key' => $idempotencyKey,
            ]);
            $this->log($event, 'player_extension', $userId, [
                'event_card_id' => $card->id,
                'card_id' => $card->deck_id,
                'stage_id' => $card->deck?->stage_id,
                'points_delta' => -1,
                'previous_limit' => $previousLimit,
                'new_limit' => $newLimit,
                'context' => ['extension_minutes' => 15, 'idempotency_key' => $idempotencyKey],
            ], $request);

            return [
                'card' => $this->state->normalizeCard($card->fresh('deck')),
                'player' => $this->playerPayload($event, $player, $now),
                'extended' => true,
                'idempotent_replay' => false,
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

    private function recycleTrashIfDeckEmpty(TrickEvent $event): int
    {
        if (TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_deck')->exists()) {
            return 0;
        }

        return TrickEventCard::query()
            ->where('event_id', $event->event_id)
            ->where('state', '_trash')
            ->lockForUpdate()
            ->update([
                'state' => '_deck',
                'stack_parent_id' => null,
            ]);
    }

    private function drawRarity(TrickEvent $event, CarbonImmutable $now, string $seedPrefix = null): int
    {
        $elapsedHours = max(0.0, min(46.0, $event->start_at->diffInSeconds($now, false) / 3600));

        return $this->weightedDraw(
            $this->rules->rarityWeights($elapsedHours),
            $seedPrefix === null ? null : $seedPrefix.':rarity',
        );
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

    private function flagSubsidyAfterPointSpend(
        TrickEvent $event,
        Player $player,
        CarbonImmutable $now,
        bool $includeReturnRule = false,
    ): void {
        // Empty-field subsidy is evaluated live, never converted into an action grant.
        if (! $includeReturnRule || ! $this->rules->returnSubsidyEligible($player->draw_points)) {
            return;
        }

        $player->subsidy_flag = true;
        $player->subsidy_flag_slot_at = $this->nextSubsidySlot($now);
    }

    private function playerPayload(TrickEvent $event, Player $player, CarbonImmutable $now): array
    {
        $player = $player->fresh();

        return [
            ...$player->toArray(),
            'points' => $player->draw_points,
            'take_level' => $this->rules->takeLevel((int) $player->take_count),
            'take_cost' => $this->rules->requiredHand((int) $player->take_count),
            'hand_limit' => $this->rules->handLimit((int) $player->take_count),
            'balance_tax_threshold' => $this->rules->balanceTaxThreshold((int) $player->take_count),
            'balance_tax_eligible' => $player->draw_points > $this->rules->balanceTaxThreshold((int) $player->take_count),
            'subsidy_flag' => (bool) $player->subsidy_flag || (
                ! TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_field')->exists()
                && $this->rules->emptyFieldSubsidyEligible($player->draw_points, $player->card_count)
            ),
            'next_take_at' => $this->cooldowns->nextTakeAt($event, $player, $now)?->toIso8601String(),
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
