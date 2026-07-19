<?php

namespace Tests\Unit;

use App\Library\Func;
use PHPUnit\Framework\TestCase;

class ScoreOrderTest extends TestCase
{
    public function test_rule_11_is_sorted_in_descending_stored_score_order(): void
    {
        $this->assertSame(['score', 'DESC'], Func::orderByRule(101, 11));
    }

    public function test_regular_score_rule_is_sorted_in_descending_score_order(): void
    {
        $this->assertSame(['score', 'DESC'], Func::orderByRule(101, 10));
    }

    public function test_time_attack_stage_is_sorted_in_ascending_score_order(): void
    {
        $this->assertSame(['score', 'ASC'], Func::orderByRule(245, 10));
    }

    public function test_rule_11_records_are_sorted_by_stored_score_descending_then_oldest_record(): void
    {
        $records = [
            ['post_id' => 4, 'score' => 550, 'created_at' => '2026-01-01 00:00:00'],
            ['post_id' => 3, 'score' => 387, 'created_at' => '2026-01-03 00:00:00'],
            ['post_id' => 2, 'score' => 387, 'created_at' => '2026-01-02 00:00:00'],
            ['post_id' => 1, 'score' => 444, 'created_at' => '2026-01-01 00:00:00'],
        ];

        $sorted = Func::sortRecordsByRule($records, 101, 11);

        $this->assertSame([4, 1, 2, 3], array_column($sorted, 'post_id'));
    }

    public function test_regular_score_records_remain_in_descending_score_order(): void
    {
        $records = [
            ['post_id' => 1, 'score' => 100, 'created_at' => '2026-01-01 00:00:00'],
            ['post_id' => 2, 'score' => 200, 'created_at' => '2026-01-02 00:00:00'],
        ];

        $sorted = Func::sortRecordsByRule($records, 101, 10);

        $this->assertSame([2, 1], array_column($sorted, 'post_id'));
    }
}
