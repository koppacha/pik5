<?php

namespace App\Http\Controllers;

use App\Library\Func;
use App\Models\Record;
use Illuminate\Http\JsonResponse;

class NewRecordController extends Controller
{
    public function get(): JsonResponse
    {
        // 各コントローラーを読み込む
        $RecordController = new RecordController();
        $StageController = new StageController();
        $Func = new Func();

        // 記録をリクエスト
        $dataset = Record::select(config('const.selected'))
            ->where('stage_id', "<", 1000)
            ->where('flg','<', 2)
            ->orderBy("created_at","DESC")
            ->limit(50)
            ->get()
            ->toArray();

        // 最大参加者数を取得
        $max = $StageController->maxMember();

        // 参加者数を一括取得
        $stageIds = array_column($dataset, 'stage_id');
        $membersByStage = Record::whereIn('stage_id', $stageIds)
            ->where('flg','<',2)
            ->selectRaw('stage_id, COUNT(DISTINCT user_id) AS member')
            ->groupBy('stage_id')
            ->pluck('member','stage_id');

        // ループ内は rank と rps 計算だけ
        $out = [];
        foreach ($dataset as $row) {
            $rank = $RecordController->getRankArray($row, false);
            $member = $membersByStage[$row['stage_id']] ?? 0;
            $row['post_rank'] = $rank;
            $row['rps'] = $Func::rankPoint_calc($row['stage_id'], $rank, $member, $max);
            $out[] = $row;
        }

        return response()->json($out);
    }
}
