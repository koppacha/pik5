<?php

namespace App\Http\Controllers;

use App\Library\Func;
use App\Models\Record;
use App\Models\Total;
use DateTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class TotalController extends Controller
{

    public function __invoke(): string
    {
        // TODO: Implement __invoke() method.
        return "invoke";
    }
    public static function stage_list(Request|string $request): array
    {
        // 総合ランキングの集計対象ステージ一覧
        $stage_list = [
            1 => array_merge(range(101, 105), range(201, 230), range(231, 254), range(301, 362), range(401, 428)), // 全総合
            2 => array_merge(range(101, 105), range(201, 230), range(301, 350), range(401, 428)), // 通常総合
            3 => array_merge(range(101, 105), range(201, 230), range(231, 254), range(351, 362), range(401, 428)), // 特殊総合
            4 => range(1001, 1299), // 期間限定総合
            10 => [101, 102, 103, 104, 105],
            11 => [101, 102, 103, 104, 105], // ◆
            20 => range(201, 230),
            21 => [201, 202, 205, 206, 207, 212, 217, 218, 220, 226, 228, 229, 230],
            22 => [203, 204, 208, 209, 210, 211, 213, 214, 215, 216, 219, 221, 222, 223, 224, 225, 227],
            23 => [201, 202, 205, 206, 207, 212, 217, 218, 220, 226, 228, 229, 230],  // タマゴムシ縛り◆
            24 => [203, 204, 208, 210, 211, 213, 215, 219, 221, 222, 224, 225, 227],  // スプレー縛り◆
            25 => range(231, 244),  // 本編地下
            26 => range(201, 230),  // 2Pチャレンジ×
            27 => range(201, 230),  // TAS×
            28 => range(201, 230),  // 実機無差別×
            29 => range(245, 254),  // ソロバトル
            30 => range(301, 350),
            31 => range(301, 315), // お宝をあつめろ！
            32 => range(316, 330), // 原生生物をたおせ！
            33 => range(345, 350), // 巨大生物をたおせ！
            34 => range(301, 350),// 2Pミッション×
            35 => range(351, 362), // ソロビンゴ
            36 => range(331, 344), // サイドストーリー
            40 => range(401, 428),
            41 => range(401, 412), // ダンドリチャレンジ
            42 => range(413, 418), // ダンドリバトル
            43 => range(419, 428), // 葉っぱ仙人の挑戦状
            44 => range(401, 412), // ゲキカラチャレンジ◆
            45 => range(413, 418), // ゲキカラバトル◆
            46 => range(419, 428), // ゲキカラ仙人の挑戦状◆
            47 => range(429, 444), // 夜の探検
            91 => [901, 902, 904, 905, 906, 907, 908, 909, 910, 911, 912, 913, 914, 915, 916], // 複合・その他（903は除外）

            // TODO: 個別のイベント総合に相当する配列は将来的にデータベースに基づいて読み込むようにする

            151101 => range(1001, 1002), // スタンダード
            160306 => range(1003, 1004), // スタンダード
            160319 => range(1005, 1006), // スタンダード
            160423 => range(1007, 1008), // スタンダード
            160430 => range(1009, 1012), // スタンダード
            160806 => range(1013, 1014), // スタンダード
            161022 => range(1270, 1299), // 旧日替わり
            170101 => range(1015, 1018), // チーム対抗戦
            170211 => range(1019, 1022), // チーム対抗戦
            170325 => range(1023, 1028), // チーム対抗戦
            170429 => range(1029, 1035), // チーム対抗戦
            171013 => range(1036, 1042), // チーム対抗戦
            180101 => range(1043, 1050), // チーム対抗戦
            180901 => range(1051, 1085), // エリア踏破戦
            190209 => range(1197, 1226), // 一本勝負
            190321 => range(1227, 1256), // 一本勝負
            190802 => range(1086, 1115), // エリア踏破戦
            200723 => range(1116, 1145), // エリア踏破戦
            200918 => range(1146, 1162), // エリア踏破戦
            210829 => range(1257, 1269), // ムシ取り
            211105 => range(1163, 1184), // エリア踏破戦
            221008 => range(1185, 1196), // エリア踏破戦
            250726 => range(1300, 1312), // ムシ取り
            250905 => range(1313, 1342)  // トリックテイキング（仮）
        ];
        if(!isset($request) || !$request){
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

    public function getTotals(Request $request): array
    {
        $req = [
            "console" => (int)$request['console'] ?: 0,
            "rule" => (int)$request['rule'] ?: (int)$request['id'],
            "year" => (int)$request['year'] ?: date("Y")
        ];

        // ルールの強制置換

        // 全総合ランキング
        if ($req["rule"] === 1) {
            $rules = [10, 11, 21, 22, 23, 24, 25, 29, 31, 32, 33, 35, 36, 40, 41, 42, 43, 44, 45, 46];
        // 通常総合ランキング
        } elseif ($req["rule"] === 2) {
            $rules = [10, 20, 21, 22, 31, 32, 33, 36, 41, 42, 43];
        // 特殊総合ランキング（2Pランキング、TAS、実機無差別、その他は対象外）
        } elseif($req["rule"] === 3){
            $rules = [11, 23, 24, 25, 29, 35, 44, 45, 46, 47];
        // 期間限定ランキング（終了済みの大会のみ対象）
        } elseif($req["rule"] === 4){
            $rules = [151101, 160306, 160319, 160423, 160430, 160806, 170101, 170211, 170325, 170429, 171013, 180101, 180901, 190802, 200723, 200918, 211105, 221008];
        // ピクミン２総合
        } elseif ($req["rule"] === 20) {
            $rules = [20, 21, 22];
        // ピクミン３総合
        } elseif ($req["rule"] === 30) {
            $rules = [30, 31, 32, 33, 36];
        // ピクミン４総合
        } elseif ($req["rule"] === 40) {
            $rules = [40, 41, 42, 43];
        // それ以外
        } else {
            $rules = [$req["rule"]];
        }

        // データの格納先
        $ranking = [];

        // オプション引数を加工する
        $year = $req["year"] + 1;
        $console_operation = $req["console"] ? "=" : ">";

        // 対象年からフィルターする年月日を算出
        $datetime = new DateTime("{$year}-01-01 00:00:00");
        $date = $datetime->format("Y-m-d H:i:s");
        // 共通処理ここまで

        // 全ステージのいずれかに１つ以上投稿しているユーザーのリスト
        $users = [];

        // ルールごとにループする
        foreach($rules as $rule) {
            // 有効データのみ抽出するクエリ
            $records = Record::whereIn('stage_id', self::stage_list($rule))
                ->where('console', $console_operation, $req["console"])
                ->where('rule', $rule)
                ->where('created_at', '<', $date)
                ->where('flg', '<', 2)
                ->orderBy('score', 'DESC') // スコア順に並べた後
                ->orderBy('created_at')   // 作成日時順に並べ
                ->get()
                ->unique(function ($item) { // 重複削除
                    return $item['user_id'] . '-' . $item['stage_id'] . '-' . $item['rule'];
                })
                ->values() // インデックスをリセット
                ->toArray();

            $dataset[$rule] = collect($records)
                ->groupBy('stage_id') // ステージIDでグループ化
                ->map(function ($items) {
                    return $items->sortByDesc('score')->values()->all(); // スコア降順で並べ直し
                })
                ->toArray();

            // 順位とランクポイント計算に渡す値（Speedrun系は反転）
            if(in_array($rule, [29, 35, 47], true)){
                $mode = "reverse";
            } else {
                $mode = "stage";
            }
            foreach($dataset[$rule] as $stage => $stageRecords) {
                $ranking[$rule][$stage] = Func::rank_calc($mode, $stageRecords, [$req["console"], [$rule], $date]);
            }
        }
        // ステージごとのデータをループ（ルールごとにネスト）
        foreach ($ranking as $rule_id => $stages) {
            foreach ($stages as $stage_id => $records) {
                foreach ($records as $record) {
                    $user_id = $record['user_id'];

                    // スコア計算（ルールIDがSpeedrun系の場合の特別処理を含む）
                    $score = $rule_id === 29 || $rule_id === 35 || $rule_id === 47
                        ? max(0, 600 - $record['score'])
                        : $record['score'];

                    // 初期化
                    if (!isset($users[$user_id])) {
                        $users[$user_id] = [
                            'score' => 0,
                            'rps' => 0.0,
                            'user_id' => $user_id,
                            'ranks' => [],
                            'created_at' => null,
                        ];
                    }
                    // 合計スコアとRPSを加算
                    $users[$user_id]['score'] += $score;
                    $users[$user_id]['rps'] += $record['rps'];

                    // ランク情報を保存
                    $users[$user_id]['ranks'][] = [
                        'unique_id' => $record['unique_id'],
                        'stage' => $stage_id,
                        'rule' => $rule_id,
                        'post_rank' => $record['post_rank'],
                        'rps' => $record['rps'],
                        'score' => $record['score'] ?: 0
                    ];
                    if (
                        !isset($users[$user_id]['created_at']) ||
                        $record['created_at'] > $users[$user_id]['created_at']
                    ) {
                        $users[$user_id]['created_at'] = $record['created_at'];
                    }
                }
            }
        }

        // ranks内をstage_id（stage）昇順に並び替え
        $users = array_map(static function ($user) {
            usort($user['ranks'], static function ($a, $b) {
                return $a['stage'] <=> $b['stage'];
            });
            return $user;
        }, $users);

        // 合計スコアの降順で並び替え
        usort($users, static function ($a, $b) {
            return $b['score'] <=> $a['score'];
        });

        // 結果を出力
        return Func::rank_calc("total", $users, [$req["console"], $rules, $date]);
    }

    /**
     * Display the specified resource.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function show(Request $request): JsonResponse
    {
        $totals = $this->getTotals($request);
        return response()->json($totals);
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
