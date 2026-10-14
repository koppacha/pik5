<?php

namespace Tests\Unit\Tricks;

use App\Services\Tricks\TrickRankCalculator;
use PHPUnit\Framework\TestCase;

class TrickRankCalculatorTest extends TestCase
{
    public function test_standard_competition_ranking_and_rank_points(): void
    {
        $result = (new TrickRankCalculator())->calculate([
            'alice' => 100,
            'bob' => 100,
            'carol' => 80,
        ]);

        self::assertSame(1, $result['alice']['rank']);
        self::assertSame(1, $result['bob']['rank']);
        self::assertSame(3, $result['carol']['rank']);
        self::assertSame(4, $result['alice']['rank_points']);
        self::assertSame(4, $result['bob']['rank_points']);
        self::assertSame(1, $result['carol']['rank_points']);
    }

    public function test_ascending_score_rule(): void
    {
        $result = (new TrickRankCalculator())->calculate([
            'alice' => 50,
            'bob' => 40,
        ], true);

        self::assertSame(2, $result['alice']['rank']);
        self::assertSame(1, $result['bob']['rank']);
    }
}
