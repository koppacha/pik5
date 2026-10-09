<?php

namespace App\Services\Tricks;

use App\Models\TrickEvent;
use Illuminate\Http\Request;

class TrickEventResolver
{
    public function __construct(private readonly TrickClock $clock)
    {
    }

    public function current(): TrickEvent
    {
        $events = TrickEvent::query()->whereNotNull('initialized_at')->get();
        $upcoming = $events->filter(fn (TrickEvent $event) => $event->state !== 'ended'
            && $this->clock->now($event)->lessThan($event->end_at));
        $active = $upcoming->filter(fn (TrickEvent $event) => $this->clock->now($event)->greaterThanOrEqualTo($event->start_at))
            ->sortByDesc('start_at')->first();
        $scheduled = $upcoming->sortBy('start_at')->first();
        $latest = $events->filter(fn (TrickEvent $event) => $event->state === 'ended'
            || $this->clock->now($event)->greaterThanOrEqualTo($event->end_at))->sortByDesc('end_at')->first();

        return $active ?? $scheduled ?? $latest ?? abort(404, '大会がありません');
    }

    public function forRequest(Request $request, TrickRequestIdentity $identity): TrickEvent
    {
        $testEventId = $identity->testEventId($request);
        if ($testEventId !== null) {
            return TrickEvent::query()
                ->where('event_id', $testEventId)
                ->where('test_mode', true)
                ->firstOrFail();
        }
        if ($request->query('event_id') !== null) {
            $validated = $request->validate(['event_id' => ['required', 'integer', 'min:1', 'max:2147483647']]);

            return TrickEvent::query()->where('event_id', $validated['event_id'])->firstOrFail();
        }

        return $this->current();
    }
}
