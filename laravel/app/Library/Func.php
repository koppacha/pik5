<?php

namespace App\Library;

use App\Models\Stage;
use Illuminate\Support\Facades\Facade;
use Illuminate\Database\Eloquent\Collection;

class Func extends Facade
{
    static function rank_calc (array|Collection $data) : object
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

        return (object)$data;
    }
    static function compare_calc (object $data, $compare) : object
    {
        foreach($data as $key => $record){

            // 比較値を初期化
            $value = 0;
            $stage = Stage::where('stage_id', $record['stage_id'])->first();
            if($compare === 'timebonus'){

                // ピクミン２のタイムボーナス
                if($stage['parent'] >= 20 && $stage['parent'] <= 29){
                    $value = $record['score'] - (($stage['Max_Treasure'] + $stage['Total_Pikmin']) * 10);
                }
            }
            $data[$key]['compare'] = $value;
        }
        return (object)$data;
    }
}
