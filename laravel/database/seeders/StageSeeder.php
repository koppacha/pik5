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
                'stage_id' => 201,
                'parent' => 21,
            ],
            [
                'stage_id' => 202,
                'parent' => 21,
            ],
            [
                'stage_id' => 203,
                'parent' => 22,
            ],
        ];
        foreach($params as $param) {
            DB::table('stages')->insert($param);
        }
    }
}
