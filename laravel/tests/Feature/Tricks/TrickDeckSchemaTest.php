<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class TrickDeckSchemaTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): object
    {
        return require database_path('migrations/2026_10_04_000000_consolidate_trick_deck_columns.php');
    }

    public function test_consolidation_preserves_card_data_and_event_rarity_and_can_roll_back(): void
    {
        $migration = $this->migration();
        $migration->down();
        $deck = Deck::query()->create([
            'eventId' => 990074, 'stageId' => 399, 'origin_stage_id' => null,
            'ruleName' => '旧ルール', 'rule_name' => null, 'topPlayer' => 'test-holder',
            'top_player' => null, 'title' => '検査カード', 'text' => '本文',
            'state' => '_eligible', 'rarity' => 4, 'rewards' => 0,
        ]);
        $event = TrickEvent::query()->create([
            'event_id' => 990074, 'title' => '列統合検査', 'start_at' => now(),
            'end_at' => now()->addDays(2), 'state' => 'scheduled',
        ]);
        $card = TrickEventCard::query()->create([
            'event_id' => $event->event_id, 'deck_id' => $deck->id,
            'difficulty' => 1, 'rarity' => 5, 'draw_count' => 2,
        ]);
        $before = $card->fresh()->getAttributes();
        $migration->up();
        foreach (['ruleName', 'stageId', 'topPlayer', 'rarity'] as $column) {
            self::assertFalse(Schema::hasColumn('decks', $column));
        }
        self::assertSame('旧ルール', $deck->fresh()->rule_name);
        self::assertSame(399, $deck->fresh()->origin_stage_id);
        self::assertSame('test-holder', $deck->fresh()->top_player);
        self::assertSame($before, $card->fresh()->getAttributes());
        $migration->down();
        self::assertSame('旧ルール', $deck->fresh()->ruleName);
        self::assertSame(399, $deck->fresh()->stageId);
        self::assertSame(5, $deck->fresh()->rarity);
    }

    public function test_conflicting_values_abort_before_column_deletion(): void
    {
        $migration = $this->migration();
        $migration->down();
        Deck::query()->create([
            'eventId' => 990075, 'stageId' => 0, 'origin_stage_id' => null,
            'ruleName' => '旧ルール', 'rule_name' => '別ルール',
            'title' => '検査カード', 'text' => '本文', 'state' => '_eligible', 'rewards' => 0,
        ]);
        try {
            $migration->up();
            self::fail('競合する列を削除してはいけません');
        } catch (RuntimeException $exception) {
            self::assertStringContainsString('競合', $exception->getMessage());
            self::assertTrue(Schema::hasColumn('decks', 'ruleName'));
        }
    }
    public function test_draw_count_backfill_uses_logs_and_keeps_unopened_cards_at_zero(): void
    {
        $event = TrickEvent::query()->create([
            'event_id' => 990076, 'title' => '開封履歴検査', 'start_at' => now(),
            'end_at' => now()->addDays(2), 'state' => 'scheduled',
        ]);
        $cards = [];
        foreach ([null, 2, 3] as $rarity) {
            $deck = Deck::query()->create([
                'eventId' => 990076, 'rule_name' => 'ルール', 'title' => '検査カード',
                'text' => '本文', 'state' => '_eligible', 'rewards' => 0,
            ]);
            $cards[] = TrickEventCard::query()->create([
                'event_id' => $event->event_id, 'deck_id' => $deck->id,
                'difficulty' => 1, 'rarity' => $rarity,
            ]);
        }
        foreach (range(1, 2) as $unused) {
            DB::table('limit_logs')->insert([
                'event' => 'draw', 'event_id' => $event->event_id,
                'event_card_id' => $cards[2]->id,
            ]);
        }
        $migration = require database_path('migrations/2026_10_04_000001_add_draw_count_to_trick_event_cards.php');
        $migration->down();
        $migration->up();
        self::assertSame(0, $cards[0]->fresh()->draw_count);
        self::assertSame(1, $cards[1]->fresh()->draw_count);
        self::assertSame(2, $cards[2]->fresh()->draw_count);
    }

    public function test_legacy_record_update_uses_posting_stage_and_canonical_top_player(): void
    {
        $values = [
            'eventId' => 990078, 'rule_name' => 'ルール', 'title' => '検査カード',
            'text' => '本文', 'state' => '_eligible', 'rewards' => 0,
            'top_player' => 'test-holder',
        ];
        $target = Deck::query()->create([...$values, 'stage_id' => 1350, 'origin_stage_id' => 399]);
        $other = Deck::query()->create([...$values, 'stage_id' => 1351, 'origin_stage_id' => 1350]);
        $response = app(\App\Http\Controllers\CardController::class)->updateStageOnRecord(1350);
        self::assertSame(204, $response->getStatusCode());
        self::assertNull($target->fresh()->top_player);
        self::assertNotNull($target->fresh()->limit);
        self::assertSame('test-holder', $other->fresh()->top_player);
        self::assertNull($other->fresh()->limit);
    }

    public function test_legacy_cards_can_be_migrated_before_consolidation_and_draw_count_addition(): void
    {
        $consolidation = $this->migration();
        $drawCounts = require database_path('migrations/2026_10_04_000001_add_draw_count_to_trick_event_cards.php');
        $drawCounts->down();
        $consolidation->down();
        $event = TrickEvent::query()->create([
            'event_id' => 990079, 'title' => '旧スキーマ移行', 'start_at' => now()->subDays(3),
            'end_at' => now()->subDay(), 'state' => 'ended',
        ]);
        $deck = Deck::query()->create([
            'eventId' => $event->event_id, 'event_id' => $event->event_id,
            'stageId' => 399, 'origin_stage_id' => 399,
            'ruleName' => 'ルール', 'rule_name' => 'ルール', 'title' => '旧カード',
            'text' => '本文', 'state' => '_collected', 'rarity' => 4, 'difficulty' => 2, 'rewards' => 0,
        ]);
        app(\App\Services\Tricks\TrickLegacyMigrationService::class)->migrate($event);
        $consolidation->up();
        $drawCounts->up();
        $card = $deck->eventCards()->where('event_id', $event->event_id)->firstOrFail();
        self::assertSame(4, $card->rarity);
        self::assertSame(1, $card->draw_count);
        self::assertFalse(Schema::hasColumn('decks', 'rarity'));
    }

    public function test_consolidation_requires_the_same_event_and_preserved_confirmed_rarity(): void
    {
        $migration = $this->migration();
        $migration->down();
        foreach ([990080, 990081] as $eventId) {
            TrickEvent::query()->create([
                'event_id' => $eventId, 'title' => '履歴保全', 'start_at' => now(),
                'end_at' => now()->addDays(2), 'state' => 'scheduled',
            ]);
        }
        $deck = Deck::query()->create([
            'eventId' => 990080, 'event_id' => 990080, 'stageId' => 399, 'origin_stage_id' => 399,
            'ruleName' => 'ルール', 'rule_name' => 'ルール', 'title' => '旧カード',
            'text' => '本文', 'state' => '_collected', 'rarity' => 4, 'rewards' => 0,
        ]);
        TrickEventCard::query()->create(['event_id' => 990081, 'deck_id' => $deck->id, 'difficulty' => 1, 'rarity' => 4]);
        foreach (['missing', null, 3, 4] as $savedRarity) {
            if ($savedRarity !== 'missing') {
                TrickEventCard::query()->updateOrCreate(
                    ['event_id' => 990080, 'deck_id' => $deck->id],
                    ['difficulty' => 1, 'rarity' => $savedRarity],
                );
            }
            try {
                $migration->up();
                self::assertSame(4, $savedRarity);
            } catch (RuntimeException $exception) {
                self::assertNotSame(4, $savedRarity);
                self::assertStringContainsString('確定レア度', $exception->getMessage());
                self::assertSame(4, $deck->fresh()->rarity);
            }
        }
    }

    public function test_consolidation_accepts_unopened_new_event_cards(): void
    {
        $migration = $this->migration();
        $migration->down();
        $event = TrickEvent::query()->create([
            'event_id' => 990082, 'title' => '未開封', 'start_at' => now(),
            'end_at' => now()->addDays(2), 'state' => 'scheduled',
        ]);
        $deck = Deck::query()->create([
            'eventId' => $event->event_id, 'stageId' => 399, 'origin_stage_id' => 399,
            'ruleName' => 'ルール', 'rule_name' => 'ルール', 'title' => '未開封カード',
            'text' => '本文', 'state' => '_in_event', 'rarity' => 1, 'rewards' => 0,
        ]);
        $card = TrickEventCard::query()->create([
            'event_id' => $event->event_id, 'deck_id' => $deck->id, 'difficulty' => 1, 'rarity' => null,
        ]);
        $migration->up();
        self::assertNull($card->fresh()->rarity);
        self::assertSame(0, $card->fresh()->draw_count);
    }

}
