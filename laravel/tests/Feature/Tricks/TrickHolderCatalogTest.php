<?php

namespace Tests\Feature\Tricks;

use App\Services\Tricks\TrickHolderCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TrickHolderCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_historical_holder_uses_first_best_post_and_ignores_other_events(): void
    {
        Cache::forget('tricks:historical-holders:v2');
        DB::table('stages')->insert([
            'stage_id' => 1003, 'stage_name' => 'テストステージ（縛り）[全員]', 'eng_stage_name' => 'Test',
            'stage_sub' => '期間限定ランキング', 'type' => 'stage', 'display' => 'int',
            'series' => 1, 'parent' => 160306, 'time' => 0, 'treasure' => 0, 'pikmin' => 0,
            'border1' => 0, 'border2' => 0, 'border3' => 0, 'border4' => 0,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->insertRecord(1, 'late', 500, 1003, 160306, '2026-01-02 12:00:00');
        $this->insertRecord(2, 'early', 500, 1003, 160306, '2026-01-02 11:00:00');
        $this->insertRecord(3, 'early', 400, 1003, 160306, '2026-01-02 10:00:00');
        $this->insertRecord(4, 'other_event', 999, 1003, 190209, '2026-01-02 09:00:00');
        $this->insertRecord(5, 'invalid', 999, 1003, 160306, '2026-01-02 08:00:00', 2);

        $cards = app(TrickHolderCatalog::class)->historicalCards();
        self::assertCount(1, $cards);
        self::assertSame(['early'], $cards[0]['holders']);
        self::assertSame('テストステージ[全員]', $cards[0]['title']);
        self::assertSame('縛り', $cards[0]['rule_name']);
        self::assertNull($cards[0]['difficulty']);
        self::assertSame(2, $cards[0]['rank_points']);
        self::assertSame(['early', 'late'], array_column($cards[0]['rankings'], 'user_id'));
        Cache::forget('tricks:historical-holders:v2');
    }

    private function insertRecord(int $id, string $user, int $score, int $stage, int $rule, string $createdAt, int $flag = 0): void
    {
        DB::table('records')->insert([
            'post_id' => $id, 'user_id' => $user, 'score' => $score,
            'stage_id' => $stage, 'rule' => $rule, 'console' => 1, 'region' => '1',
            'unique_id' => $id, 'post_comment' => '', 'user_ip' => '', 'user_host' => '',
            'user_agent' => '', 'img_url' => '', 'video_url' => '', 'post_memo' => '',
            'flg' => $flag, 'team' => 0, 'created_at' => $createdAt, 'updated_at' => $createdAt,
        ]);
    }
}
