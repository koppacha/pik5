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

class TrickSubsidyService
{
    public function __construct(
        private readonly TrickClock $clock,
        private readonly TrickRuleCalculator $rules,
    ) {
    }

    public function processCurrent(TrickEvent $event, string $actor = null, Request $request = null): array
    {
        return $this->processSlot($event, $this->currentSlot($this->clock->now($event)), $actor, $request);
    }

    public function processSlot(
        TrickEvent $event,
        CarbonImmutable $slot,
        string $actor = null,
        Request $request = null,
    ): array {
        $slot = $this->currentSlot($slot);

        return DB::transaction(function () use ($event, $slot, $actor, $request): array {
            $event = TrickEvent::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();
            if ($slot->lessThan($event->start_at) || $slot->greaterThanOrEqualTo($event->end_at)
                || $event->state === 'ended') {
                return ['slot' => $slot->toIso8601String(), 'processed' => 0, 'paid' => 0];
            }
            if ($event->last_subsidy_slot_at !== null
                && CarbonImmutable::instance($event->last_subsidy_slot_at)->greaterThanOrEqualTo($slot)) {
                return ['slot' => $slot->toIso8601String(), 'processed' => 0, 'paid' => 0];
            }
            $fieldIsEmpty = ! TrickEventCard::query()->where('event_id', $event->event_id)
                ->where('state', '_field')->lockForUpdate()->exists();
            $players = Player::query()->where('event_id', $event->event_id)->lockForUpdate()->get();
            $participantCount = $players->count();
            $processed = 0;
            $paid = 0;
            foreach ($players as $player) {
                if ($player->created_at !== null && CarbonImmutable::instance($player->created_at)->greaterThan($slot)) {
                    continue;
                }
                if ($player->last_subsidy_paid_slot_at !== null
                    && CarbonImmutable::instance($player->last_subsidy_paid_slot_at)->greaterThanOrEqualTo($slot)) {
                    continue;
                }
                $actionDue = $player->subsidy_flag && $player->subsidy_flag_slot_at !== null
                    && CarbonImmutable::instance($player->subsidy_flag_slot_at)->lessThanOrEqualTo($slot);
                $emptyFieldDue = $fieldIsEmpty
                    && $this->rules->emptyFieldSubsidyEligible($player->draw_points, $player->card_count);
                if (! $emptyFieldDue && ! $actionDue) {
                    continue;
                }

                $processed++;
                $player->increment('draw_points');
                $paid++;
                LimitLog::query()->create([
                    'event' => 'subsidy_paid',
                    'event_id' => $event->event_id,
                    'actor_name' => $actor,
                    'affected_player_name' => $player->name,
                    'points_delta' => 1,
                    'remaining_draw_points' => $player->draw_points,
                    'route' => $request?->path(),
                    'ip' => $request?->ip(),
                    'user_agent' => $request?->userAgent(),
                    'request_id' => (string) ($request?->header('X-Request-Id') ?: Str::uuid()),
                    'context' => [
                        'slot' => $slot->toIso8601String(),
                        'field_empty' => $fieldIsEmpty,
                        'participant_count' => $participantCount,
                        'reason' => $actionDue ? 'action_flag' : 'empty_field',
                    ],
                ]);
                $player->last_subsidy_paid_slot_at = $slot;
                // Only action entitlements are persisted. Empty-field eligibility is live.
                if ($actionDue) {
                    $player->subsidy_flag = false;
                    $player->subsidy_flag_slot_at = null;
                }
                $player->save();
            }
            $taxed = 0;
            foreach ($players as $player) {
                $player->refresh();
                if ($player->draw_points <= $this->rules->balanceTaxThreshold((int) $player->take_count)) {
                    continue;
                }
                $before = (int) $player->draw_points;
                $player->decrement('draw_points');
                $taxed++;
                LimitLog::query()->create([
                    'event' => 'balance_tax_collected',
                    'event_id' => $event->event_id,
                    'actor_name' => $actor,
                    'affected_player_name' => $player->name,
                    'points_delta' => -1,
                    'remaining_draw_points' => $before - 1,
                    'route' => $request?->path(),
                    'ip' => $request?->ip(),
                    'user_agent' => $request?->userAgent(),
                    'request_id' => (string) ($request?->header('X-Request-Id') ?: Str::uuid()),
                    'context' => [
                        'slot' => $slot->toIso8601String(),
                        'threshold' => $this->rules->balanceTaxThreshold((int) $player->take_count),
                        'points_before' => $before,
                        'points_after' => $before - 1,
                    ],
                ]);
            }
            if ($taxed > 0) {
                $event->increment('pot_points', $taxed);
            }
            $event->last_subsidy_slot_at = $slot;
            $event->save();

            return [
                'slot' => $slot->toIso8601String(),
                'field_empty' => $fieldIsEmpty,
                'processed' => $processed,
                'paid' => $paid,
                'taxed' => $taxed,
                'pot_points' => (int) $event->fresh()->pot_points,
            ];
        });
    }

    public function currentSlot(CarbonImmutable $now): CarbonImmutable
    {
        $slot = $now->setTimezone('Asia/Tokyo')->setSecond(0)->setMicrosecond(0);

        return $slot->setMinute($slot->minute < 30 ? 0 : 30);
    }
}
