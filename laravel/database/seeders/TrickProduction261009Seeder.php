<?php

namespace Database\Seeders;

use App\Models\Deck;
use App\Models\TrickEvent;
use App\Services\Tricks\TrickEventInitializer;
use App\Services\Tricks\TrickStageAllocator;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

class TrickProduction261009Seeder extends Seeder
{
    public const EVENT_ID = 261009;

    public function run(): void
    {
        $cards = $this->readCards();
        DB::transaction(function () use ($cards): void {
            app(TrickStageAllocator::class)->lock();
            $existing = TrickEvent::query()->where('event_id', self::EVENT_ID)->lockForUpdate()->first();
            if ($existing !== null) {
                $actual = Deck::query()->where('eventId', self::EVENT_ID)->orderBy('id')->get();
                if ($existing->title !== '第19回期間限定ランキング'
                    || $existing->start_at->format('Y-m-d H:i:s') !== '2026-10-09 20:00:00'
                    || $existing->end_at->format('Y-m-d H:i:s') !== '2026-10-11 19:59:00'
                    || $existing->debug || $existing->test_mode || $existing->initialized_at === null
                    || $existing->cards()->count() !== count($cards) || $actual->count() !== count($cards)) {
                    throw new RuntimeException('大会261009の既存データは上書きできません');
                }
                foreach ($cards as $index => $card) {
                    foreach (['origin_stage_id', 'title', 'rule_name', 'text', 'difficulty', 'creator', 'score_type'] as $key) {
                        if ((string) $actual[$index]->getAttribute($key) !== (string) $card[$key]) {
                            throw new RuntimeException('大会261009の既存カードがCSVと異なります');
                        }
                    }
                }
                app(TrickStageAllocator::class)->ensureCategory($existing);
                $this->command?->info('大会261009は投入済みです（既存状態を維持）');
                return;
            }
            if (Deck::query()->where('eventId', self::EVENT_ID)->exists()) {
                throw new RuntimeException('大会261009の孤立カードを確認してください');
            }
            $this->removeTestData();
            $event = TrickEvent::query()->create([
                'event_id' => self::EVENT_ID,
                'title' => '第19回期間限定ランキング',
                'start_at' => '2026-10-09 20:00:00',
                'end_at' => '2026-10-11 19:59:00',
                'state' => 'scheduled',
                'debug' => false,
                'test_mode' => false,
                'random_seed' => self::EVENT_ID,
            ]);
            $ids = collect();
            foreach ($cards as $card) {
                unset($card['card_key']);
                $deck = Deck::query()->create([
                    ...$card,
                    'eventId' => self::EVENT_ID,
                    'event_id' => null,
                    'stage_id' => null,
                    'state' => '_eligible',
                    'rewards' => 0,
                    'count' => 0,
                ]);
                $deck->update(['card_id' => $deck->id]);
                $ids->push($deck->id);
            }
            app(TrickEventInitializer::class)->initialize($event, $ids);
            app(TrickStageAllocator::class)->ensureCategory($event);
            $this->command?->info('大会261009と本番相当カード160枚を投入しました');
        });
    }

