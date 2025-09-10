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
use Illuminate\Foundation\Http\FormRequest;
use InvalidArgumentException;

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
    // スコア比較時の条件分岐（RecordForm.jsと共通）
    public function isTime($rule, $stage): bool
    {
        $ruleArray = [11, 29, 33, 35, 43, 46, 91];
        $stageArray = [338, 341, 343, 345, 346, 347, 348, 349, 350];
        return in_array((int)$rule, $ruleArray, true) ||
            in_array((int)$stage, $stageArray, true);
    }
    // 単独記録を取得する関数
    public function getRecord(Request $request): JsonResponse
    {
        $record = Record::select(config('const.selected'))->where('unique_id', $request['id'])->first();
        $data = $record ? $record->toArray() : [];
        $data["post_rank"] = $this->getRankArray($data, false);

        if(!$data){
            $data = collect(['message' => "Record Not Found"]);
        }
        return response()->json(
            $data
        );
    }
    // ステージID・ルール・コンソールの組み合わせでトップ記録を取得する関数
    public function getTopRecord(Request $request): JsonResponse
    {
        $scoreOrder = in_array((int)$request['rule'], [11, 29, 35], true) ? 'ASC' : 'DESC';

        $record = Record::select(config('const.selected'))
            ->where('stage_id', $request['stage_id'])
            ->where('rule', $request['rule'])
            ->where('console', $request['console'] ?: 0)
            ->where('flg','<', 2)
            ->orderBy('score', $scoreOrder)
            ->orderBy('created_at', 'ASC')
            ->first();

        $data = $record ? $record->toArray() : [];
        $data["post_rank"] = 1; // トップ記録なので順位は1
        if(!$data){
            $data = collect(['message' => "Record Not Found"]);
        }
        return response()->json(
            $data
        );
    }
    // 単一記録と同じ組み合わせのデータを取得する関数
    public function getRecordHistory(Request $request): JsonResponse
    {
        $record = new Record();
        $data = $record::select(config('const.selected'))
            ->where('stage_id', $request['stage_id'])
            ->where('rule', $request['rule'])
            ->where('user_id', $request['user_id'])
            ->where('flg','<', 2)
            ->orderBy('created_at', 'DESC')
            ->get()
            ->toArray();

        $new_data = [];

        // 当時の順位を追加
        foreach($data as $record){
            $history = $this->getRankArray($record, true);
            $record["post_rank"] = $history[0];
            $record["rps"] = $history[1];
            $new_data[] = $record;
        }

        return response()->json(
            $new_data
        );
    }
    // 暫定順位を取得する関数
    public function getRank(Request $request): JsonResponse
    {
        $operator = $this->isTime($request["rule"], $request["stage"]) ? "<" : ">";

        $data = Record::select('user_id')->where('stage_id', $request['stage'])
            ->where('rule', $request['rule'])
            ->where('score', $operator, (int)$request['score'])
            ->where('flg','<', 2)
            ->get()
            ->unique('user_id')
            ->count();

        $data++;

        // jsonで返却されるため、Laravel内で値を参照する場合は$data->originalを使用する
        return response()->json(
            $data
        );
    }
    // 暫定順位を取得する関数バックエンド版：第２引数がtrueの場合は投稿時点の順位を取得、falseの場合は現在時刻
    public function getRankArray(array $request, bool $history): int|array
    {
        if (!$request) {
            return 0;
        }
        $orderBy = Func::orderByRule($request['stage_id'], $request['rule']);
        $inequality = ($orderBy[1] === 'ASC') ? '<' : '>';
        $data = Record::query();

        $data->when($history, function ($query) use ($request) {
            return $query->where('created_at', '<', $request['created_at']);
        });

        $data->select('user_id')
            ->where('stage_id', $request['stage_id'])
            ->where('rule', $request['rule'])
            ->where('flg','<', 2);

        // ヒストリーモードの場合、ここで処理をぶった斬ってクローンし、別プロセスで当時の参加者数も取得する
        if($history){
            $dataClone = clone $data;
            $countAll = $dataClone->distinct('user_id')->count('user_id');
        }

        // 順位取得の後続処理
        $count = $data->where('score', $inequality, (int)$request['score'])
            ->distinct('user_id')
            ->count('user_id');
        $count++;

        if($history){
            return [$count, $countAll];
        }
        return $count;
    }

    /**
     * Show the form for creating a new resource.
     *
     * @param FormRequest $request
     * @return JsonResponse
     */
    public function create(Request $request): JsonResponse
    {
        // 簡易バリデーション
        if((int)$request['score'] < 1 || (int)$request['rule'] < 1 || (int)$request['console'] < 1){
            return response()->json(
                ["ERROR", 500]
            );
        }
        // コメントのNGワード処理（NGの場合は問答無用で「コメントなし」とする）
        function ng_word_check($test, $array): bool
        {
            foreach ($array as $word){
                if(str_contains($test, $word)){
                    return true;
                }
            }
            return false;
        }
        if(ng_word_check($request['post_comment'], HiddenController::ngWords())){
            $comment = "コメントなし ";
        } else {
            $comment = $request['post_comment'] ?: "コメントなし";
        }

        // 受信した画像の処理
        $fileName = "";
        $img = $request->file('file');
        if($img) {
            try {
                $extension = $img->extension();
                $dots = ($extension) ? "." : "";
                $fileName = date("Ymd-His") . '-' . random_int(1000000000, 9999999999) . $dots . $extension;
                $path = $img->storeAs('img', $fileName, 'public');
                if(!$path){
                    return response()->json("画像の保存に失敗しました。");
                }
            } catch (Exception $e){
                return response()->json("error:".$e);
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
                'team' => 0, // TODO: チーム対抗戦を実装する場合はここにチームIDを入れる（Next.js APIも同様）
                'unique_id' => "311".sprintf('%06d',random_int(0, 999999)),
                'post_comment' => $comment,
                'user_ip' => $request['user_ip'],
                'user_host' => gethostbyaddr($request['user_ip']) ?: "",
                'user_agent' => $request['user_agent'],
                'img_url' => $fileName,
                'video_url' => $request['video_url'] ?: "",
                'post_memo' => "",
                'flg' => 0
            ]);
            $posts->save();

        } catch (Exception $e) {
            return response()->json($e);
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
        // ステージIDの種別判定
        $where = is_numeric($request['id'])? 'stage_id' : 'user_id';

        // 重複削除対象
        $group = is_numeric($request['id'])? 'user_id' : 'stage_id';

        // オプション引数
        $console = $request['console'] ?: 0;
        $rule    = $request['rule']    ?: 0;
        $year    = $request['year']    ?: date("Y");
        $compare = $request['compare'] ?: 'timebonus';

        // ステージ情報を取得
        $stage = Stage::where('stage_id', $request['id'])->first();

        $orderBy = Func::orderByRule($request["id"], $rule);

        // サブカテゴリが存在するシリーズの総合ランキングはサブカテゴリのルールを包括する
        if($rule === "1"){
            // 全総合（2P、TAS、無差別級を除く）
            $rule = [10, 11, 21, 22, 23, 24, 25, 29, 31, 32, 33, 35, 36, 41, 42, 43, 44, 45, 46, 47];

        } elseif($rule === "2"){
            // 通常総合
            $rule = [10, 21, 22, 31, 32, 33, 36, 41, 42, 43];

        } elseif($rule === "3"){
            // 特殊総合（期間限定を除く）
            $rule = [11, 23, 24, 25, 29, 35, 44, 45, 46, 47];

        } elseif($rule === "20"){
            // ピクミン2総合
            $rule = [20, 21, 22];

        } elseif($rule === "30"){
            // ピクミン3総合
            $rule = [30, 31, 32, 33, 36];

        } elseif($rule === "40"){
            // ピクミン4総合
            $rule = [40, 41, 42, 43];

        } elseif(!$rule && $where === "stage_id") {
            // TODO: 一部のページ読み込み時にparentが存在しないエラーを吐いている
            $rule = [Stage::where('stage_id', $request['id'])->first()?->parent];

        } elseif(!$rule && $where === "user_id") {
            // ユーザー別ページでルール未定義の場合は通常ランキング全部を対象にする
            $rule = [10, 21, 22, 31, 32, 33, 36, 41, 42, 43];

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
        $new_data = Record::select(config('const.selected'))
                ->where($where, $request['id'])
                ->where('console', $console_operation, $console)
                ->whereIn('rule', $rule)
                ->where('created_at','<', $date)
                ->where('flg','<', 2)
                ->orderBy($orderBy[0],$orderBy[1])
                ->orderBy('created_at', 'ASC')
            ->get()
            ->toArray();

        $new_data = Func::duplicates_cleaner($new_data, $group);

        if($where === "stage_id") {
            // ステージごとのセットなら順位とランクポイントをセット単位で計算する
            $new_data = Func::rank_calc("stage", $new_data, [$console, $rule, $date]);

        } else {
            // セット単位ではない場合は個別に計算する（ユーザー別、総合ランキング）
            $member_count_map = Func::memberCount($rule, [$console, $rule, $date]);
            $max = 1;
            if (!empty($member_count_map)) {
                // If associative array like [stage_id => count], take the maximum value
                $max = max($member_count_map);
            }

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
                $member_count = Func::memberCount(0, $option);
                $member = array_key_exists($value["stage_id"], $member_count) ? $member_count[$value["stage_id"]] : 1;
                $new_data[$key]["rps"] = Func::rankPoint_calc($value["stage_id"], $rank, $member, $max);
            }
        }
        // 比較値を付与
        $dataset = Func::compare_calc($new_data, $compare);

        // ユーザーページの場合は最後にステージID順にソートする
        if($where === "user_id"){
            array_multisort(array_column($dataset, 'stage_id'), SORT_ASC, $dataset);
        }

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
     * @param Request $request
     * @return JsonResponse
     * @throws Exception
     */
    public function destroy(Request $request): JsonResponse
    {
        $unique_id = $request["id"];

        // 現在時刻
        $datetime = new DateTime();
        $now_date = $datetime->format("Y-m-d H:i:s");

        // 投稿時刻を取得
        $data = Record::select('created_at')->where('unique_id', $unique_id)->first();
        if(!$data){
            return response()->json(
                ["Request Error"]
            );
        }
        $post_date = new DateTime($data["created_at"]);
        $diff_date = $datetime->diff($post_date)->format('%s');

        if($diff_date < 86400) {

            Record::where("unique_id", $unique_id)->update(
                [
                    'flg' => 2,
                    'updated_at' => $now_date
                ]);

            return response()->json(
                ["deleted"]
            );
        }
        return response()->json(
            ["24時間経過した記録は削除できません"]
        , 500);
    }
}
