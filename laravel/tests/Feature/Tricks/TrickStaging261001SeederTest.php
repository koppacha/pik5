<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\TrickEvent;
use Database\Seeders\TrickStaging261001Seeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class TrickStaging261001SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_exactly_160_score_cards_and_is_idempotent(): void
    {
        $stageIds = array_merge(range(201, 230), range(301, 350), range(401, 422));
        foreach ($stageIds as $id) {
            DB::table('stages')->insert([
                'stage_id' => $id,
                'stage_name' => 'ステージ'.$id,
                'eng_stage_name' => 'Stage '.$id,
                'stage_sub' => '',
                'type' => 'stage',
                'display' => 'int',
                'series' => 2,
                'parent' => 0,
                'time' => 0,
                'treasure' => 0,
                'pikmin' => 0,
                'border1' => 0,
                'border2' => 0,
                'border3' => 0,
                'border4' => 0,
            ]);
        }

        $this->seed(TrickStaging261001Seeder::class);
        $event = TrickEvent::query()->where('event_id', 261001)->firstOrFail();
        self::assertSame('2026-10-01 20:00:00', $event->start_at->format('Y-m-d H:i:s'));
        self::assertSame('2026-10-01 23:00:00', $event->end_at->format('Y-m-d H:i:s'));
        self::assertFalse($event->debug);
        self::assertFalse($event->test_mode);
        self::assertSame(160, $event->cards()->count());
        $decks = Deck::query()->where('eventId', 261001)->get();
        self::assertCount(160, $decks);
        foreach ($decks as $deck) {
            self::assertContains((int) $deck->origin_stage_id, $stageIds);
            self::assertSame('ステージ'.$deck->origin_stage_id, $deck->title);
            self::assertMatchesRegularExpression('/^サンプル\d{3}$/u', $deck->rule_name);
            self::assertSame('_in_event', $deck->state);
            self::assertSame('これはテストです。スコアを入力してください。', $deck->text);
        }

        $this->seed(TrickStaging261001Seeder::class);
        self::assertSame(160, Deck::query()->where('eventId', 261001)->count());
    }

    public function test_missing_stage_rolls_back_without_creating_event(): void
    {
        $this->expectException(RuntimeException::class);
        try {
            $this->seed(TrickStaging261001Seeder::class);
        } finally {
            self::assertFalse(TrickEvent::query()->where('event_id', 261001)->exists());
        }
    }
}
