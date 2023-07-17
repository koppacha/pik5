<?php

namespace App\Http\Controllers;

use App\Library\Func;
use App\Models\Record;
use DateTime;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class RecordController extends Controller
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
        $data = Record::all();
        return response()->json(
            $data
        );
    }

    // 単独記録を取得する関数
    public function getRecord(Request $request): JsonResponse
    {
        $data = Record::where('unique_id', $request['id'])->first();

        if(!$data){
            $data = collect(['message' => "Record Not Found"]);
        }

        return response()->json(
            $data
        );
    }

    // 暫定順位を取得する関数
    public function getRank(Request $request): JsonResponse
    {
        $data = Record::where('stage_id', $request['stage'])
            ->where('rule', $request['rule'])
            ->where('score', '>', (int)$request['score'])
            ->where('flg','<', 1)
            ->count();

        $data++;

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
//        $data = new Record;
//
//        $data->fill([
//            'user_name' => $request['user_name'],
//            'score' => $request['score']
//        ]);
//
//        $data->save();

        Log::debug($request);

        return response()->json([
            "message" => "created",
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
        /*
         * $request の中身
         * id: ステージIDまたはユーザーID（必須）
         * rule: ルール区分（任意）
         * console: 操作方法（任意）
         * year: 集計年（任意）
        */

        // ステージIDの種別判定
        $where = is_numeric($request['id'])? 'stage_id' : 'user_id';

        // 重複削除対象
        $group = is_numeric($request['id'])? 'user_id' : 'stage_id';

        // 順位づけのための並び変え条件
        function orderByRule($id, $rule): array
        {
            // カウントアップRTAのステージリスト
            $rta_stages = array_merge(range(245, 254), range(351, 362));

            if(is_numeric($id)){
                if($rule === "11" || in_array($id, $rta_stages, true)){
                    return ['score', 'ASC'];
                }
                return ['score', 'DESC'];
            }
            return ['score','DESC'];
        }
        $orderBy = orderByRule($request["id"], $request["rule"]);

        // オプション引数
        $console = $request['console'] ?: 0;
        $rule    = $request['rule']    ?: 0;
        $year    = $request['year']    ?: date("Y");
        $compare = $request['compare'] ?: 'timebonus';

        // サブカテゴリが存在するシリーズの総合ランキングはサブカテゴリのルールを包括する
        if($rule === "20"){
            $rule = [20, 21, 22];
        } elseif($rule === "30"){
            $rule = [30, 31, 32, 33, 36];
        } else {
            $rule = [$rule];
        }

        // オプション引数を加工する
        $year = (int)$year + 1;
        $console_operation = $console ? "=" : ">";
//        $rule_operation = $rule ? "=" : ">";

        // 対象年からフィルターする年月日を算出
        $datetime = new DateTime("{$year}-01-01 00:00:00");
        $date = $datetime->format("Y-m-d H:i:s");

        // 記録をリクエスト
        $dataset = Record::with(['user' => function($q){
                // user_idに基づいてUserテーブルからユーザー名を取得する
                $q->select('user_name','user_id');
                }])

                // 絞り込み条件
                ->where($where, $request['id'])
                ->where('console', $console_operation, $console)
                ->whereIn('rule', $rule)
                ->where('created_at','<', $date)
                ->where('flg','<', 2)
                ->orderBy($orderBy[0],$orderBy[1])
                ->orderBy('created_at')
            ->get()
            ->toArray();

        // ランキングページの場合は同一ユーザーの重複を削除して順位を再計算
        $filter = [];
        $new_data = [];

        // 重複を削除
        foreach($dataset as $key => $value){
            if(in_array($value[$group], $filter, true)){
                continue;
            }
            $filter[] = $value[$group];
            $new_data[$key] = $value;
        }

        if($where === "stage_id") {
            // ステージごとのセットなら順位とランクポイントをセット単位で計算する
            $new_data = Func::rank_calc("stage", $new_data, [$console, $rule, $date]);
        } else {
            // セット単位ではない場合は個別に計算する
            foreach($new_data as $key => $value){

                $orderBy = orderByRule($value["stage_id"], $value["rule"]);

                // 絞り込み条件を再定義
                $score_operation = ($orderBy[1] === "ASC") ? "<" : ">";

                $temp = Record::selectRaw('COUNT(DISTINCT user_id) as user_rank')
                    ->where('stage_id', $value["stage_id"])
                    ->where('console', $console_operation, $console)
                    ->whereIn('rule', $rule)
                    ->where('created_at','<', $date)
                    ->where('flg','<', 2)
                    ->where('score', $score_operation, $value["score"])
                    ->first();

                $rank = $temp->user_rank + 1;
                $new_data[$key]["post_rank"] = $rank;
                $option = [$console, $rule, $date];
                $member_count = Func::memberCount($option);
                $new_data[$key]["rps"] = Func::rankPoint_calc($rank, $member_count[$value["stage_id"]], $option);
            }
        }
        // 比較値を付与
        $dataset = Func::compare_calc($new_data, $compare);

        return response()->json(
            $dataset
        );
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param Record $record
     * @return Response
     */
    public function edit(Record $record)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param Request $request
     * @param Record $product
     * @return Response
     */
    public function update(Request $request, Record $product)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param Record $record
     * @return Response
     */
    public function destroy(Record $record)
    {
        //
    }
}
