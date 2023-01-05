<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RecordSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run(): void
    {
        DB::table('records')->insert([
            'user_name' => 'タマゴムシ',
            'stage_id' => 399,
            'score' => 20010,
            'console' => 1,
            'unique_id' => 300123456,
            'post_rank' => 1,
            'rps' => 201,
            'post_comment' => 'コメントテスト',
            'evi_hash' => 'abcdef1234',
            'user_ip' => '192.168.0.1',
            'user_host' => '*.home.ne.jp',
            'user_agent' => 'Firefox 102',
            'img_url' => 'test.jpg',
            'video_url' => 'https://youtu.be/9YAqwBp0m8Y'
        ]);
    }
}
