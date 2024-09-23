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

    // 単独記録を取得する関数
    public function getRecord(Request $request): JsonResponse
    {
        $data = Record::select(config('const.selected'))->where('unique_id', $request['id'])->first()->toArray();
        $data["stage"] = $data["stage_id"];
        $data["post_rank"] = $this->getRankArray($data);

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
            $record["stage"] = $record["stage_id"];
            $record["post_rank"] = $this->getRankArray($record);
            $new_data[] = $record;
        }

        return response()->json(
            $new_data
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

        // jsonで返却されるため、Laravel内で値を参照する場合は$data->originalを使用する
        return response()->json(
            $data
        );
    }
    // 暫定順位を取得する関数バックエンド版
    public function getRankArray(array $request): int
    {
        $orderBy = Func::orderByRule($request['stage'], $request['rule']);
        $inequality = ($orderBy[1] === 'ASC') ? '<' : '>';

        $data = Record::select('user_id')->where('stage_id', $request['stage'])
            ->where('rule', $request['rule'])
            ->where('score', $inequality, (int)$request['score'])
            ->where('flg','<', 2)
            ->where('created_at','<', $request['created_at'])
            ->get()
            ->unique('user_id')
            ->count();
        $data++;

        return $data;
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
                'unique_id' => "309".sprintf('%06d',random_int(0, 999999)),
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

        if($where === "stage_id") {
            $orderBy = Func::orderByRule($request["id"], $rule);
        } else {
            $orderBy = ['score','DESC'];
        }
        // サブカテゴリが存在するシリーズの総合ランキングはサブカテゴリのルールを包括する
        if($rule === "20"){
            $rule = [20, 21, 22];

        } elseif($rule === "30"){
            $rule = [30, 31, 32, 33, 36];

        } elseif($rule === "40"){
            $rule = [40, 41, 42, 43];

        } elseif(!$rule && $where === "stage_id") {
            // TODO: 一部のページ読み込み時にparentが存在しないエラーを吐いている
            $rule = [Stage::where('stage_id', $request['id'])->first()->parent];

        } elseif(!$rule && $where === "user_id") {
            // ユーザー別ページでルール未定義の場合は通常ランキング全部を対象にする
            $rule = [10, 20, 21, 22, 30, 31, 32, 33, 36, 40, 41, 42, 43];

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
        $dataset = Record::select(config('const.selected'))
                ->where($where, $request['id'])
                ->where('console', $console_operation, $console)
                ->whereIn('rule', $rule)
                ->where('created_at','<', $date)
                ->where('flg','<', 2)
                ->orderBy($orderBy[0],$orderBy[1])
                ->orderBy('created_at')
            ->get()
            ->toArray();

        $new_data = Func::duplicates_cleaner($dataset, $group);

        if($where === "stage_id") {
            // ステージごとのセットなら順位とランクポイントをセット単位で計算する
            $new_data = Func::rank_calc("stage", $new_data, [$console, $rule, $date]);

        } else {
            // セット単位ではない場合は個別に計算する（ユーザー別、総合ランキング）
            $max = max(Func::memberCount($rule, [$console, $rule, $date]));

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
