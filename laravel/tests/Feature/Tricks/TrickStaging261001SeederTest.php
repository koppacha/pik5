<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\TrickEvent;
use App\Services\Tricks\TrickGameService;
use Carbon\CarbonImmutable;
use Database\Seeders\TrickStaging261001Seeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class TrickStaging261001SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_exactly_160_score_cards_and_is_idempotent(): void
    {
        $this->createSourceStages();
        $stageIds = array_merge(range(201, 230), range(301, 350), range(401, 422));

        $this->seed(TrickStaging261001Seeder::class);
        $event = TrickEvent::query()->where('event_id', 261001)->firstOrFail();
        self::assertSame('2026-10-01 20:00:00', $event->start_at->format('Y-m-d H:i:s'));
        self::assertSame('2026-10-06 22:00:00', $event->end_at->format('Y-m-d H:i:s'));
        self::assertFalse($event->debug);
        self::assertFalse($event->test_mode);
        self::assertSame(160, $event->cards()->count());
        $decks = Deck::query()->where('eventId', 261001)->get();
        self::assertCount(160, $decks);
        $csv = array_map('str_getcsv', file(database_path('seeders/data/tricks_261001_cards.csv'), FILE_IGNORE_NEW_LINES));
        $columns = array_shift($csv);
        $expected = collect($csv)->map(fn ($row) => array_combine($columns, $row))->keyBy('rule_name');
        foreach ($decks as $deck) {
            self::assertContains((int) $deck->origin_stage_id, $stageIds);
            self::assertSame($expected[$deck->rule_name]['title'], $deck->title);
            self::assertSame((int) $expected[$deck->rule_name]['difficulty'], (int) $deck->difficulty);
            self::assertMatchesRegularExpression('/^サンプル\d{3}$/u', $deck->rule_name);
            self::assertSame('_in_event', $deck->state);
            self::assertSame('これはテストです。スコアを入力してください。', $deck->text);
        }

        $event->update(['end_at' => '2026-10-01 23:00:00']);
        $cardIds = $event->cards()->pluck('id')->all();
        $this->seed(TrickStaging261001Seeder::class);
        self::assertSame('2026-10-06 22:00:00', $event->fresh()->end_at->format('Y-m-d H:i:s'));
        self::assertSame($cardIds, $event->cards()->pluck('id')->all());
        self::assertSame(160, Deck::query()->where('eventId', 261001)->count());
        $event->update(['state' => 'ended']);
        $this->seed(TrickStaging261001Seeder::class);
        self::assertSame('ended', $event->fresh()->state);
    }

    public function test_short_event_can_join_draw_and_take_until_final_hour(): void
    {
        $this->createSourceStages();
        $this->seed(TrickStaging261001Seeder::class);
        $event = TrickEvent::query()->where('event_id', 261001)->firstOrFail();
        $game = app(TrickGameService::class);

        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-01 20:01:00', 'Asia/Tokyo'));
        try {
            self::assertTrue($game->join($event, 'staging-test-player')['created']);
            $game->draw($event, 'staging-test-player');
            $game->draw($event, 'staging-test-player');
            $hand = $game->draw($event, 'staging-test-player')['hand'];
            self::assertCount(3, $hand);
            self::assertSame('_field', $game->take($event, 'staging-test-player', $hand[0]['id'])['card']['state']);

            CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-06 21:00:00', 'Asia/Tokyo'));
            $game->join($event, 'staging-test-late-player');
            $game->draw($event, 'staging-test-late-player');
            $game->draw($event, 'staging-test-late-player');
            $hand = $game->draw($event, 'staging-test-late-player')['hand'];
            try {
                $game->take($event, 'staging-test-late-player', $hand[0]['id']);
                self::fail('Take should close at 2026-10-06 21:00');
            } catch (HttpResponseException $exception) {
                self::assertSame(403, $exception->getResponse()->getStatusCode());
            }
        } finally {
            CarbonImmutable::setTestNow();
        }
    }

    private function createSourceStages(): void
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
