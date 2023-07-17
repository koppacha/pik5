<?php

namespace App\Http\Controllers;

use App\Library\Func;
use App\Models\Record;
use App\Models\Total;
use DateTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class TotalController extends Controller
{

    public function __invoke(): string
    {
        // TODO: Implement __invoke() method.
        return "invoke";
    }
    public function stage_list(Request|string $request): array
    {
        // 総合ランキングの集計対象ステージ一覧
        $stage_list = [
            7 => range(101, 405),  // 通常総合
            8 => range(1001, 9999),// 特殊総合
            9 => range(101, 9999), // 全総合
            10 => [101, 102, 103, 104, 105],
            20 => range(201, 230),
            21 => [201, 202, 205, 206, 207, 212, 217, 218, 220, 226, 228, 229, 230],
            22 => [203, 204, 208, 209, 210, 211, 213, 214, 215, 216, 219, 221, 222, 223, 224, 225, 227],
            23 => [201, 202, 205, 206, 207, 212, 217, 218, 220, 226, 228, 229, 230],  // タマゴムシ縛り
            24 => [203, 204, 208, 209, 210, 211, 213, 214, 215, 216, 219, 221, 222, 223, 224, 225, 227],  // スプレー縛り
            25 => range(231, 244),  // 本編地下
            26 => range(201, 230),  // 2Pチャレンジ
            27 => range(201, 230),  // TAS
            28 => range(201, 230),  // 実機無差別
            29 => range(245, 254),  // ソロバトル
            30 => range(301, 350),
            31 => range(301, 315), // お宝をあつめろ！
            32 => range(316, 330), // 原生生物をたおせ！
            33 => range(345, 350), // 巨大生物をたおせ！
            34 => range(301, 350),// 2Pミッション
            35 => range(351, 362), // ソロビンゴ
            36 => range(331, 344), // サイドストーリー
            40 => range(401, 405),
            91 => range(1001, 1030), // 旧日替わりチャレンジ
            92 => range(1031, 1103), // 旧参加者企画
            93 => range(1104, 1105), // 本編クリアタイム
            94 => range(1106, 1109), // チャレンジモード全クリアRTA
            95 => 1110, // 本編カスタムRTA
            81 => range(2001, 9999) // 期間限定ランキング（スタンダード、チーム対抗戦）
        ];
        if(!isset($request)){
            return [];
        }
        return $stage_list[$request];
    }
    /**
     * Display a listing of the resource.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $data = Total::all();
        return response()->json(
            $data
        );
    }

    /**
     * Show the form for creating a new resource.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function create(Request $request): JsonResponse
    {
        $data = new Total;

        $data->fill([
            'user_name' => $request['user_name'],
            'score' => $request['score']
        ]);

        $data->save();

        return response()->json([
            "message" => "created",
            "data" => $data
        ], 201);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param Request $request
     * @return void
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

        // オプション引数
        // TODO: Extendsで共通処理化したい
        $console = $request['console'] ?: 0;
        $rule    = $request['rule']    ?: $request['id'];
        $year    = $request['year']    ?: date("Y");

        // サブカテゴリが存在するシリーズの総合ランキングはサブカテゴリのルールを包括する
        if($rule === "20"){
            $rule = [20, 21, 22];
        } elseif($rule === "30"){
            $rule = [30, 31, 32, 33, 36];
        } else {
            $rule = [$rule];
        }

        // データの格納先
        $ranking = [];

        // オプション引数を加工する
        $year = (int)$year + 1;
        $console_operation = $console ? "=" : ">";
//        $rule_operation = $rule ? "=" : ">";

        // 対象年からフィルターする年月日を算出
        $datetime = new DateTime("{$year}-01-01 00:00:00");
        $date = $datetime->format("Y-m-d H:i:s");
        // 共通処理ここまで

        // 全ステージのいずれかに１つ以上投稿しているユーザーのリスト
        $users = [];

        // 対象ステージの数だけループ処理
        foreach($this->stage_list($request['id']) as $stage) {

            // 各ループごとに初期化する値
            $temp = [];

            // 有効データのみ抽出するクエリ
            $testModel[(int)$stage] = Record::where('stage_id', $stage)
                ->where('console', $console_operation, $console)
                ->whereIn('rule', $rule)
                ->where('created_at', '<', $date)
                ->where('flg', '<', 2)
                ->orderBy('score','DESC')
                ->orderBy('created_at')
                ->get()
                ->toArray();

            // ステージごとにユーザーごとのフィルタ条件別の自己ベストを抽出してステージごとに順位・ランクポイントを計算
            $filter = [];
            foreach($testModel[$stage] as $value){
                if(in_array($value['user_id'], $filter, true)){
                    continue;
                }
                $filter[] = $value['user_id'];
                $users[] = $value['user_id'];
                $temp[$value['user_id']] = $value;
            }

            // 順位とランクポイント計算に渡す値
            $ranking[$stage] = Func::rank_calc("total", $temp, [$console, $rule, $date]);
        }

        // 名前取得インスタンスを初期化
        $getUser = new UserNameController();

        $totals = [];
        // 対象の記録群からユーザー配列を作成し、値を初期化
        foreach($users = array_unique($users) as $user){
            $totals[$user]["user"]["user_id"] = $user;
            $totals[$user]["user"]["user_name"] = $getUser::getName($user)['user_name'];
            $totals[$user]["score"] = 0;
            $totals[$user]["rps"]   = 0;
            $totals[$user]["count"] = 0;
            $totals[$user]["created_at"] = "2006/09/01 00:00:00";
            $totals[$user]["ranks"] = array();
        }
        // 各ステージからユーザー情報を抽出する
        foreach($users as $user){
            foreach($ranking as $stage){
                $totals[$user]["score"] += $stage[$user]["score"] ?? 0;
                $totals[$user]["rps"] += $stage[$user]["rps"] ?? 0;
                $totals[$user]["ranks"][] = $stage[$user]["post_rank"] ?? null;
                if($totals[$user]["created_at"] < ($stage[$user]["created_at"] ?? 0)){
                    $totals[$user]["created_at"] = $stage[$user]["created_at"];
                }
            }
        }
        // 集計対象に基づいて降順に並び替え
        $target = ($request['id'] < 10) ? "rps" : "score";
        $target_column = array_column($totals, $target);
        array_multisort($target_column, SORT_DESC, SORT_NUMERIC, $totals);

        // 順位を再計算
        $totals = Func::rank_calc("total", $totals, [$console, $rule, $date]);

        return response()->json(
            $totals
        );
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param Total $Total
     * @return void
     */
    public function edit(Total $Total)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param Request $request
     * @param Total $product
     * @return Response
     */
    public function update(Request $request, Total $product)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param Total $Total
     * @return Response
     */
    public function destroy(Total $Total)
    {
        //
    }
}