    private function readCards(): array
    {
        $columns = ['card_key', 'origin_stage_id', 'title', 'rule_name', 'text', 'difficulty', 'creator', 'score_type'];
        $file = fopen(database_path('seeders/data/decks261009.csv'), 'r');
        if ($file === false) throw new RuntimeException('decks261009.csvを読み込めません');
        try {
            $header = fgetcsv($file, 0, ',', '"', '');
            if (! is_array($header)) throw new RuntimeException('CSVヘッダーがありません');
            $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
            if (count($header) !== count($columns) || array_diff($columns, $header) !== []) {
                throw new RuntimeException('CSVの8列ヘッダーが不正です');
            }
            $cards = [];
            while (($row = fgetcsv($file, 0, ',', '"', '')) !== false) {
                if ($row === [null]) continue;
                if (count($row) !== count($header)) throw new RuntimeException('CSV列数が不正です');
                $card = array_combine($header, $row);
                if ($card['score_type'] === 'score') $card['score_type'] = 'points';
                Validator::make($card, [
                    'card_key' => ['required', 'string', 'max:255'],
                    'origin_stage_id' => ['required', 'integer', 'between:100,499'],
                    'title' => ['required', 'string', 'max:255'],
                    'rule_name' => ['required', 'string', 'max:255'],
                    'text' => ['required', 'string'],
                    'difficulty' => ['required', 'integer', 'between:1,5'],
                    'creator' => ['nullable', 'string', 'max:255'],
                    'score_type' => ['required', 'in:points,time'],
                ])->validate();
                $card['origin_stage_id'] = (int) $card['origin_stage_id'];
                $card['difficulty'] = (int) $card['difficulty'];
                $cards[] = $card;
            }
        } finally {
            fclose($file);
        }
        if (count($cards) !== TrickEventInitializer::DECK_SIZE
            || count(array_unique(array_column($cards, 'card_key'))) !== count($cards)) {
            throw new RuntimeException('CSVには一意なcard_keyで160枚必要です');
        }
        $origins = collect($cards)->pluck('origin_stage_id')->unique()->filter(fn (int $id) => $id % 100 !== 0);
        if (DB::table('stages')->whereIn('stage_id', $origins)->count() !== $origins->count()) {
            throw new RuntimeException('通常カードの元ステージが不足しています');
        }
        return $cards;
    }

    private function removeTestData(): void
    {
        $events = TrickEvent::query()->where('test_mode', true)->orWhereIn('event_id', [251227, 261001])->lockForUpdate()->get();
        foreach ($events as $event) {
            $allowedCreators = match ((int) $event->event_id) {
                251227 => ['codex_dummy', 'recovery_placeholder'],
                261001 => ['codex_staging_261001'],
                default => ['codex_fixture_'.$event->event_id],
            };
            if (((int) $event->event_id === 251227 && ! $event->debug)
                || ((int) $event->event_id === 261001 && ! str_contains($event->title, 'テスト'))
                || Deck::query()->where('eventId', $event->event_id)->where(function ($query) use ($allowedCreators) {
                    $query->whereNull('creator')->orWhereNotIn('creator', $allowedCreators);
                })->exists()) {
                throw new RuntimeException('削除対象にテスト用と確認できないカード・大会があります');
            }
        }
        $eventIds = $events->pluck('event_id');
        $deckIds = Deck::query()->whereIn('eventId', $eventIds)->pluck('id');
        if (DB::table('trick_event_cards')->whereIn('deck_id', $deckIds)->whereNotIn('event_id', $eventIds)->exists()) {
            throw new RuntimeException('テストカードが別の大会にも使われています');
        }
        $stageIds = Deck::query()->whereIn('id', $deckIds)->whereBetween('stage_id', [1001, 1999])->pluck('stage_id');
        $recordIds = DB::table('trick_event_records')->whereIn('event_id', $eventIds)->pluck('record_id');
        DB::table('records')->whereIn('post_id', $recordIds)->delete();
        DB::table('limit_logs')->whereIn('event_id', $eventIds)->delete();
        DB::table('players')->whereIn('event_id', $eventIds)->delete();
        TrickEvent::query()->whereIn('event_id', $eventIds)->delete();
        Deck::query()->whereIn('id', $deckIds)->delete();
        foreach ($stageIds->unique() as $stageId) {
            if (! DB::table('records')->where('stage_id', $stageId)->exists()
                && ! Deck::query()->where('stage_id', $stageId)->exists()) {
                DB::table('stages')->where('stage_id', $stageId)->delete();
            }
        }
        $this->command?->info('確認済みテスト大会の削除件数: '.$events->count().'、カード: '.$deckIds->count());
    }
}
