<?php

namespace App\Http\Controllers;

use App\Models\Record;
use App\Models\Total;
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
            100 => [101, 102, 103, 104, 105],
            200 => range(201, 230),
            210 => [201, 202, 205, 206, 207, 212, 217, 218, 220, 226, 228, 229, 230],
            220 => [203, 204, 208, 209, 210, 211, 213, 214, 215, 216, 219, 221, 222, 223, 224, 225, 227],
            230 => range(231,243),  // 新チャレンジ（タマゴムシ縛り）
            240 => [244, 245, 247, 248, 249, 250, 251, 252, 254, 255, 256, 257, 258, 259, 260],  // 新チャレンジその他
            250 => range(261,270),  // ソロバトル
            260 => range(271,284),  // 本編地下
            270 => range(2201,2230),// 2Pチャレンジ
            300 => range(301, 350),
            310 => range(301, 315), // お宝をあつめろ！
            320 => range(316, 330), // 原生生物をたおせ！
            330 => range(331, 344), // サイドストーリー
            340 => range(345, 350), // 巨大生物をたおせ！
            350 => range(351, 362), // ソロビンゴ
            360 => range(3301,3350),// 2Pミッション
            400 => range(401, 405),
        ];
        $model = Record::whereIn('stage_id',$stage_list[$request['id']])->get();
        $datas = $model->toArray();
        $res   = [
            // メタ情報をあらかじめ配列に投入しておく
            "stage_list" => $stage_list[$request['id']]
        ];

        // ここからランキング出力本体
        $ranking = [];

        // 対象の記録群からユーザー配列を作成し、値を初期化
        foreach($users = array_unique( array_column($datas, 'user_name') ) as $user){
            $ranking[$user]["user_name"] = $user;
            $ranking[$user]["score"] = 0;
            $ranking[$user]["rps"]   = 0;
            $ranking[$user]["count"] = 0;
            $ranking[$user]["created_at"] = "2006/09/01 00:00:00";
            $ranking[$user]["ranks"] = array();
        }
        // ユーザー配列に各種データを入れ込む
        foreach($users as $user){
            foreach($datas as $data){
                if($user !== $data["user_name"]) {
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
        // 降順に並び替え
        $score_column = array_column($ranking, "score");
        array_multisort($score_column, SORT_DESC, SORT_NUMERIC, $ranking);

        // 順位を計算して入れる
        $rank = 1;
        $count = 1;
        $before = 0;
        foreach($ranking as $key => $value){
            if($before !== $value["score"]){
                $rank = $count;
            }
            $ranking[$key]["post_rank"] = $rank;
            $before = $value["score"];
            $count++;
        }

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
     * @return Response
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
