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
        self::assertSame(6, $rules->handLimit(0));
        self::assertSame(9, $rules->handLimit(1));
        self::assertSame(12, $rules->handLimit(4));
        self::assertSame(15, $rules->handLimit(9));
        self::assertSame(10, $rules->balanceTaxThreshold(0));
        self::assertSame(15, $rules->balanceTaxThreshold(1));
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
        self::assertSame(9, $rules->totalReward(6, 3, 2));
        self::assertSame(13, $rules->totalReward(6, 3, 1, 4));
        self::assertSame(0, $rules->totalReward(6, 3, 0, 4));
        self::assertSame(15, $rules->totalReward(6, 3, 2, 0, 3));
        self::assertSame(20, $rules->totalReward(6, 3, 2, 0, 4));
        self::assertSame(30, $rules->totalReward(6, 3, 2, 0, 5));
        self::assertSame([0, 1, 2, 4, 5, 7, 9, 15, 18], array_map(
            fn (array $pair): int => $rules->stackBonus(...$pair),
            [[1, 6], [2, 0], [2, 3], [3, 0], [3, 3], [4, 0], [4, 3], [5, 0], [5, 3]],
        ));
    }

    public function test_subsidy_and_final_three_hour_rarity_weights(): void
    {
        $rules = new TrickRuleCalculator();

        self::assertTrue($rules->subsidyEligible(4, 5));
        self::assertFalse($rules->subsidyEligible(5, 5));
        self::assertTrue($rules->returnSubsidyEligible(4));
        self::assertFalse($rules->returnSubsidyEligible(5));

        $normal = [1 => 87.0, 2 => 8.0, 3 => 4.0, 4 => 0.9, 5 => 0.1];
        $final = [1 => 0.0, 2 => 87.0, 3 => 8.0, 4 => 4.0, 5 => 1.0];
        self::assertEquals($normal, $rules->rarityWeights(3 * 60 * 60 + 1));
        self::assertEquals($final, $rules->rarityWeights(3 * 60 * 60));
        self::assertEquals($final, $rules->rarityWeights(70 * 60));
        self::assertEqualsWithDelta(100.0, array_sum($rules->rarityWeights(3 * 60 * 60)), 0.000001);
    }
}
