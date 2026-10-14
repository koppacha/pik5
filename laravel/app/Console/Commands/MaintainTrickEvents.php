<?php

namespace App\Console\Commands;

use App\Models\TrickEvent;
use App\Services\Tricks\TrickClock;
use App\Services\Tricks\TrickCollectionService;
use App\Services\Tricks\TrickEventFinalizer;
use App\Services\Tricks\TrickSubsidyService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

class MaintainTrickEvents extends Command
{
    protected $signature = 'tricks:maintenance {event_id?}';

    protected $description = 'トリックテイキング制の期限回収・給付・大会終了を処理する';

    public function handle(
        TrickClock $clock,
        TrickCollectionService $collections,
        TrickSubsidyService $subsidies,
        TrickEventFinalizer $finalizer,
    ): int {
        $query = TrickEvent::query()->whereNotNull('initialized_at')->whereIn('state', ['scheduled', 'active']);
        if ($this->argument('event_id') !== null) {
            $query->where('event_id', (int) $this->argument('event_id'));
        }
        $events = $query->orderBy('start_at')->get();
        $failed = false;
        foreach ($events as $event) {
            try {
                $now = $clock->now($event);
                if ($now->greaterThanOrEqualTo($event->end_at)) {
                    $result = $finalizer->finalize($event, false, 'system');
                    $this->line("event {$event->event_id}: finalized, collected={$result['collected']}");

                    continue;
                }
                if ($now->lessThan($event->start_at)) {
                    continue;
                }

                $collected = $collections->collectExpired($event, 'system');
                $subsidy = $subsidies->processCurrent($event, 'system');
                $this->line(
                    "event {$event->event_id}: collected={$collected['count']}, subsidy_paid={$subsidy['paid']}"
                );
            } catch (Throwable $exception) {
                $failed = true;
                Log::error('tricks.maintenance.event_failed', [
                    'event_id' => $event->event_id,
                    'exception' => $exception::class,
                ]);
                $this->error("event {$event->event_id}: maintenance failed");
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
