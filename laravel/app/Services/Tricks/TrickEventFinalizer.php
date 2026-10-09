<?php

namespace App\Services\Tricks;

use App\Models\Deck;
use App\Models\LimitLog;
use App\Models\TrickCardHolder;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TrickEventFinalizer
{
    public function __construct(
        private readonly TrickClock $clock,
        private readonly TrickCollectionService $collections,
    ) {
    }

    public function finalize(
        TrickEvent $event,
        bool $force = false,
        string $actor = null,
        Request $request = null,
    ): array {
        return DB::transaction(function () use ($event, $force, $actor, $request): array {
            $event = TrickEvent::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();
            if ($event->state === 'ended') {
                return ['ended_now' => false, 'collected' => 0, 'event' => $event->fresh()];
            }
            $now = $this->clock->now($event);
            if (! $force && $now->lessThan($event->end_at)) {
                abort(response()->json(['message' => '大会終了時刻前です'], 422));
            }

            $fieldDeckIds = TrickEventCard::query()->where('event_id', $event->event_id)
                ->where('state', '_field')->orderByRaw('limit_at IS NULL')->orderBy('limit_at')->orderBy('id')
                ->lockForUpdate()->pluck('deck_id');
            $collected = 0;
            foreach ($fieldDeckIds as $deckId) {
                $result = $this->collections->collect($event, (int) $deckId, true, $actor, $request);
                $collected += $result['collected_now'] ? 1 : 0;
            }

            $eventDeckIds = TrickEventCard::query()->where('event_id', $event->event_id)
                ->lockForUpdate()->pluck('deck_id');
            $heldDeckIds = TrickCardHolder::query()->where('event_id', $event->event_id)
                ->whereIn('deck_id', $eventDeckIds)->pluck('deck_id')->unique();
            Deck::query()->whereIn('id', $heldDeckIds)->update(['state' => '_held']);
            Deck::query()->whereIn('id', $eventDeckIds->diff($heldDeckIds))->update(['state' => '_eligible']);

            $event->fill(['state' => 'ended', 'ended_at' => $now])->save();
            LimitLog::query()->create([
                'event' => 'event_ended',
                'event_id' => $event->event_id,
                'actor_name' => $actor,
                'route' => $request?->path(),
                'ip' => $request?->ip(),
                'user_agent' => $request?->userAgent(),
                'request_id' => (string) ($request?->header('X-Request-Id') ?: Str::uuid()),
                'context' => [
                    'forced' => $force,
                    'collected_cards' => $collected,
                    'held_cards' => $heldDeckIds->count(),
                    'eligible_cards' => $eventDeckIds->diff($heldDeckIds)->count(),
                ],
            ]);

            return ['ended_now' => true, 'collected' => $collected, 'event' => $event->fresh()];
        });
    }
}
