<?php

namespace App\Http\Controllers;

use App\Library\Func;
use App\Models\Record;
use App\Models\Total;
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
        // 該当ユーザーの全総合ランキングデータをリクエスト
        $req = new Request(['id' => 1, 'rule' => 1, 'console' => 0, 'year' => date('Y')]);
        $totalController = new TotalController();
        $totals = $totalController->getTotals($req);

        $records = array_filter($totals, static function ($item) use ($request) {
            return $item['user_id'] === $request['id'];
        });
        if($records) {
            // インデックスをリセットする
            $records = array_values($records)[0];

            // 各ルールごとにスコアを足し合わせる
            $records["scores"] = $this->aggregateScores($records["ranks"]);
            $records["rps"] = $this->aggregateScores($records["ranks"], "rps");

            // 投稿数をカウント
            foreach ($records["ranks"] as $value){
                if(!isset($records["marks"][$value["rule"]])){
                    $records["marks"][$value["rule"]] = 0;
                }
                $records["marks"][$value["rule"]]++;

                if($value["rule"] === 21 || $value["rule"] === 22){
                    if(!isset($records["marks"]["20"])){
                        $records["marks"]["20"] = 0;
                    }
                    $records["marks"]["20"]++;
                }
                if($value["rule"] === 31 || $value["rule"] === 32 || $value["rule"] === 33 || $value["rule"] === 36){
                    if(!isset($records["marks"]["30"])){
                        $records["marks"]["30"] = 0;
                    }
                    $records["marks"]["30"]++;
                }
                if($value["rule"] === 41 || $value["rule"] === 42 || $value["rule"] === 43){
                    if(!isset($records["marks"]["40"])){
                        $records["marks"]["40"] = 0;
                    }
                    $records["marks"]["40"]++;
                }
            }
            // 最終的に返す配列
            $result = $records;

            // 各キーの合計値を取得（あらかじめ２総合と３総合を配列から除外
            unset($records["scores"][20], $records["scores"][30], $records["scores"][40],
                  $records["rps"][20], $records["rps"][30], $records["rps"][40],
                  $records["marks"][20], $records["marks"][30], $records["marks"][40]);

            $result["totals"]["score"] = array_sum($records["scores"]);
            $result["totals"]["rps"] = array_sum($records["rps"]);
            $result["totals"]["mark"] = array_sum($records["marks"]);

            // ここまでの計算結果をデータベースへ書き込む
            $this->updateTotalsTable($request['id'], $result);
        } else {
            // 総合ランキングを取得できなかった場合
            $result = ["error" => "Totals Not Found"];
        }
        return response()->json(
            $result
        );
    }
    public function updateTotalsTable(string $userName, array $data): void
    {
        $now = now(); // 現在時刻を取得
        $scores = $data['scores'];
        $rps = $data['rps'];
        $totals = $data['totals'];

        foreach ($scores as $ruleId => $score) {
            if (!isset($rps[$ruleId])) {
                continue; // 対応するrpsがない場合はスキップ
            }
            // ルール別スコア
            DB::table('totals')->updateOrInsert(
                // 検索条件
                ['user' => $userName, 'rule' => $ruleId],

                // 更新または挿入するデータ
                [
                    'score' => $score,
                    'rps' => $rps[$ruleId],
                    'flg' => 0,
                    'updated_at' => $now,
                ]
            );
            // 合計スコア
            DB::table('totals')->updateOrInsert(
                ['user' => $userName, 'rule' => 0],
                ['score' => $totals["score"], 'rps' => $totals["rps"], 'flg' => 0,'updated_at' => $now]
            );
        }
    }
    public function getTotalsTables(Request $request): JsonResponse
    {
        // リクエストからルールIDを取得
        $ruleId = $request['id'];

        // ルールIDが一致し、flgが0のデータを取得し、rpsで降順に並び替え
        $totals = Total::where('rule', $ruleId)
            ->where('flg', 0)
            ->orderByDesc('rps')
            ->get();

        // 順位を付ける
        $rank = 1;
        $previousRps = null;
        $rankedTotals = $totals->map(function ($total, $index) use (&$rank, &$previousRps) {
            if ($previousRps !== null && $total->rps !== $previousRps) {
                $rank = $index + 1; // 同じrpsの場合は順位を変えない
            }

            // 順位を付与
            $total->rank = $rank;
            $previousRps = $total->rps;

            return $total;
        });

        // 結果をJSON形式で返す
        return response()->json($rankedTotals);
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
