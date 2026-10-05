<?php

namespace Database\Seeders;

use App\Models\Deck;
use App\Models\TrickEvent;
use App\Services\Tricks\TrickEventInitializer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class TrickStaging261001Seeder extends Seeder
{
    private const EVENT_ID = 261001;
    private const CREATOR = 'codex_staging_261001';

    public function run(): void
    {
        $stageIds = array_merge(range(201, 230), range(301, 350), range(401, 422));
        $stageNames = DB::table('stages')->whereIn('stage_id', $stageIds)
            ->pluck('stage_name', 'stage_id');
        if ($stageNames->count() !== count($stageIds)) {
            throw new RuntimeException('テストカード用ステージが不足しています');
        }

        DB::transaction(function () use ($stageIds, $stageNames): void {
            $event = TrickEvent::query()->where('event_id', self::EVENT_ID)->lockForUpdate()->first();
            $decks = Deck::query()->where('eventId', self::EVENT_ID)
                ->where('creator', self::CREATOR)->orderBy('id')->get();
            if ($event !== null || $decks->isNotEmpty()) {
                if ($event !== null && $event->initialized_at !== null && $decks->count() === TrickEventInitializer::DECK_SIZE
                    && $event->cards()->count() === TrickEventInitializer::DECK_SIZE) {
                    return;
                }
                throw new RuntimeException('大会261001の既存データを確認してください。Seederは上書きしません');
            }

            $event = TrickEvent::query()->create([
                'event_id' => self::EVENT_ID,
                'title' => 'トリックテイキング制 テスト大会',
                'start_at' => '2026-10-01 20:00:00',
                'end_at' => '2026-10-01 23:00:00',
                'state' => 'scheduled',
                'debug' => false,
                'test_mode' => false,
            ]);
            $ids = collect();
            for ($index = 1; $index <= TrickEventInitializer::DECK_SIZE; $index++) {
                $stageId = $stageIds[($index - 1) % count($stageIds)];
                $ruleName = sprintf('サンプル%03d', $index);
                $deck = Deck::query()->create([
                    'eventId' => self::EVENT_ID,
                    'event_id' => null,
                    'stage_id' => null,
                    'origin_stage_id' => $stageId,
                    'title' => $stageNames[$stageId],
                    'rule_name' => $ruleName,
                    'state' => '_eligible',
                    'text' => 'これはテストです。スコアを入力してください。',
                    'difficulty' => (($index - 1) % 5) + 1,
                    'rewards' => 0,
                    'creator' => self::CREATOR,
                    'count' => 0,
                ]);
                $ids->push($deck->id);
            }

            app(TrickEventInitializer::class)->initialize($event, $ids);
        });
    }
}
