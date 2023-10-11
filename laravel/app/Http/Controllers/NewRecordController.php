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

        // 新データベースの定義
        $new_dataset = [];

        // 最大参加者数を取得
        $max = $StageController->maxMember();

        // 記録をリクエスト
        $dataset = Record::select(config('const.selected'))->where('stage_id', "<", 1000)
            ->where('flg','<', 2)
            ->orderBy("created_at","DESC")
            ->limit(50)
            ->get()
            ->toArray();
        foreach($dataset as $data){
            $data["stage"] = $data["stage_id"];
            $data["post_rank"] = $RecordController->getRank($data)->original;

            $member = $StageController->show($data["stage_id"])->original->member;
            $data["rps"] = $Func->rankPoint_calc($data["post_rank"], $member , $max);

            $new_dataset[] = $data;
        }
        return response()->json(
            $new_dataset
        );
    }
}
