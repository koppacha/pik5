<?php

namespace App\Services\Tricks;

use App\Models\Deck;
use App\Models\TrickEvent;
use Illuminate\Support\Facades\DB;

class TrickStageAllocator
{
    private const START_ID = 1313;

    private const END_ID = 9999;

    public function ensure(TrickEvent $event, Deck $deck): int
    {
        if ($deck->stage_id !== null) {
            $this->upsertStage($deck, (int) $deck->stage_id);

            return (int) $deck->stage_id;
        }

        $start = (int) env('TRICKS_STAGE_ID_START', self::START_ID);
        $end = (int) env('TRICKS_STAGE_ID_END', self::END_ID);
        $used = DB::table('stages')->whereBetween('stage_id', [$start, $end])->pluck('stage_id');
        $used = $used->merge(Deck::query()->whereBetween('stage_id', [$start, $end])->pluck('stage_id'))
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
        $this->upsertStage($deck, $stageId);

        return $stageId;
    }

    private function upsertStage(Deck $deck, int $stageId): void
    {
        $title = (string) ($deck->title ?: 'カード'.$deck->id);
        $now = now();
        DB::table('stages')->updateOrInsert(['stage_id' => $stageId], [
            'stage_name' => $title,
            'eng_stage_name' => $title,
            'stage_sub' => '期間限定チャレンジ',
            'type' => 'stage',
            'display' => 'int',
            'series' => $deck->origin_stage_id ? (int) substr((string) $deck->origin_stage_id, 0, 1) : 0,
            'parent' => (int) env('TRICKS_STAGE_PARENT', 260704),
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
