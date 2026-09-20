<?php

namespace Tests\Unit\Tricks;

use App\Services\Tricks\TrickRuleCalculator;
use PHPUnit\Framework\TestCase;

class TrickRuleCalculatorTest extends TestCase
{
    public function test_entry_take_and_extension_rules(): void
    {
        $rules = new TrickRuleCalculator();

        self::assertSame(0, $rules->takeLevel(0));
        self::assertSame(1, $rules->takeLevel(1));
        self::assertSame(2, $rules->takeLevel(4));
        self::assertSame(3, $rules->takeLevel(9));
        self::assertSame(2, $rules->requiredHand(0));
        self::assertSame(3, $rules->requiredHand(1));
        self::assertSame(3, $rules->requiredHand(3));
        self::assertSame(4, $rules->requiredHand(4));
        self::assertSame(1, $rules->fieldCap(1));
        self::assertSame(15, $rules->fieldCap(16));
        self::assertSame(16, $rules->fieldCap(30));
        self::assertSame(0, $rules->initialPostCost(5, false, false));
        self::assertSame(5, $rules->initialPostCost(5, true, false));
        self::assertSame(5, $rules->initialPostCost(5, false, true));
        self::assertSame([60, 60, 80, 100, 120], array_map(
            fn (int $difficulty): int => $rules->initialCountdownMinutes($difficulty),
            range(1, 5),
        ));
        self::assertSame(15, $rules->extensionMinutes(1, 15));
        self::assertSame(30, $rules->extensionMinutes(1, 14.99));
        self::assertSame(10, $rules->extensionMinutes(2, 1));
        self::assertSame(10, $rules->extensionMinutes(16, 100));
        self::assertTrue($rules->emptyFieldSubsidyEligible(5, 2));
        self::assertFalse($rules->emptyFieldSubsidyEligible(5, 3));
        self::assertTrue($rules->emptyFieldSubsidyEligible(-2, 9));
        self::assertFalse($rules->emptyFieldSubsidyEligible(-2, 10));
    }

    public function test_total_reward(): void
    {
        $rules = new TrickRuleCalculator();
        self::assertSame(8, $rules->totalReward(6, 3, 5, 2));
        self::assertSame(6, $rules->totalReward(6, 3, 5, 1));
        self::assertSame(0, $rules->totalReward(6, 3, 5, 0));
    }

    public function test_subsidy_and_rarity_boundaries(): void
    {
        $rules = new TrickRuleCalculator();

        self::assertTrue($rules->subsidyEligible(4, 5));
        self::assertFalse($rules->subsidyEligible(5, 5));
        self::assertTrue($rules->returnSubsidyEligible(4));
        self::assertFalse($rules->returnSubsidyEligible(5));

        self::assertEquals([1 => 90.0, 2 => 6.0, 3 => 3.0, 4 => 0.9, 5 => 0.1], $rules->rarityWeights(0));
        self::assertEqualsWithDelta(31.6227766, array_sum(array_slice($rules->rarityWeights(23), 1)), 0.000001);
        self::assertEqualsWithDelta(0.0, $rules->rarityWeights(46)[1], 0.000001);
        self::assertEqualsWithDelta(60.0, $rules->rarityWeights(46)[2], 0.000001);
        self::assertEqualsWithDelta(30.0, $rules->rarityWeights(46)[3], 0.000001);
        self::assertEqualsWithDelta(9.0, $rules->rarityWeights(46)[4], 0.000001);
        self::assertEqualsWithDelta(1.0, $rules->rarityWeights(46)[5], 0.000001);
    }
}
