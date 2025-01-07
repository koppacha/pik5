<?php

namespace App\Library;

use App\Http\Controllers\TotalController;
use App\Models\Record;
use App\Models\Stage;
use DateTime;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Log;
use Predis\Command\Argument\Server\To;
use Random\RandomException;

class Func extends Facade
{
    // 順位づけのための並び変え条件
    public static function orderByRule($id, $rule): array
    {
        // カウントアップRTAのステージリスト
        $rta_stages = array_merge(range(245, 254), range(351, 362), range(901, 915));

        if(is_numeric($id)){
            if(in_array((int)$id, $rta_stages, true)){
                return ['score', 'ASC'];
            }
            return ['score', 'DESC'];
        }
        return ['score','DESC'];
    }
    // 対象ステージ群のうち最大参加者数を求める
    public static function memberCount ($total = 0, $option = [0, 0, 2024]): array
    {
        [$console, , $year] = $option;

        // 対象年からフィルターする年月日を算出
        $year = (int)$year + 1;
        $datetime = new DateTime("{$year}-01-01 00:00:00");
        $date = $datetime->format("Y-m-d H:i:s");

        if(is_array($total)){
            // あらかじめ配列が指定されている場合はそれを流用する
            $rule = $total;
            $stages = TotalController::stage_list("2");
            $ttl = 1800;
        } elseif($total > 100000) {
            // 期間限定などで総合IDが指定されている場合はそれだけを指定する
            $rule = [$total];
            $stages = TotalController::stage_list((string)$total);
            $ttl = 1;
        } else {
            // 総合IDが指定されていない場合は通常総合に等しい対象ルールとステージ
            $rule = [10, 21, 22, 30, 31, 32, 33, 36, 40, 41, 42, 43];
            $stages = TotalController::stage_list("2");
            $ttl = 1800; // 計算結果は１日保持する
            $total = 0;
        }

        $console_operation = $console ? "=" : ">";
        $memory_string = is_array($total) ? implode("_", $total) : $total;

        try {
            $Model = Cache::remember("memCount_{$memory_string}", $ttl, static function() use ($console_operation, $stages, $console, $rule, $date) {
                return Record::whereIn('stage_id', $stages)
                    ->where('console', $console_operation, $console)
                    ->whereIn('rule', $rule)
                    ->where('created_at', '<', $date)
                    ->where('flg', '<', 2)
                    ->get()
                    ->groupBy(['stage_id', 'user_id'])
                    ->map(function($g){
                        return $g->count();
                    });
                });
        } catch (Exception $e){
            Log::debug("Error", [$e->getMessage()]);
            return [999];
        }
        return $Model->toArray();
    }
    // 順位とランクポイントを入力された配列内で再計算する（スコア降順であることが前提）
    public static function rank_calc (string $mode, array $data, array $option): array
    {
        // オプションから親番号を取り出せたら、それを投稿者数集計対象にする
        [, $rule, ] = $option;
        $totals = ($rule[0] > 10000) ? $rule[0] : 0;

        // 順位の初期値
        $rank = 1;
        $count = 1;
        $before = 0;

        // 対象のランキングの参加者数
        $member = count($data);

        // 最大の参加者数データを取得（取得に失敗した場合は当該ランキングの参加者数を最大値とする）
        $max = ($memberCount = self::memberCount($totals, $option)) ? max($memberCount) : $member;

        if($mode === "reverse") {
            $data = array_reverse($data);
        }
        foreach($data as $key => $value){
            if($mode !== "user") {
                // 順位を一括計算
                if ($before !== $value["score"]) {
                    $rank = $count;
                }
                $data[$key]["post_rank"] = $rank;
                $before = $value["score"];
                $count++;
            }
            if($mode !== "total") {
                $data[$key]["rps"] = self::rankPoint_calc($value["stage_id"], $rank, $member, $max);
            }
        }
        return $data;
    }

    /**
     * @throws RandomException
     */
    public function simulate_rank_point_calc($num_stages = 210, $max = 86): JsonResponse
    {
        $total_points = 0;

        for ($i = 0; $i < $num_stages; $i++) {
            // ランダムな$memberを1〜86の間で生成
            $member = random_int(1, $max);
            // $memberの半分の順位を計算（小数点切り上げ）
            $rank = 3;

            // ランクポイント計算
            $total_points += self::rankPoint_calc(0, $rank, $member, $max);
        }
        return response()->json(
            $total_points
        );
    }
    public static function rankPoint_calc($stage, $rank, $member, $max): float
    {
        // 期間限定ランキングのランクポイント計算式
        if($stage > 1000) {
            return $max - $rank + 1;
        }
        // 期間限定以外のランクポイント計算式
        $m = (10 - log($max / $member)) * ((0.9 * ($member / $max)) + 0.1);
        $r = ($max / $rank ** 1.12) * ($rank ** (0.9 * ($max - $rank + 1) ** 2 / $max ** 2 + 0.1) / $max * 10);

        return floor($m * $r * 200);
    }
    public static function compare_calc (array $data, $compare = 'timebonus') : array
    {
        // ピクミン3のDLC第２弾全部とDLC第３弾のうちBEは１秒当たり10点（これ以外は１秒当たり30点）
        $lowBonusStages = [321, 322, 323, 324, 325, 326, 327, 328, 329, 330];

        // ピクミン3のDBとピクミン3DXサイドストーリーのうち一部ステージは比較値計算対象外
        $countDownStages = [338, 341, 343, 345, 346, 347, 348, 349, 350];

        foreach($data as $key => $record){

            // 比較値を初期化
            $value = 0;
            $stage = Stage::where('stage_id', $record['stage_id'])->first();
            if(!$stage){
                continue;
            }
            // ピクミン２のタイムボーナス
            if(($compare === 'timebonus') && $stage['parent'] >= 20 && $stage['parent'] <= 29) {
                $value = $record['score'] - (($stage['treasure'] + $stage['pikmin']) * 10);
            }
            // ピクミン３のタイムボーナス
            elseif(($compare === 'timebonus') && $stage['parent'] >= 31 && $stage['parent'] <= 39) {
                // 対象外を除外
                if (in_array($record['stage_id'], $countDownStages, true)) {
                    continue;
                }
                $bonusBase = (in_array($record['stage_id'], $lowBonusStages, true)) ? 10 : 30;
                $value = round(($record['score'] - $stage['treasure']) / $bonusBase);
            }
            // ピクミン４のタイムボーナス
            elseif(($compare === 'timebonus') && $stage['parent'] === 41) {
                $value = round($record['score'] - $stage['treasure']);
            }

            $data[$key]['compare'] = $value;
        }
        return $data;
    }
    public static function duplicates_cleaner($dataset, ...$targets): array
    {
        $filter = [];
        $new_data = [];

        foreach ($dataset as $key => $value) {
            $concat = implode('_', array_map(static function ($target) use ($value) {
                return $value[$target];
            }, $targets));

            if (in_array($concat, $filter, true)) {
                continue;
            }

            $filter[] = $concat;
            $new_data[$key] = $value;
        }

        return $new_data;
    }
}
