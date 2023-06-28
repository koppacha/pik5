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
        // 総合ランキングの集計対象ステージ一覧
        $stage_list = [
            7   => range(101, 405),  // 通常総合
            8   => range(1001, 9999),// 特殊総合
            9   => range(101, 9999), // 全総合
            10 => [101, 102, 103, 104, 105],
            20 => range(201, 230),
            21 => [201, 202, 205, 206, 207, 212, 217, 218, 220, 226, 228, 229, 230],
            22 => [203, 204, 208, 209, 210, 211, 213, 214, 215, 216, 219, 221, 222, 223, 224, 225, 227],
            23 => [201, 202, 205, 206, 207, 212, 217, 218, 220, 226, 228, 229, 230],  // タマゴムシ縛り
            24 => [203, 204, 208, 209, 210, 211, 213, 214, 215, 216, 219, 221, 222, 223, 224, 225, 227],  // スプレー縛り
            25 => range(231,244),  // 本編地下
            26 => range(201,230),  // 2Pチャレンジ
            27 => range(201,230),  // TAS
            28 => range(201,230),  // 実機無差別
            29 => range(245,254),  // ソロバトル
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
        // オプション引数
        // TODO: Extendsで共通処理化したい
        $console = $request['console'] ?: 0;
        $rule    = $request['rule']    ?: 0;
        $year    = $request['year']    ?: date("Y");

        // オプション引数を加工する
        $year = (int)$year + 1;
        $console_operation = $console ? "=" : ">";
        $rule_operation = $rule ? "=" : ">";

        // 対象年からフィルターする年月日を算出
        $datetime = new DateTime("{$year}-01-01 00:00:00");
        $date = $datetime->format("Y-m-d H:i:s");
        // 共通処理ここまで

        $model = Record::with(['user' => function($q){
            $q->select('user_name','user_id');
         }])->whereIn('stage_id',$stage_list[$request['id']])
            ->where('console', $console_operation, $console)
            ->where('rule',$rule_operation ,$rule)
            ->where('created_at','<', $date)
            ->groupBy('user_id', 'stage_id')
            ->selectRaw('MAX(score) as score, post_id, user_id, stage_id, rule, console, unique_id, post_rank, rps, hash, post_comment, img_url, video_url, created_at')
            ->orderBy('score','DESC')
            ->get();
        $dataset = $model->toArray();
        $res   = [
            // メタ情報をあらかじめ配列に投入しておく
            "stage_list" => $stage_list[$request['id']]
        ];

        // ここからランキング出力本体
        $ranking = [];

        // 名前取得インスタンスを初期化
        $getUser = new UserNameController();

        // 対象の記録群からユーザー配列を作成し、値を初期化
        foreach($users = array_unique( array_column($dataset, 'user_id') ) as $user){
            $ranking[$user]["user"]["user_id"] = $user;
            $ranking[$user]["user"]["user_name"] = $getUser->getName($user)['user_name'];
            $ranking[$user]["score"] = 0;
            $ranking[$user]["rps"]   = 0;
            $ranking[$user]["count"] = 0;
            $ranking[$user]["created_at"] = "2006/09/01 00:00:00";
            $ranking[$user]["ranks"] = array();
        }
        // ユーザー配列に各種データを入れ込む
        foreach($users as $user){
            foreach($dataset as $data){
                if($user !== $data["user_id"]) {
                    continue;
                }
                // 最終更新日を取得
                if($ranking[$user]["created_at"] < $data["created_at"]){
                    $ranking[$user]["created_at"] = $data["created_at"];
                }
                $ranking[$user]["score"] += $data["score"];
                $ranking[$user]["rps"]   += $data["rps"];
                $ranking[$user]["count"] ++;
                $ranking[$user]["ranks"][] = $data["post_rank"];
            }
        }
        // 集計対象に基づいて降順に並び替え
        $target = ($request['id'] < 10) ? "rps" : "score";
        $target_column = array_column($ranking, $target);
        array_multisort($target_column, SORT_DESC, SORT_NUMERIC, $ranking);

        // 順位を再計算
        $ranking = Func::rank_calc($ranking);

        // 出力用配列に入れる
        $res["data"] = $ranking;

        return response()->json(
            $res
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
