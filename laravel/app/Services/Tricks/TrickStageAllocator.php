<?php

namespace App\Services\Tricks;

use App\Models\Deck;
use App\Models\TrickEvent;
use Illuminate\Support\Facades\DB;

class TrickStageAllocator
{
    private const START_ID = 1001;

    private const END_ID = 1999;

    public function ensure(TrickEvent $event, Deck $deck): int
    {
        return DB::transaction(function () use ($event, $deck): int {
            $this->lock();
            $deck->setRawAttributes(Deck::query()->whereKey($deck->id)->lockForUpdate()->firstOrFail()->getAttributes(), true);
            if ($deck->stage_id !== null) {
                $this->upsertStage($event, $deck, (int) $deck->stage_id);

                return (int) $deck->stage_id;
            }

            $start = (int) env('TRICKS_STAGE_ID_START', self::START_ID);
            $end = (int) env('TRICKS_STAGE_ID_END', self::END_ID);
            $used = DB::table('stages')->whereBetween('stage_id', [$start, $end])->lockForUpdate()->pluck('stage_id');
            $used = $used->merge(Deck::query()->whereBetween('stage_id', [$start, $end])->lockForUpdate()->pluck('stage_id'))
                ->map(static fn ($id) => (int) $id)
                ->flip();
            $stageId = null;
            for ($candidate = $start; $candidate <= $end; $candidate++) {
                if (! $used->has($candidate)) {
                    $stageId = $candidate;
                    break;
                }
            }
            if ($stageId === null) {
                abort(response()->json(['message' => '利用可能なイベント用ステージ番号がありません'], 409));
            }

            $deck->stage_id = $stageId;
            $deck->save();
            $this->upsertStage($event, $deck, $stageId);

            return $stageId;
        });
    }

    public function lock(): void
    {
        // Independent of card/deck locks; always acquire before an event mutation.
        $lock = DB::table('trick_stage_allocation_locks')->where('id', 1)->lockForUpdate()->first();
        if ($lock === null) {
            throw new \RuntimeException('Stage allocation lock migration is required');
        }
    }

    public function ensureCategory(TrickEvent $event): void
    {
        $existing = DB::table('events')->where('stage', $event->event_id)->first();
        $values = ['name' => $event->title, 'eng' => $event->title,
            'start' => $event->start_at, 'end' => $event->end_at, 'updated_at' => now()];
        if ($existing !== null) {
            DB::table('events')->where('id', $existing->id)->update($values);
            return;
        }
        DB::table('events')->insert([...$values, 'stage' => $event->event_id,
            'host' => '', 'support' => '', 'type' => 'limited', 'rule' => 'tricks',
            'first' => 0, 'count' => 0, 'team1' => 0, 'team2' => 0, 'team3' => 0, 'team4' => 0,
            'winner' => '', 'mvp' => '', 'idea' => '', 'created_at' => now()]);
    }

    private function upsertStage(TrickEvent $event, Deck $deck, int $stageId): void
    {
        $this->ensureCategory($event);
        $title = (string) ($deck->title ?: 'カード'.$deck->id);
        $now = now();
        DB::table('stages')->updateOrInsert(['stage_id' => $stageId], [
            'stage_name' => $title,
            'eng_stage_name' => $title,
            'stage_sub' => '期間限定チャレンジ',
            'type' => 'stage',
            'display' => $deck->score_type === 'time' ? 'time' : 'int',
            'series' => $deck->origin_stage_id ? (int) substr((string) $deck->origin_stage_id, 0, 1) : 0,
            'parent' => (int) $event->event_id,
            'time' => 0,
            'treasure' => 0,
            'pikmin' => 0,
            'border1' => 0,
            'border2' => 0,
            'border3' => 0,
            'border4' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}
