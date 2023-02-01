<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TotalSeeder extends Seeder
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
                'user_name' => "タマゴムシ",
                't200' => 4500,
            ],
            [
                'user_name' => "サライムシ",
                't200' => 4000,
            ],
            [
                'user_name' => "タマゴムシ",
                't211' => 2300,
            ],
        ];
        foreach($params as $param) {
            DB::table('totals')->insert($param);
        }
    }
}
