<?php

namespace Tests\Unit;

use App\Http\Controllers\UserTotalController;
use PHPUnit\Framework\TestCase;

class UserTotalControllerTest extends TestCase
{
    public function test_it_converts_time_attack_scores_when_aggregating_user_totals(): void
    {
        $controller = new UserTotalController();
        $ranks = [
            ['rule' => 29, 'score' => 120, 'rps' => 10],
            ['rule' => 35, 'score' => 240, 'rps' => 20],
            ['rule' => 47, 'score' => 700, 'rps' => 30],
            ['rule' => 10, 'score' => 1000, 'rps' => 40],
        ];

        $this->assertSame([
            29 => 480,
            35 => 360,
            47 => 0,
            10 => 1000,
        ], $controller->aggregateScores($ranks));
        $this->assertSame([
            29 => 10,
            35 => 20,
            47 => 30,
            10 => 40,
        ], $controller->aggregateScores($ranks, 'rps'));
    }
}
