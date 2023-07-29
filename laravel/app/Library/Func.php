<?php

namespace App\Library;

use App\Models\Record;
use App\Models\Stage;
use DateTime;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Log;

class Func extends Facade
{
    // 順位づけのための並び変え条件
    public static function orderByRule($id, $rule): array
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
    // 通常ランキング全ステージのうち最大参加者数を求める
    public static function memberCount ($option = [0, 0, 0]): array
    {
        [$console, ,$date] = $option;

        // 期間限定ランキングを設立するまでは全部通常ランキングとして処理する
        $rule = [10, 21, 22, 30, 31, 32, 33, 36];

        if(!$date) {
            $datetime = new DateTime("2024-01-01 00:00:00");
            $date = $datetime->format("Y-m-d H:i:s");
        }
        $console_operation = $console ? "=" : ">";
//        $rule_operation = ">";

        try {
            // TODO: 一部の特殊ランキングが混じってるけど通常ランキングの参加者数を超えることはまずないので一旦無視で
            $Model = Cache::remember('memCount', 3600, static function() use ($console_operation, $console, $rule, $date) {
                return Record::whereIn('stage_id', range(101, 405))
                    ->where('console', $console_operation, $console)
                    ->whereIn('rule', $rule)
                    ->where('created_at', '<', $date)
                    ->where('flg', '<', 2)
                    ->get()
                    ->groupBy(['stage_id', 'user_id'])
                    ->map(function ($g) {
                        return $g->count();
                    });
                });
        } catch (Exception $e){
            Log::debug("Error", (array)$e->getMessage());
        }
        return $Model->toArray();
    }
    // 順位とランクポイントを入力された配列内で再計算する（スコア降順であることが前提）
    public static function rank_calc (string $mode, array $data, array $option): array
    {
        // 順位の初期値
        $rank = 1;
        $count = 1;
        $before = 0;

        // 対象のランキングの参加者数
        $member = count($data);

        // 最大の参加者数データを取得（取得に失敗した場合は当該ランキングの参加者数を最大値とする）
        if($memberCount = self::memberCount($option)) {
            $max = max($memberCount);
        } else {
            $max = $member;
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
                $data[$key]["rps"] = self::rankPoint_calc($rank, $member, $max);
            }
        }
        return $data;
    }
    public static function rankPoint_calc($rank, $member, $max): float
    {
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

            $data[$key]['compare'] = $value;
        }
        return $data;
    }
}
