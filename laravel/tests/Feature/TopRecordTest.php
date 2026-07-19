<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TopRecordTest extends TestCase
{
    use RefreshDatabase;

    public function test_rule_11_top_record_uses_the_highest_stored_score_and_oldest_tie(): void
    {
        $this->insertRecord('slow', 90, '2026-01-01 00:00:00');
        $this->insertRecord('new-fast', 120, '2026-01-03 00:00:00');
        $expectedPostId = $this->insertRecord('old-fast', 120, '2026-01-02 00:00:00');
        $this->insertRecord('same-time-fast', 120, '2026-01-02 00:00:00');
        $this->insertRecord('other-console', 999, '2025-01-01 00:00:00', 11, 2);

        $response = $this->getJson('/api/record/top/101/1/11');

        $response
            ->assertOk()
            ->assertJsonPath('post_id', $expectedPostId)
            ->assertJsonPath('user_id', 'old-fast')
            ->assertJsonPath('score', 120);
    }

    public function test_regular_score_rule_top_record_uses_the_highest_score(): void
    {
        $this->insertRecord('low', 90, '2026-01-01 00:00:00', 10);
        $expectedPostId = $this->insertRecord('high', 120, '2026-01-02 00:00:00', 10);

        $response = $this->getJson('/api/record/top/101/1/10');

        $response
            ->assertOk()
            ->assertJsonPath('post_id', $expectedPostId)
            ->assertJsonPath('user_id', 'high')
            ->assertJsonPath('score', 120);
    }

    public function test_rule_11_ranking_uses_each_users_highest_stored_score_in_descending_order(): void
    {
        $this->insertRecord('third', 120, '2026-01-01 00:00:00');
        $this->insertRecord('first', 150, '2026-01-02 00:00:00');
        $this->insertRecord('second', 100, '2026-01-03 00:00:00');
        $this->insertRecord('first', 90, '2026-01-04 00:00:00');

        $response = $this->getJson('/api/record/101/0/11/2026/0');

        $response
            ->assertOk()
            ->assertJsonPath('0.user_id', 'first')
            ->assertJsonPath('0.score', 150)
            ->assertJsonPath('0.post_rank', 1)
            ->assertJsonPath('1.user_id', 'third')
            ->assertJsonPath('1.score', 120)
            ->assertJsonPath('1.post_rank', 2)
            ->assertJsonPath('2.user_id', 'second')
            ->assertJsonPath('2.score', 100)
            ->assertJsonPath('2.post_rank', 3);
    }

    private function insertRecord(
        string $userId,
        int $score,
        string $createdAt,
        int $rule = 11,
        int $console = 1
    ): int
    {
        return DB::table('records')->insertGetId([
            'user_id' => $userId,
            'score' => $score,
            'stage_id' => 101,
            'rule' => $rule,
            'console' => $console,
            'difficulty' => 2,
            'region' => '1',
            'team' => 0,
            'unique_id' => random_int(100000000, 999999999),
            'post_comment' => '',
            'user_ip' => '',
            'user_host' => '',
            'user_agent' => 'phpunit',
            'img_url' => '',
            'video_url' => '',
            'post_memo' => '',
            'flg' => '0',
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
    }
}
