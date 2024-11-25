<?php

namespace App\Http\Controllers;

use App\Library\Func;
use App\Models\Record;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class UserTotalController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        //
    }
    /**
     * Display the specified resource.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function show(Request $request): JsonResponse
    {
        // モデルを定義
        $record = new Record();

        // 計算対象とするルール
        $rules = [10, 11, 21, 22, 23, 24, 25, 29, 31, 32, 33, 35, 36, 40, 41, 42, 43, 44, 45, 46];

        // 当該ユーザーの通常ランキング全記録をリクエスト
        $dataset = $record::select(config('const.selected'))
            ->where("user_id", $request['id'])
            ->where('flg','<', 2)
            ->whereIn('rule', $rules)
            ->orderBy('score', 'DESC')
            ->get()
            ->toArray();

        // 操作方法・ルール・ステージすべて同じ記録は最新のみ残して削除する
        $tmp = [];
        $records = [];
        $sp_stages = [23, 24, 44, 45, 46];
        $RecordController = new RecordController();
        $Func = new Func();
        // 通常＋独立した特殊ランキングの参加者数
        $member = $Func::memberCount();

        // 通常ランキングにもステージがあるルール違いの参加者数
        $spMember = $Func::memberCount($sp_stages);

        $max = max($member);

        foreach($dataset as $record) {
            $concatName = implode("_", [$record["stage_id"], $record["rule"]]);
            if(!in_array($concatName, $tmp, true)) {
                // 暫定順位とランクポイントを取得
                $record["post_rank"] = $RecordController->getRankArray($record, false);

                if(isset($member[$record["stage_id"]])) {
                    $count = in_array($record["rule"], $sp_stages, true) ? $spMember[$record["stage_id"]] : $member[$record["stage_id"]];
                    $record["rps"] = $Func::rankPoint_calc($record["stage_id"], $record["post_rank"], $count, $max);
                } else {
                    $record["rps"] = 0;
                }
                // 後続処理の対象を配列へ代入
                $tmp[] = $concatName;
                $records[] = $record;
            }
        }
        // 各ルールごとにスコアを足し合わせる
        $new_data["scores"] = $this->aggregateScores($records);
        $new_data["rps"] = $this->aggregateScores($records, "rps");

        // 投稿数をカウント
        $new_data["marks"] = [];
        foreach ($records as $value){
            if(!isset($new_data["marks"][$value["rule"]])){
                $new_data["marks"][$value["rule"]] = 0;
            }
            $new_data["marks"][$value["rule"]]++;

            if($value["rule"] === 21 || $value["rule"] === 22){
                if(!isset($new_data["marks"]["20"])){
                    $new_data["marks"]["20"] = 0;
                }
                $new_data["marks"]["20"]++;
            }
            if($value["rule"] === 31 || $value["rule"] === 32 || $value["rule"] === 33 || $value["rule"] === 36){
                if(!isset($new_data["marks"]["30"])){
                    $new_data["marks"]["30"] = 0;
                }
                $new_data["marks"]["30"]++;
            }
            if($value["rule"] === 41 || $value["rule"] === 42 || $value["rule"] === 43){
                if(!isset($new_data["marks"]["40"])){
                    $new_data["marks"]["40"] = 0;
                }
                $new_data["marks"]["40"]++;
            }
        }

        // 各キーの合計値を取得（あらかじめ２総合と３総合を配列から除外
        unset($new_data["scores"][20], $new_data["scores"][30], $new_data["scores"][40],
              $new_data["rps"][20], $new_data["rps"][30], $new_data["rps"][40],
              $new_data["marks"][20], $new_data["marks"][30], $new_data["marks"][40]);
        $new_data["totals"]["score"] = array_sum($new_data["scores"]);
        $new_data["totals"]["rps"] = array_sum($new_data["rps"]);
        $new_data["totals"]["mark"] = array_sum($new_data["marks"]);

        return response()->json(
            $new_data
        );
    }

    public function aggregateScores($array, $mode = "score"): array
    {
        $output = [];

        foreach ($array as $data) {
            $rule = $data["rule"];
            $score = ($mode === "score") ? $data["score"] : $data["rps"];

            // 各ruleごとに初期化
            if (!isset($output[$rule])) {
                $output[$rule] = 0;
            }

            // スコアを加算
            $output[$rule] += $score;

            if($rule === 21 || $rule === 22){
                if (!isset($output["20"])) {
                    $output["20"] = 0;
                }
                $output["20"] += $score;
            }
            if($rule === 31 || $rule === 32 || $rule === 33 || $rule === 36){
                if(!isset($output["30"])){
                    $output["30"] = 0;
                }
                $output["30"] += $score;
            }
            if($rule === 41 || $rule === 42 || $rule === 43){
                if(!isset($output["40"])){
                    $output["40"] = 0;
                }
                $output["40"] += $score;
            }
        }
        return $output;
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        //
    }
}
