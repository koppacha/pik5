<?php

namespace Tests\Unit\Tricks;

use App\Services\Tricks\TrickRewardDistributor;
use PHPUnit\Framework\TestCase;

class TrickRewardDistributorTest extends TestCase
{
    public function test_tied_groups_receive_equal_points(): void
    {
        $result = (new TrickRewardDistributor())->distribute(8, [['A', 'B'], ['C', 'D']]);

        self::assertSame(['A' => 3, 'B' => 3, 'C' => 0, 'D' => 0], $result['distribution']);
        self::assertSame(2, $result['taker_remainder']);
    }

    public function test_four_player_cycle_keeps_last_place_at_zero(): void
    {
        $result = (new TrickRewardDistributor())->distribute(10, [['A'], ['B'], ['C'], ['D', 'E']]);

        self::assertSame(0, $result['distribution']['D']);
        self::assertSame(0, $result['distribution']['E']);
        self::assertSame(10, array_sum($result['distribution']) + $result['taker_remainder']);
    }

    public function test_unallocatable_remainder_is_returned_for_last_place_distribution(): void
    {
        $result = (new TrickRewardDistributor())->distribute(8, [['A', 'B', 'C']]);

        self::assertSame(['A' => 2, 'B' => 2, 'C' => 2], $result['distribution']);
        self::assertSame(2, $result['taker_remainder']);
        self::assertSame(
            ['alice' => 2, 'bob' => 2, 'carol' => 1],
            (new TrickRewardDistributor())->lastPlaceRemainder(5, ['carol', 'alice', 'bob']),
        );
    }

    public function test_below_base_totals_reduce_the_lowest_positive_rank_first(): void
    {
        $distributor = new TrickRewardDistributor();
        self::assertSame(['A' => 4, 'B' => 0, 'C' => 0], $distributor->distribute(4, [['A'], ['B'], ['C']])['distribution']);
        self::assertSame(['A' => 3, 'B' => 0], $distributor->distribute(3, [['A'], ['B']])['distribution']);
        self::assertSame(['A' => 2, 'B' => 2, 'C' => 0], $distributor->distribute(4, [['A', 'B'], ['C']])['distribution']);
        foreach (range(2, 8) as $count) {
            $groups = array_map(fn ($index) => ['player-'.$index], range(1, $count));
            foreach (range(1, $count + 2) as $total) {
                $result = $distributor->distribute($total, $groups);
                self::assertSame($total, array_sum($result['distribution']) + $result['taker_remainder']);
                self::assertGreaterThanOrEqual(0, min($result['distribution']));
                if ($count > 2) {
                    self::assertSame(0, $result['distribution']['player-'.$count]);
                }
            }
        }
    }

    public function test_four_player_excess_uses_the_documented_cycle(): void
    {
        $distributor = new TrickRewardDistributor();

        self::assertSame(['A' => 5, 'B' => 2, 'C' => 1, 'D' => 0], $distributor->distribute(8, [['A'], ['B'], ['C'], ['D']])['distribution']);
        self::assertSame(['A' => 5, 'B' => 3, 'C' => 1, 'D' => 0], $distributor->distribute(9, [['A'], ['B'], ['C'], ['D']])['distribution']);
        self::assertSame(['A' => 5, 'B' => 3, 'C' => 2, 'D' => 0], $distributor->distribute(10, [['A'], ['B'], ['C'], ['D']])['distribution']);
    }
}
