<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class StageSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run(): void
    {
        $params = [
            [
                // こてしらべの洞窟
                'stage_id' => 201,
                'parent' => 21,
                'Time' => 200,
                'Max_Treasure' => 3442,
                'Total_Pikmin' => 50,
                'border1' => 35125,
                'border2' => 35200,
                'border3' => 0,
                'border4' => 0,
            ],
            [
                // 新参者の試練場
                'stage_id' => 202,
                'parent' => 21,
                'Time' => 340,
                'Max_Treasure' => 3725,
                'Total_Pikmin' => 30,
                'border1' => 37825,
                'border2' => 37900,
                'border3' => 0,
                'border4' => 0,
            ],
            [
                // 神々のおもちゃ箱
                'stage_id' => 203,
                'parent' => 22,
                'Time' => 250,
                'Max_Treasure' => 4713,
                'Total_Pikmin' => 100,
                'border1' => 48275,
                'border2' => 37900,
                'border3' => 0,
                'border4' => 0,
            ],
            [
                // 原生の杜（お宝をあつめろ！）
                'stage_id' => 301,
                'parent' => 31,
                'Time' => 420,
                'Max_Treasure' => 2110,
                'Total_Pikmin' => 50,
                'border1' => 8100,
                'border2' => 0,
                'border3' => 0,
                'border4' => 0,
            ],
        ];
        foreach($params as $param) {
            DB::table('stages')->insert($param);
        }
    }
}
