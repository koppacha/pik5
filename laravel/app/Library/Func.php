<?php

namespace App\Library;

use App\Models\Record;
use App\Models\Stage;
use DateTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Log;

class Func extends Facade
{
    // 通常ランキング全ステージのうち最大参加者数を求める
    public static function max_count ($option = [0, 0, 0]): int
    {
        [$console, $rule, $date] = $option;

        if(!$date) {
            $datetime = new DateTime("2024-01-01 00:00:00");
            $date = $datetime->format("Y-m-d H:i:s");
        }
        $console_operation = $console ? "=" : ">";
        $rule_operation = $rule ? "=" : ">";

        // TODO: 一部の特殊ランキングが混じってるけど通常ランキングの参加者数を超えることはまずないので無視で
        return Record::whereIn('stage_id', range(101, 405))
            ->where('console', $console_operation, $console)
            ->where('rule', $rule_operation, $rule)
            ->where('created_at', '<', $date)
            ->where('flg', '<', 2)
            ->get()
            ->groupBy(['stage_id', 'user_id'])
            ->map(function($g){
                return $g->count();
            })->max();
    }
    // 順位とランクポイントを入力された配列内で再計算する（スコア降順であることが前提）
    public static function rank_calc (array $data,array $option): array
    {
        // 順位の初期値
        $rank = 1;
        $count = 1;
        $before = 0;

        // 対象のランキングの参加者数
        $total = count($data);

        // 通常ランキングの最大参加者数
        $max = self::max_count($option);

        foreach($data as $key => $value){
            if($before !== $value["score"]){
                $rank = $count;
            }
            $data[$key]["post_rank"] = $rank;
            $before = $value["score"];
            $count++;

            // ランクポイントを計算
            $m = (log($total) - log($max) + 10) * (0.009 * $total + 0.1);
            $r = (($max - $rank + 11) ** 2) * (-0.9 / 99 * ($rank - 1) + 1) / 6.05;
            $data[$key]["rps"] = floor($m * $r);
        }

        return $data;
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
