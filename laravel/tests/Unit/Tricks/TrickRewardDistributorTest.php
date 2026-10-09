<?php

namespace Tests\Unit\Tricks;

use App\Services\Tricks\TrickRewardDistributor;
use PHPUnit\Framework\TestCase;

class TrickRewardDistributorTest extends TestCase
{
    public function test_integer_remainders_are_bounded_by_tie_sizes_and_totals_are_preserved(): void
    {
        $distributor = new TrickRewardDistributor();
        foreach (range(1, 8) as $count) {
            foreach (range(0, (1 << ($count - 1)) - 1) as $mask) {
                $groups = [[]];
                for ($index = 0; $index < $count; $index++) {
                    $groups[count($groups) - 1][] = 'p'.$index;
                    if ($index < $count - 1 && ($mask & (1 << $index))) {
                        $groups[] = [];
                    }
                }
                $bound = array_sum(array_map(fn ($group) => count($group) - 1, $groups));
                foreach ([1, 3, 7, 19, 40] as $total) {
                    $result = $distributor->distribute($total, $groups);
                    self::assertSame($total, array_sum($result['distribution']) + $result['taker_remainder']);
                    self::assertLessThanOrEqual($bound, $result['taker_remainder']);
                    if ($count <= 4) {
                        self::assertLessThanOrEqual(3, $result['taker_remainder']);
                    }
                }
            }
        }
        $allTied = array_map(fn ($index) => 'p'.$index, range(1, 20));
        self::assertSame(19, $distributor->distribute(19, [$allTied])['taker_remainder']);
    }

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

    public function test_unallocatable_remainder_is_returned_for_taker(): void
    {
        $result = (new TrickRewardDistributor())->distribute(8, [['A', 'B', 'C']]);

        self::assertSame(['A' => 2, 'B' => 2, 'C' => 2], $result['distribution']);
        self::assertSame(2, $result['taker_remainder']);
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
