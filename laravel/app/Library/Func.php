<?php

namespace App\Library;

use Illuminate\Support\Facades\Facade;

class Func extends Facade
{
    static function rank_calc (array $data) : object
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

}
