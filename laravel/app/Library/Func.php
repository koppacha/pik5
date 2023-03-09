<?php

namespace App\Library;

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

}
