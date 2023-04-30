<?php

namespace App\Http\Controllers;

use App\Library\Func;
use App\Models\Record;
use DateTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

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

    /**
     * Show the form for creating a new resource.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function create(Request $request): JsonResponse
    {
        $data = new Record;

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
        /*
         * $request の中身
         * id: ステージIDまたはユーザーID（必須）
         * rule: ルール区分（任意）
         * console: 操作方法（任意）
         * year: 集計年（任意）
        */

        // ステージIDの種別判定
        $where = is_numeric($request['id'])? 'stage_id' : 'user_id';
        $orderby = is_numeric($request['id'])? ['score','DESC'] : ['stage_id','ASC'];
        $group = !is_numeric($request['id'])? 'stage_id' : 'user_id';

        // オプション引数
        $console = $request['console'] ?: 0;
        $rule    = $request['rule']    ?: 0;
        $year    = $request['year']    ?: date("Y");
        $compare  = $request['compare']  ?: 'timebonus';

        // オプション引数を加工する
        $year = (int)$year + 1;
        $console_operation = $console? "=" : ">";

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
                ->where('rule',$rule)
                ->where('created_at','<', $date)
                ->where('flg','<', 2)
                ->orderBy($orderby[0],$orderby[1])
            ->get();

        // ランキングページの場合は同一ユーザーの重複を削除して順位を再計算
        $filter = [];
        $new_data = collect([]);

        // 重複を削除
        foreach($dataset as $key => $value){
            if(in_array($value[$group], $filter, true)){
                continue;
            }
            $filter[] = $value[$group];
            $new_data[$key] = $value;
        }

        if($where === "stage_id") {
            $new_data = Func::rank_calc($new_data);
        }
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
