<?php

namespace App\Services\Tricks;

use App\Models\LimitLog;
use App\Models\Player;
use App\Models\TrickEvent;
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
                // Legacy one-shot flags no longer grant an entitlement.
                if ($player->subsidy_flag || $player->subsidy_flag_slot_at !== null) {
                    $player->subsidy_flag = false;
                    $player->subsidy_flag_slot_at = null;
                    $player->save();
                }
                if (! $this->rules->recurringSubsidyEligible($player->draw_points, $player->card_count)) {
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
                        'participant_count' => $participantCount,
                        'reason' => 'low_resources',
                    ],
                ]);
                $player->last_subsidy_paid_slot_at = $slot;
                $player->save();
            }
            $taxed = 0;
            foreach ($players as $player) {
                if ($player->created_at !== null && CarbonImmutable::instance($player->created_at)->greaterThan($slot)) {
                    continue;
                }
                $player->refresh();
                if ($player->ranking_reset_tax_exempt) {
                    $player->ranking_reset_tax_exempt = false;
                    $player->save();
                    continue;
                }
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
                'processed' => $processed,
                'paid' => $paid,
                'taxed' => $taxed,
                'pot_points' => (int) $event->fresh()->pot_points,
            ];
        });
    }

    // Call inside the successful action's transaction, with event and player locked.
    public function grantInstant(
        TrickEvent $event,
        Player $player,
        CarbonImmutable $now,
        int $handCountBefore,
        string $reason,
        Request $request = null,
    ): bool {
        if (! $this->rules->instantSubsidyEligible($player->draw_points, $handCountBefore)) {
            return false;
        }

        $player->draw_points++;
        $player->subsidy_flag = false;
        $player->subsidy_flag_slot_at = null;
        $player->save();
        LimitLog::query()->create([
            'event' => 'instant_subsidy_paid',
            'event_id' => $event->event_id,
            'actor_name' => $player->name,
            'affected_player_name' => $player->name,
            'points_delta' => 1,
            'remaining_draw_points' => $player->draw_points,
            'route' => $request?->path(),
            'ip' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'request_id' => (string) ($request?->header('X-Request-Id') ?: Str::uuid()),
            'context' => [
                'reason' => $reason,
                'hand_count_before' => $handCountBefore,
                'granted_at' => $now->toIso8601String(),
            ],
        ]);

        return true;
    }

    public function currentSlot(CarbonImmutable $now): CarbonImmutable
    {
        $slot = $now->setTimezone('Asia/Tokyo')->setSecond(0)->setMicrosecond(0);

        return $slot->setMinute($slot->minute < 30 ? 0 : 30);
    }
}
