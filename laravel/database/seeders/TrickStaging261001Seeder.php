<?php

namespace Database\Seeders;

use App\Models\Deck;
use App\Models\TrickEvent;
use App\Services\Tricks\TrickEventInitializer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

class TrickStaging261001Seeder extends Seeder
{
    private const EVENT_ID = 261001;
    private const CREATOR = 'codex_staging_261001';

    public function run(): void
    {
        $events = $this->readCsv('tricks_261001_event.csv', ['event_id', 'title', 'start_at', 'end_at', 'debug', 'test_mode', 'random_seed']);
        if (count($events) !== 1) {
            throw new RuntimeException('大会CSVは大会261001の1行だけにしてください');
        }
        $settings = Validator::make($events[0], [
            'event_id' => ['required', 'integer', 'in:261001'],
            'title' => ['required', 'string', 'max:255'],
            'start_at' => ['required', 'date_format:Y-m-d H:i:s'],
            'end_at' => ['required', 'date_format:Y-m-d H:i:s', 'after:start_at'],
            'debug' => ['required', 'boolean'],
            'test_mode' => ['required', 'boolean'],
            'random_seed' => ['required', 'integer', 'min:1'],
        ])->validate();
        $cards = $this->readCsv('tricks_261001_cards.csv', ['card_key', 'origin_stage_id', 'title', 'rule_name', 'text', 'difficulty']);
        if (count($cards) !== TrickEventInitializer::DECK_SIZE || count(array_unique(array_column($cards, 'card_key'))) !== count($cards)) {
            throw new RuntimeException('カードCSVは重複しないcard_keyで160行必要です');
        }
        foreach ($cards as $card) {
            Validator::make($card, [
                'card_key' => ['required', 'regex:/^261001-[0-9]{3}$/'],
                'origin_stage_id' => ['required', 'integer', 'min:1'],
                'title' => ['required', 'string', 'max:255'],
                'rule_name' => ['required', 'string', 'max:255'],
                'text' => ['required', 'string'],
                'difficulty' => ['required', 'integer', 'between:1,5'],
            ])->validate();
        }
        $stageIds = array_unique(array_column($cards, 'origin_stage_id'));
        if (DB::table('stages')->whereIn('stage_id', $stageIds)->count() !== count($stageIds)) {
            throw new RuntimeException('テストカード用ステージが不足しています');
        }

        DB::transaction(function () use ($settings, $cards): void {
            $event = TrickEvent::query()->where('event_id', self::EVENT_ID)->lockForUpdate()->first();
            $decks = Deck::query()->where('eventId', self::EVENT_ID)
                ->where('creator', self::CREATOR)->orderBy('id')->get();
            if ($event !== null || $decks->isNotEmpty()) {
                if ($event !== null && $event->initialized_at !== null && $decks->count() === TrickEventInitializer::DECK_SIZE
                    && $event->cards()->count() === TrickEventInitializer::DECK_SIZE) {
                    if ($event->state !== 'ended' && $event->end_at->lessThan($settings['end_at'])) {
                        $event->update(['end_at' => $settings['end_at']]);
                    }
                    return;
                }
                throw new RuntimeException('大会261001の既存データを確認してください。Seederは上書きしません');
            }

            $event = TrickEvent::query()->create([
                ...$settings,
                'state' => 'scheduled',
                'debug' => (bool) $settings['debug'],
                'test_mode' => (bool) $settings['test_mode'],
            ]);
            $ids = collect();
            foreach ($cards as $card) {
                $deck = Deck::query()->create([
                    'eventId' => self::EVENT_ID,
                    'event_id' => null,
                    'stage_id' => null,
                    'origin_stage_id' => (int) $card['origin_stage_id'],
                    'title' => $card['title'],
                    'rule_name' => $card['rule_name'],
                    'state' => '_eligible',
                    'text' => $card['text'],
                    'difficulty' => (int) $card['difficulty'],
                    'rewards' => 0,
                    'creator' => self::CREATOR,
                    'count' => 0,
                ]);
                $ids->push($deck->id);
            }
            app(TrickEventInitializer::class)->initialize($event, $ids);
        });
    }

    private function readCsv(string $filename, array $columns): array
    {
        $file = fopen(__DIR__.'/data/'.$filename, 'r');
        if ($file === false) {
            throw new RuntimeException('CSVを読み込めません: '.$filename);
        }
        try {
            $header = fgetcsv($file, 0, ',', '"', '');
            if ($header !== $columns) {
                throw new RuntimeException('CSVヘッダーが不正です: '.$filename);
            }
            $rows = [];
            while (($row = fgetcsv($file, 0, ',', '"', '')) !== false) {
                if ($row === [null]) continue;
                if (count($row) !== count($columns)) {
                    throw new RuntimeException('CSV列数が不正です: '.$filename);
                }
                $rows[] = array_combine($columns, $row);
            }
            return $rows;
        } finally {
            fclose($file);
        }
    }
}
