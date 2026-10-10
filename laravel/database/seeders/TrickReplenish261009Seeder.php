<?php
namespace Database\Seeders;
use App\Models\{Deck, TrickEvent, TrickEventCard};
use App\Services\Tricks\{TrickClock, TrickScoreOrder, TrickStageAllocator};
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;
class TrickReplenish261009Seeder extends Seeder
{
    private const EVENT_ID = 261009;
    private const CONTENT_COLUMNS = ['origin_stage_id', 'title', 'rule_name', 'text', 'difficulty', 'creator', 'score_type'];
    public function run(): void
    {
        $csv = app(TrickProduction261009Seeder::class)->readCards();
        DB::transaction(function () use ($csv): void {
            app(TrickStageAllocator::class)->lock();
            $event = TrickEvent::where('event_id', self::EVENT_ID)->lockForUpdate()->firstOrFail();
            if ($event->initialized_at === null || $event->title !== '第19回期間限定ランキング') {
                throw new RuntimeException('初期化済み大会261009だけが補充対象です');
            }
            $originals = Deck::where('eventId', self::EVENT_ID)->whereNull('clone_source_deck_id')
                ->orderBy('id')->lockForUpdate()->get();
            if ($originals->count() !== 160) throw new RuntimeException('元カード160枚を特定できません');
            foreach ($originals as $index => $source) {
                if ($csv[$index]['card_key'] !== '261009-'.str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT)) {
                    throw new RuntimeException('CSVの元カード番号順が不正です');
                }
                foreach (self::CONTENT_COLUMNS as $column) {
                    if ((string) $source->{$column} !== (string) $csv[$index][$column]) {
                        throw new RuntimeException('元カードとCSV内容が一致しません');
                    }
                }
            }
            $originalIds = $originals->pluck('id');
            $originalCards = TrickEventCard::where('event_id', self::EVENT_ID)->whereIn('deck_id', $originalIds)
                ->lockForUpdate()->get();
            if ($originalCards->count() !== 160) throw new RuntimeException('元カードの大会内登録が不足しています');
            $copies = Deck::where('eventId', self::EVENT_ID)->whereNotNull('clone_source_deck_id')
                ->lockForUpdate()->get()->keyBy('clone_source_deck_id');
            if ($copies->isNotEmpty()) {
                if ($copies->count() !== 160) throw new RuntimeException('補充データが部分投入されています');
                foreach ($originals as $index => $source) {
                    $copy = $copies->get($source->id);
                    if ($copy === null || $copy->card_key !== '261009-'.($index + 161)
                        || $copy->score_order !== (TrickScoreOrder::ascending($source) ? 'asc' : 'desc')) {
                        throw new RuntimeException('既存補充カードの対応が不正です');
                    }
                    foreach (self::CONTENT_COLUMNS as $column) {
                        if ((string) $copy->{$column} !== (string) $source->{$column}) {
                            throw new RuntimeException('既存補充カードの内容が不正です');
                        }
                    }
                }
                if (TrickEventCard::where('event_id', self::EVENT_ID)->whereIn('deck_id', $copies->pluck('id'))->count() !== 160) {
                    throw new RuntimeException('既存補充カードの大会内登録が不足しています');
                }
                $this->command?->info('追加160枚は投入済みです（開封後の状態も維持）');
                return;
            }
            $now = app(TrickClock::class)->now($event);
            if ($event->state === 'ended' || $now->lessThan($event->start_at) || $now->greaterThanOrEqualTo($event->end_at)) {
                throw new RuntimeException('開催中の大会だけに補充できます');
            }
            $start = (int) env('TRICKS_STAGE_ID_START', 1001);
            $end = (int) env('TRICKS_STAGE_ID_END', 1999);
            $used = DB::table('stages')->whereBetween('stage_id', [$start, $end])->pluck('stage_id')
                ->merge(Deck::whereBetween('stage_id', [$start, $end])->pluck('stage_id'))->unique();
            if ($end - $start + 1 - $used->count() < 160) throw new RuntimeException('追加用の未使用ステージ番号が160枠必要です');
            foreach ($originals as $index => $source) {
                $copy = Deck::create([
                    ...$source->only(self::CONTENT_COLUMNS), 'eventId' => self::EVENT_ID, 'event_id' => null,
                    'card_key' => '261009-'.($index + 161), 'clone_source_deck_id' => $source->id,
                    'score_order' => TrickScoreOrder::ascending($source) ? 'asc' : 'desc',
                    'stage_id' => null, 'state' => '_in_event', 'rewards' => 0, 'count' => 0,
                ]);
                $copy->update(['card_id' => $copy->id]);
                TrickEventCard::create(['event_id' => self::EVENT_ID, 'deck_id' => $copy->id,
                    'state' => '_deck', 'difficulty' => $source->difficulty]);
            }
            $this->command?->info('261009-161〜320を未開封デッキとして追加しました');
        });
    }
}
