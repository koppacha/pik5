<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Random\RandomException;

class DeckSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     * @throws RandomException
     */
    public function run(): void
    {
        $now = Carbon::now();
        $entries = [];

        for ($i = 1; $i <= 10; $i++) {
            // リミットオーバー日時は現在時刻＋i時間後に設定
            $limitOverAt = Carbon::now()->addHours($i)->toDateTimeString();

            $entries[] = [
                // 大会ID（6桁のサンプル）
                'eventId'     => 250905,
                // ステージID
                'stageId'     => 1313 + $i,
                // カード名
                'title'              => "サンプルステージ{$i}",
                // 縛りルール名
                'ruleName'          => "サンプルルール{$i}",
                // 現在の場所（最初は山札）
                'state'             => '_deck',
                // ミニゲームのルール本文
                'text'         => "これはサンプル{$i}のミニゲームルールです。",
                // 難易度（1〜5のランダム）
                'difficulty'        => random_int(1, 5),
                // レア度（1〜5のランダム）
                'rarity'            => random_int(1, 5),
                // リワード値（使用ドローポイントのサンプル）
                'rewards'     => random_int(1, 3),
                // クリエイター（システム名など）
                'creator'           => 'system',
                // テイカー（まだ誰もテイクしていないので NULL）
                'taker'             => null,
                // トップ投稿者（まだスコア無しのため NULL）
                'topPlayer'        => null,
                // 参加者数（最初は 0）
                'count' => 0,
                // リミットオーバー日時
                'limit'     => $limitOverAt,
                // created_at / updated_at
                'created_at'        => $now->toDateTimeString(),
                'updated_at'        => $now->toDateTimeString(),
            ];
        }

        // 一括挿入
        DB::table('decks')->insert($entries);
    }
}
