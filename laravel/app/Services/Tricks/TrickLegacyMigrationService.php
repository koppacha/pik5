<?php

namespace App\Services\Tricks;

use App\Models\Deck;
use App\Models\Record;
use App\Models\TrickCardHolder;
use App\Models\TrickCardPayment;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Models\TrickEventRecord;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class TrickLegacyMigrationService
{
    public function __construct(private readonly TrickRuleCalculator $rules)
    {
    }

    public function inspect(TrickEvent $event): array
    {
        $decks = $this->legacyDecks($event);
        $existingDeckIds = TrickEventCard::query()->where('event_id', $event->event_id)->pluck('deck_id');
        $newDecks = $decks->whereNotIn('id', $existingDeckIds);
        $recordCount = 0;
        $paymentCount = 0;
        $holderCount = 0;
        foreach ($decks as $deck) {
            $records = $this->records($event, $deck)
                ->whereNotIn('post_id', TrickEventRecord::query()->pluck('record_id'));
            $recordCount += $records->count();
            $paymentCount += $records->unique('user_id')->count();
            if ($this->legacyState($deck) === '_collected' && $this->topPlayer($deck) !== null) {
                $holderCount++;
            }
        }

        return [
            'event_id' => $event->event_id,
            'source_decks' => $decks->count(),
            'event_cards_to_create' => $newDecks->count(),
            'record_links_to_create' => $recordCount,
            'payments_to_create' => $paymentCount,
            'holders_to_create' => $holderCount,
            'already_migrated_cards' => $decks->count() - $newDecks->count(),
        ];
    }

    public function migrate(TrickEvent $event): array
    {
        $before = $this->inspect($event);

        $created = DB::transaction(function () use ($event): array {
            $counts = ['event_cards' => 0, 'record_links' => 0, 'payments' => 0, 'holders' => 0];
            foreach ($this->legacyDecks($event) as $deck) {
                $card = TrickEventCard::query()->firstOrCreate(
                    ['event_id' => $event->event_id, 'deck_id' => $deck->id],
                    [
                        'state' => $this->legacyState($deck),
                        'difficulty' => max(1, min(5, (int) $deck->difficulty)),
                        'rarity' => max(1, min(5, (int) ($deck->rarity ?: 1))),
                        'stack_count' => (int) ($deck->stack_count ?? $deck->rewards ?? 0),
                        'taker' => $deck->taker,
                        'top_player' => $this->topPlayer($deck),
                        'post_count' => (int) ($deck->post_count ?? $deck->count ?? 0),
                        'limit_at' => $deck->limit_at ?? $deck->limit,
                        'taken_at' => $deck->taken_at,
                        'collected_at' => $deck->collected_at,
                        'drawn_order' => $deck->drawn_order,
                    ],
                );
                if ($card->wasRecentlyCreated) {
                    $counts['event_cards']++;
                }

                $records = $this->records($event, $deck);
                $participantOrder = 0;
                $paidTotal = (int) $card->paid_points_total;
                $seenPlayers = [];
                foreach ($records as $record) {
                    $link = TrickEventRecord::query()->firstOrCreate(
                        ['record_id' => $record->post_id],
                        ['event_id' => $event->event_id, 'event_card_id' => $card->id, 'deck_id' => $deck->id],
                    );
                    if ($link->wasRecentlyCreated) {
                        $counts['record_links']++;
                    }
                    if (in_array($record->user_id, $seenPlayers, true)) {
                        continue;
                    }
                    $seenPlayers[] = $record->user_id;
                    $points = $this->rules->initialPostCost(
                        (int) $card->difficulty,
                        $record->user_id === $card->taker,
                        false,
                    );
                    $participantOrder++;
                    if (TrickCardPayment::query()->where('event_id', $event->event_id)
                        ->where('deck_id', $deck->id)->where('player_name', $record->user_id)->exists()) {
                        continue;
                    }
                    TrickCardPayment::query()->create([
                        'event_id' => $event->event_id,
                        'event_card_id' => $card->id,
                        'deck_id' => $deck->id,
                        'stage_id' => $record->stage_id,
                        'player_name' => $record->user_id,
                        'points_paid' => $points,
                        'record_id' => $record->post_id,
                        'payment_type' => 'initial_post',
                        'submission_number' => 1,
                        'idempotency_key' => 'legacy-initial-'.$record->post_id,
                    ]);
                    $paidTotal += $points;
                    $counts['payments']++;
                }
                $card->update(['post_count' => max((int) $card->post_count, $participantOrder), 'paid_points_total' => $paidTotal]);

                $holder = $this->topPlayer($deck);
                if ($card->state === '_collected' && $holder !== null) {
                    $createdHolder = TrickCardHolder::query()->firstOrCreate([
                        'event_id' => $event->event_id,
                        'event_card_id' => $card->id,
                        'deck_id' => $deck->id,
                        'player_name' => $holder,
                    ]);
                    $counts['holders'] += $createdHolder->wasRecentlyCreated ? 1 : 0;
                }
            }

            return $counts;
        });

        return ['dry_run' => $before, 'created' => $created, 'remaining' => $this->inspect($event->fresh())];
    }

    private function legacyDecks(TrickEvent $event): Collection
    {
        return Deck::query()
            ->where(function ($query) use ($event) {
                $query->where('event_id', $event->event_id)->orWhere('eventId', $event->event_id);
            })
            ->where(function ($query) use ($event) {
                $query->whereNull('creator')->orWhere('creator', '!=', "codex_fixture_{$event->event_id}");
            })
            ->orderBy('id')->get();
    }

    private function records(TrickEvent $event, Deck $deck): Collection
    {
        $stageId = (int) ($deck->stage_id ?? 0);
        if ($stageId <= 0) {
            return collect();
        }

        return Record::query()->where('stage_id', $stageId)
            ->whereBetween('created_at', [$event->start_at, $event->end_at])
            ->orderBy('created_at')->orderBy('post_id')->get();
    }

    private function legacyState(Deck $deck): string
    {
        $state = (string) $deck->state;

        return in_array($state, ['_deck', '_trash', '_stack', '_field', '_collected'], true) || $state !== ''
            ? $state
            : '_deck';
    }

    private function topPlayer(Deck $deck): ?string
    {
        $player = trim((string) ($deck->top_player ?? $deck->topPlayer ?? ''));

        return $player === '' ? null : $player;
    }
}
