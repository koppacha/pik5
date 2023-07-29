<?php

namespace App\Http\Controllers;

use App\Library\Func;
use App\Models\Keyword;
use App\Models\Record;
use App\Models\Stage;
use DateTime;
use Exception;
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
        $data = Record::select('user_id')->where('stage_id', $request['stage'])
            ->where('rule', $request['rule'])
            ->where('score', '>', (int)$request['score'])
            ->where('flg','<', 2)
            ->get()
            ->unique('user_id')
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
     * @throws Exception
     */
    public function create(Request $request): JsonResponse
    {
        // 簡易バリデーション
        if((int)$request['score'] < 1 || (int)$request['rule'] < 1 || (int)$request['console'] < 1){
            return response()->json(
                ["ERROR", 500]
            );
        }
        // カウントダウン系の場合は経過時間に変換する

        // 受信した画像の処理
        $fileName = "";
        $img = $request->file('file');
        if($img) {
            try {
                $extension = $img->getClientOriginalExtension();
                $fileName = date("Ymd-His") . '-' . random_int(1000000000, 9999999999) . '.' . $extension;
                $img->storeAs('public/img', $fileName);
            } catch (Exception $e){
                Log::debug($e);
                return response()->json(["ERROR:$e", 500]);
            }
        }
        // 画像以外の処理
        try {
            $posts = new Record();
            $posts->fill([
                'user_id' => $request['user_id'],
                'score' => $request['score'],
                'stage_id' => $request['stage_id'],
                'rule' => $request['rule'],
                'console' => $request['console'] ?: 0,
                'region' => 0,
                'unique_id' => "301".sprintf('%06d',random_int(0, 999999)),
                'post_comment' => $request['post_comment'] ?: "コメントなし",
                'user_ip' => $request->ip(),
                'user_host' => $request->host(),
                'user_agent' => $request->header('User-Agent'),
                'img_url' => $fileName,
                'video_url' => $request['video_url'] ?: "",
                'post_memo' => "",
                'flg' => 0
            ]);
            $posts->save();

        } catch (Exception $e) {
            Log::debug($e);
            return response()->json(["ERROR:$e", 500]);
        }
        return response()->json(
            ["OK", 200]
        );
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
        // パフォーマンス計測
        $startTime = microtime(true);

        // ステージIDの種別判定
        $where = is_numeric($request['id'])? 'stage_id' : 'user_id';

        // 重複削除対象
        $group = is_numeric($request['id'])? 'user_id' : 'stage_id';

        $orderBy = Func::orderByRule($request["id"], $request["rule"]);

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

        } elseif(!$rule && $where === "stage_id") {
            $rule = [Stage::where('stage_id', $request['id'])->first()->parent];

        } elseif(!$rule && $where === "user_id") {
            // ユーザー別ページでルール未定義の場合は通常ランキング全部を対象にする
            $rule = [10, 20, 21, 22, 30, 31, 32, 33, 36, 40];

        } else {
            // 上記すべてに当てはまらない場合
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
        $dataset = Record::where($where, $request['id'])
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

            // セット単位ではない場合は個別に計算する（ユーザー別、総合ランキング）
            $max = max(Func::memberCount([$console, $rule, $date]));

            foreach($new_data as $key => $value){

                $orderBy = Func::orderByRule($value["stage_id"], $value["rule"]);

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
                $new_data[$key]["rps"] = Func::rankPoint_calc($rank, $member_count[$value["stage_id"]], $max);
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
