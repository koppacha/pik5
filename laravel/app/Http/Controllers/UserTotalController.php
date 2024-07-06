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

        // 当該ユーザーの通常ランキング全記録をリクエスト
        $dataset = $record::select(config('const.selected'))
            ->where("user_id", $request['id'])
            ->where('flg','<', 2)
            ->orderBy('created_at', 'DESC')
            ->get()
            ->toArray();

        $records = Func::duplicates_cleaner($dataset, "stage_id", "rule", "console");
        $new_data["scores"] = $this->aggregateScores($records);
        $new_data["marks"] = [];

        foreach ($records as $value){
            $new_data["marks"][$value["console"]][$value["rule"]][] = $value["stage_id"];
        }
        return response()->json(
            $new_data
        );
    }

    public function aggregateScores($array): array
    {
        $output = [];

        foreach ($array as $data) {
            $console = $data["console"];
            $rule = $data["rule"];
            $score = $data["score"];

            // 各consoleごとに初期化
            if (!isset($output[$console])) {
                $output[$console] = [];
            }

            // 各ruleごとに初期化
            if (!isset($output[$console][$rule])) {
                $output[$console][$rule] = 0;
            }

            // スコアを加算
            $output[$console][$rule] += $score;

            if($rule === 21 || $rule === 22){
                if (!isset($output[$console]["20"])) {
                    $output[$console]["20"] = 0;
                }

                $output[$console]["20"] += $score;
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
