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
                'user_id' => 'tamagomushi',
                'stage_id' => 201,
                'rule' => 10,
                'score' => 35000,
                'console' => 1,
                'unique_id' => 300123456,
                'post_rank' => 1,
                'rps' => 201,
                'post_comment' => 'コメントテスト',
                'hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y',
                'flg' => 0,
                'created_at' => new \DateTime(),
                'updated_at' => new \DateTime(),
            ],
            [
                'user_id' => 'tamagomushi',
                'stage_id' => 201,
                'rule' => 10,
                'score' => 34500,
                'console' => 1,
                'unique_id' => 300123456,
                'post_rank' => 1,
                'rps' => 201,
                'post_comment' => 'コメントテスト',
                'hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y',
                'flg' => 1,
                'created_at' => new \DateTime(),
                'updated_at' => new \DateTime(),
            ],
            [
                'user_id' => 'tamagomushi',
                'stage_id' => 201,
                'rule' => 10,
                'score' => 34990,
                'console' => 2,
                'unique_id' => 300123456,
                'post_rank' => 1,
                'rps' => 201,
                'post_comment' => 'コメントテスト',
                'hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y',
                'flg' => 0,
                'created_at' => new \DateTime(),
                'updated_at' => new \DateTime(),
            ],
            [
                'user_id' => 'tamagomushi',
                'stage_id' => 201,
                'rule' => 21,
                'score' => 34990,
                'console' => 2,
                'unique_id' => 300123456,
                'post_rank' => 1,
                'rps' => 201,
                'post_comment' => 'コメントテスト',
                'hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y',
                'flg' => 0,
                'created_at' => new \DateTime(),
                'updated_at' => new \DateTime(),
            ],
            [
                'user_id' => 'saraimushi',
                'stage_id' => 201,
                'rule' => 10,
                'score' => 34980,
                'console' => 1,
                'unique_id' => 300123456,
                'post_rank' => 2,
                'rps' => 140,
                'post_comment' => 'コメントテスト',
                'hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y',
                'flg' => 0,
                'created_at' => new \DateTime(),
                'updated_at' => new \DateTime(),
            ],
            [
                'user_id' => 'ujadani',
                'stage_id' => 201,
                'rule' => 10,
                'score' => 34950,
                'console' => 2,
                'unique_id' => 300123456,
                'post_rank' => 3,
                'rps' => 120,
                'post_comment' => 'コメントテスト',
                'hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y',
                'flg' => 0,
                'created_at' => new \DateTime(),
                'updated_at' => new \DateTime(),
            ],
            [
                'user_id' => 'tamagomushi',
                'stage_id' => 202,
                'rule' => 10,
                'score' => 25000,
                'console' => 1,
                'unique_id' => 300123456,
                'post_rank' => 1,
                'rps' => 201,
                'post_comment' => 'コメントテスト',
                'hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y',
                'flg' => 0,
                'created_at' => new \DateTime(),
                'updated_at' => new \DateTime(),
            ],
            [
                'user_id' => 'totetsuchihokashi',
                'stage_id' => 202,
                'rule' => 10,
                'score' => 24300,
                'console' => 2,
                'unique_id' => 300123456,
                'post_rank' => 2,
                'rps' => 150,
                'post_comment' => 'コメントテスト',
                'hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y',
                'flg' => 0,
                'created_at' => new \DateTime(),
                'updated_at' => new \DateTime(),
            ],
            [
                'user_id' => 'ujinko',
                'stage_id' => 202,
                'rule' => 10,
                'score' => 24100,
                'console' => 1,
                'unique_id' => 300123456,
                'post_rank' => 3,
                'rps' => 120,
                'post_comment' => 'コメントテスト',
                'hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y',
                'flg' => 0,
                'created_at' => new \DateTime(),
                'updated_at' => new \DateTime(),
            ],
            [
                'user_id' => 'tamagomushi',
                'stage_id' => 203,
                'rule' => 10,
                'score' => 40200,
                'console' => 1,
                'unique_id' => 300123456,
                'post_rank' => 1,
                'rps' => 100,
                'post_comment' => 'コメントテスト',
                'hash' => 'abcdef1234',
                'user_ip' => '192.168.0.1',
                'user_host' => '*.home.ne.jp',
                'user_agent' => 'Firefox 102',
                'img_url' => 'test.jpg',
                'video_url' => 'https://youtu.be/9YAqwBp0m8Y',
                'flg' => 0,
                'created_at' => new \DateTime(),
                'updated_at' => new \DateTime(),
            ]
        ];
        foreach($params as $param) {
            DB::table('records')->insert($param);
        }
    }
}
