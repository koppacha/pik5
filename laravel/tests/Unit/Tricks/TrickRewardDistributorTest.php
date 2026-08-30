<?php

namespace Tests\Unit\Tricks;

use App\Services\Tricks\TrickRewardDistributor;
use PHPUnit\Framework\TestCase;

class TrickRewardDistributorTest extends TestCase
{
    public function test_tied_groups_receive_equal_points(): void
    {
        $result = (new TrickRewardDistributor())->distribute(8, [['A', 'B'], ['C', 'D']]);

        self::assertSame(['A' => 3, 'B' => 3, 'C' => 1, 'D' => 1], $result['distribution']);
        self::assertSame(0, $result['taker_remainder']);
    }

    public function test_last_group_is_excluded_when_three_players_are_above(): void
    {
        $result = (new TrickRewardDistributor())->distribute(10, [['A'], ['B'], ['C'], ['D', 'E']]);

        self::assertArrayNotHasKey('D', $result['distribution']);
        self::assertArrayNotHasKey('E', $result['distribution']);
        self::assertSame(10, array_sum($result['distribution']) + $result['taker_remainder']);
    }

    public function test_unallocatable_remainder_is_returned_to_taker(): void
    {
        $result = (new TrickRewardDistributor())->distribute(8, [['A', 'B', 'C']]);

        self::assertSame(['A' => 2, 'B' => 2, 'C' => 2], $result['distribution']);
        self::assertSame(2, $result['taker_remainder']);
    }
}
