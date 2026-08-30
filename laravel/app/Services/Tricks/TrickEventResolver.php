<?php

namespace App\Services\Tricks;

use App\Models\TrickEvent;
use Illuminate\Http\Request;

class TrickEventResolver
{
    public function current(): TrickEvent
    {
        $configured = (int) (getenv('TRICKS_EVENT_ID') ?: env('TRICKS_EVENT_ID', 0));
        $query = TrickEvent::query();
        if ($configured > 0) {
            return $query->where('event_id', $configured)->firstOrFail();
        }

        $current = (clone $query)
            ->whereIn('state', ['active', 'scheduled'])
            ->whereNotNull('initialized_at')
            ->orderByDesc('start_at')
            ->first();

        return $current ?? $query->where('state', 'ended')->orderByDesc('end_at')->firstOrFail();
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

        return $this->current();
    }
}
