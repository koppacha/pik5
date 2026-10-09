<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\TrickEvent;
use App\Services\Tricks\TrickEventResolver;
use App\Services\Tricks\TrickGameService;
use Carbon\CarbonImmutable;
use Database\Seeders\TrickProduction261009Seeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class TrickProduction261009SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_import_cleanup_start_boundary_and_idempotency(): void
    {
        $this->sourceStages();
        $old = TrickEvent::query()->create(['event_id' => 251227, 'title' => '旧テスト', 'debug' => true,
            'start_at' => '2026-01-01', 'end_at' => '2026-12-31']);
        $dummy = $this->deck(251227, 'codex_dummy');
        $keep = $this->deck(260000, '保存する考案者');
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-09 19:59:59', 'Asia/Tokyo'));
        try {
            $this->seed(TrickProduction261009Seeder::class);
            self::assertNull($old->fresh());
            self::assertNull($dummy->fresh());
            self::assertNotNull($keep->fresh());
            $event = TrickEvent::query()->where('event_id', 261009)->firstOrFail();
            self::assertFalse($event->debug);
            self::assertFalse($event->test_mode);
            self::assertSame('2026-10-11 19:59:00', $event->end_at->format('Y-m-d H:i:s'));
            self::assertSame(160, $event->cards()->where('state', '_deck')->count());
            self::assertSame(261009, (int) app(TrickEventResolver::class)->current()->event_id);
            $cards = Deck::query()->where('eventId', 261009)->get();
            self::assertTrue($cards->contains('score_type', 'time'));
            self::assertTrue($cards->contains('score_type', 'points'));
            self::assertTrue($cards->contains('origin_stage_id', 200));
            self::assertTrue($cards->contains('origin_stage_id', 300));
            self::assertTrue($cards->every(fn ($card) => (int) $card->card_id === (int) $card->id));
            $game = app(TrickGameService::class);
            try {
                $game->join($event, 'codex_production_probe');
                self::fail('開催前の参加を受理してはいけない');
            } catch (HttpResponseException $error) {
                self::assertSame(403, $error->getResponse()->getStatusCode());
            }
            CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-09 20:00:00', 'Asia/Tokyo'));
            $game->join($event, 'codex_production_probe');
            $draw = $game->draw($event, 'codex_production_probe');
            self::assertSame(159, $draw['deck_count']);
            self::assertSame(4, $draw['player']['draw_points']);
            self::assertCount(1, $draw['hand']);
            $this->seed(TrickProduction261009Seeder::class);
            self::assertSame(159, $event->cards()->where('state', '_deck')->count());
            self::assertSame(160, Deck::query()->where('eventId', 261009)->count());
        } finally {
            CarbonImmutable::setTestNow();
        }
    }

    public function test_cleanup_refuses_unrecognized_cards_without_deleting_anything(): void
    {
        $this->sourceStages();
        TrickEvent::query()->create(['event_id' => 251227, 'title' => '旧大会', 'debug' => true,
            'start_at' => '2026-01-01', 'end_at' => '2026-12-31']);
        $keep = $this->deck(251227, 'テストではない考案者');
        try {
            $this->seed(TrickProduction261009Seeder::class);
            self::fail('不明なカードを削除してはいけない');
        } catch (RuntimeException $error) {
            self::assertStringContainsString('テスト用と確認できない', $error->getMessage());
        }
        self::assertNotNull($keep->fresh());
        self::assertSame(1, TrickEvent::query()->count());
        self::assertFalse(TrickEvent::query()->where('event_id', 261009)->exists());
    }

    private function deck(int $eventId, string $creator): Deck
    {
        return Deck::query()->create(['eventId' => $eventId, 'origin_stage_id' => 201, 'title' => '検証用',
            'rule_name' => '検証', 'text' => '合成データ', 'difficulty' => 1, 'rewards' => 0,
            'creator' => $creator, 'state' => '_eligible']);
    }

    private function sourceStages(): void
    {
        $file = fopen(database_path('seeders/data/decks261009.csv'), 'r');
        $header = fgetcsv($file, 0, ',', '"', '');
        $index = array_search('origin_stage_id', $header, true);
        $ids = [];
        while (($row = fgetcsv($file, 0, ',', '"', '')) !== false) {
            if ($row !== [null] && (int) $row[$index] % 100 !== 0) $ids[(int) $row[$index]] = true;
        }
        fclose($file);
        foreach (array_keys($ids) as $id) {
            DB::table('stages')->insert(['stage_id' => $id, 'stage_name' => '検証元ステージ',
                'eng_stage_name' => 'Synthetic stage', 'stage_sub' => '', 'type' => 'stage', 'display' => 'int',
                'series' => intdiv($id, 100), 'parent' => 0, 'time' => 0, 'treasure' => 0,
                'pikmin' => 0, 'border1' => 0, 'border2' => 0, 'border3' => 0, 'border4' => 0]);
        }
    }
}
