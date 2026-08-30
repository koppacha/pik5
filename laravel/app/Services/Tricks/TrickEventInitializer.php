<?php

namespace App\Services\Tricks;

use App\Models\Deck;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use DomainException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class TrickEventInitializer
{
    public const DECK_SIZE = 200;

    /**
     * @return array{already_initialized: bool, prioritized: int, selected: int, available: int}
     */
    public function inspect(TrickEvent $event): array
    {
        $priorityIds = $this->priorityDeckIds($event);
        $availableIds = Deck::query()
            ->where('state', '_eligible')
            ->pluck('id');

        return [
            'already_initialized' => $event->initialized_at !== null,
            'prioritized' => $priorityIds->count(),
            'selected' => min($availableIds->count(), self::DECK_SIZE),
            'available' => $availableIds->count(),
        ];
    }

    public function initialize(TrickEvent $event, Collection $eligibleDeckIds = null): array
    {
        return DB::transaction(function () use ($event, $eligibleDeckIds): array {
            $lockedEvent = TrickEvent::query()->whereKey($event->getKey())->lockForUpdate()->firstOrFail();
            if ($lockedEvent->initialized_at !== null) {
                return $this->inspect($lockedEvent);
            }

            $eligible = Deck::query()
                ->where('state', '_eligible')
                ->when($eligibleDeckIds !== null, fn ($query) => $query->whereIn('id', $eligibleDeckIds))
                ->lockForUpdate()
                ->get();
            if ($eligible->count() < self::DECK_SIZE) {
                throw new DomainException('大会初期化には投入可能なカードが200枚必要です');
            }

            $priorityIds = $eligibleDeckIds === null ? $this->priorityDeckIds($lockedEvent) : collect();
            if ($priorityIds->count() > self::DECK_SIZE) {
                throw new DomainException('直前大会の必須再投入カードが200枚を超えています');
            }

            $seed = $lockedEvent->random_seed ?? random_int(1, PHP_INT_MAX);
            $lockedEvent->random_seed = $seed;
            $byId = $eligible->keyBy('id');
            $priority = $priorityIds->map(fn (int $id) => $byId->get($id))->filter()->values();
            if ($priority->count() !== $priorityIds->count()) {
                throw new DomainException('直前大会の必須再投入カードが投入可能状態ではありません');
            }

            $remaining = $eligible
                ->reject(fn (Deck $deck) => $priorityIds->contains($deck->id))
                ->sortBy(fn (Deck $deck) => hash('sha256', $seed.':'.$deck->id))
                ->take(self::DECK_SIZE - $priority->count());
            $selected = $priority->concat($remaining)->values();

            foreach ($selected as $deck) {
                TrickEventCard::query()->create([
                    'event_id' => $lockedEvent->event_id,
                    'deck_id' => $deck->id,
                    'state' => '_deck',
                    'difficulty' => max(1, min(5, (int) ($deck->difficulty ?? 1))),
                ]);
            }
            Deck::query()->whereKey($selected->pluck('id'))->update(['state' => '_in_event']);
            $lockedEvent->initialized_at = now();
            $lockedEvent->state = $lockedEvent->start_at->isFuture() ? 'scheduled' : 'active';
            $lockedEvent->save();

            return [
                'already_initialized' => false,
                'prioritized' => $priority->count(),
                'selected' => $selected->count(),
                'available' => $eligible->count(),
            ];
        });
    }

    /** @return Collection<int, int> */
    private function priorityDeckIds(TrickEvent $event): Collection
    {
        $previous = TrickEvent::query()
            ->where('end_at', '<=', $event->start_at)
            ->where('event_id', '!=', $event->event_id)
            ->orderByDesc('end_at')
            ->first();
        if ($previous === null) {
            return collect();
        }

        return TrickEventCard::query()
            ->where('trick_event_cards.event_id', $previous->event_id)
            ->where('trick_event_cards.state', '_collected')
            ->leftJoin('trick_card_holders', function ($join) {
                $join->on('trick_card_holders.event_card_id', '=', 'trick_event_cards.id');
            })
            ->whereNull('trick_card_holders.id')
            ->orderBy('trick_event_cards.collected_at')
            ->pluck('trick_event_cards.deck_id');
    }
}
