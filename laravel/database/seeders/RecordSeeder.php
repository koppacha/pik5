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
        $params = [
            [
                'user_name' => 'タマゴムシ',
                'stage_id' => 201,
                'score' => 35000,
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
            ],
            [
                'user_name' => 'サライムシ',
                'stage_id' => 201,
                'score' => 34980,
                'console' => 1,
                'unique_id' => 300123456,
                'post_rank' => 2,
                'rps' => 140,
                'post_comment' => 'コメントテスト',
                'evi_hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y'
            ],
            [
                'user_name' => 'ウジャダニ',
                'stage_id' => 201,
                'score' => 34950,
                'console' => 2,
                'unique_id' => 300123456,
                'post_rank' => 3,
                'rps' => 120,
                'post_comment' => 'コメントテスト',
                'evi_hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y'
            ],
            [
                'user_name' => 'タマゴムシ',
                'stage_id' => 202,
                'score' => 25000,
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
            ],
            [
                'user_name' => 'トテツチホカシ',
                'stage_id' => 202,
                'score' => 24300,
                'console' => 2,
                'unique_id' => 300123456,
                'post_rank' => 2,
                'rps' => 150,
                'post_comment' => 'コメントテスト',
                'evi_hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y'
            ],
            [
                'user_name' => 'ウジンコ',
                'stage_id' => 202,
                'score' => 24100,
                'console' => 1,
                'unique_id' => 300123456,
                'post_rank' => 3,
                'rps' => 120,
                'post_comment' => 'コメントテスト',
                'evi_hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y'
            ],
            [
                'user_name' => 'タマゴムシ',
                'stage_id' => 203,
                'score' => 40200,
                'console' => 1,
                'unique_id' => 300123456,
                'post_rank' => 1,
                'rps' => 100,
                'post_comment' => 'コメントテスト',
                'evi_hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y'
            ]
        ];
        foreach($params as $param) {
            DB::table('records')->insert($param);
        }
    }
}
