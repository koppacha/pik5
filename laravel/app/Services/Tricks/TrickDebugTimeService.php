<?php

namespace App\Services\Tricks;

use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

class TrickDebugTimeService
{
    public function __construct(
        private readonly TrickClock $clock,
        private readonly TrickCollectionService $collections,
        private readonly TrickSubsidyService $subsidies,
        private readonly TrickEventFinalizer $finalizer,
    ) {
    }

    public function freeze(TrickEvent $event): array
    {
        return $this->payload($this->clock->freeze($event));
    }

    public function set(TrickEvent $event, CarbonImmutable $target): array
    {
        return $this->payload($this->clock->set($event, $target));
    }

    public function reset(TrickEvent $event): array
    {
        return $this->payload($this->clock->reset($event));
    }

    public function advance(
        TrickEvent $event,
        int $seconds,
        string $actor = null,
        Request $request = null,
    ): array {
        if ($seconds <= 0 || $seconds > 604800) {
            abort(response()->json(['message' => 'advanceは1秒以上7日以内で指定してください'], 422));
        }

        $event = $this->clock->freeze($event);
        $current = $this->clock->now($event);
        $target = $current->addSeconds($seconds);
        $collected = 0;
        $subsidyPaid = 0;
        $subsidySlots = 0;

        $initial = $this->processAt($event, $actor, $request);
        $collected += $initial['collected'];
        $subsidyPaid += $initial['subsidy_paid'];
        $subsidySlots += $initial['subsidy_processed'] ? 1 : 0;
        if ($initial['ended']) {
            return $this->advancePayload($event->fresh(), $current, $collected, $subsidyPaid, $subsidySlots);
        }

        while ($current->lessThan($target)) {
            $next = $target;
            $nextSubsidy = $this->subsidies->currentSlot($current)->addMinutes(30);
            if ($nextSubsidy->lessThan($next)) {
                $next = $nextSubsidy;
            }
            $nextLimit = TrickEventCard::query()->where('event_id', $event->event_id)
                ->where('state', '_field')->where('limit_at', '>', $current)
                ->where('limit_at', '<=', $target)->orderBy('limit_at')->value('limit_at');
            if ($nextLimit !== null) {
                $limit = CarbonImmutable::parse($nextLimit);
                if ($limit->lessThan($next)) {
                    $next = $limit;
                }
            }
            $endAt = CarbonImmutable::instance($event->end_at);
            if ($endAt->greaterThan($current) && $endAt->lessThan($next)) {
                $next = $endAt;
            }

            $event = $this->clock->set($event, $next);
            $current = $next;
            $result = $this->processAt($event, $actor, $request);
            $collected += $result['collected'];
            $subsidyPaid += $result['subsidy_paid'];
            $subsidySlots += $result['subsidy_processed'] ? 1 : 0;
            if ($result['ended']) {
                break;
            }
        }

        return $this->advancePayload($event->fresh(), $target, $collected, $subsidyPaid, $subsidySlots);
    }

    private function processAt(TrickEvent $event, ?string $actor, ?Request $request): array
    {
        $now = $this->clock->now($event);
        if ($now->greaterThanOrEqualTo($event->end_at)) {
            $result = $this->finalizer->finalize($event, false, $actor, $request);

            return [
                'collected' => $result['collected'],
                'subsidy_paid' => 0,
                'subsidy_processed' => false,
                'ended' => true,
            ];
        }

        $collected = $this->collections->collectExpired($event, $actor, $request);
        $subsidy = $this->subsidies->processCurrent($event, $actor, $request);

        return [
            'collected' => $collected['count'],
            'subsidy_paid' => $subsidy['paid'],
            'subsidy_processed' => $subsidy['processed'] > 0,
            'ended' => false,
        ];
    }

    private function payload(TrickEvent $event): array
    {
        return [
            'event_id' => $event->event_id,
            'server_now' => $this->clock->now($event)->toIso8601String(),
            'frozen' => $event->debug_now !== null,
            'state' => $event->state,
        ];
    }

    private function advancePayload(
        TrickEvent $event,
        CarbonImmutable $target,
        int $collected,
        int $subsidyPaid,
        int $subsidySlots,
    ): array {
        return [
            ...$this->payload($event),
            'requested_target' => $target->toIso8601String(),
            'collected' => $collected,
            'subsidy_paid' => $subsidyPaid,
            'subsidy_slots' => $subsidySlots,
            'ended' => $event->state === 'ended',
        ];
    }
}
