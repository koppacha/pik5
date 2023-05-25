<?php

namespace App\Library;

use App\Models\Stage;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Log;

class Func extends Facade
{
    public static function rank_calc (array $data): array
    {
        $rank = 1;
        $count = 1;
        $before = 0;
        foreach($data as $key => $value){
            if($before !== $value["score"]){
                $rank = $count;
            }
            $data[$key]["post_rank"] = $rank;
            $before = $value["score"];
            $count++;
        }
        return $data;
    }
    public static function compare_calc (array $data, $compare = 'timebonus') : array
    {
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
            $data[$key]['compare'] = $value;
        }
        return $data;
    }
}
