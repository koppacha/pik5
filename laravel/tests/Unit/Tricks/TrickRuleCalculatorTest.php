<?php

namespace Tests\Unit\Tricks;

use App\Services\Tricks\TrickRuleCalculator;
use PHPUnit\Framework\TestCase;

class TrickRuleCalculatorTest extends TestCase
{
    public function test_entry_take_and_extension_rules(): void
    {
        $rules = new TrickRuleCalculator();

        self::assertSame(3, $rules->requiredHand(0));
        self::assertSame(10, $rules->requiredHand(7));
        self::assertSame(1, $rules->fieldCap(1));
        self::assertSame(15, $rules->fieldCap(16));
        self::assertSame(16, $rules->fieldCap(30));
        self::assertSame(5, $rules->initialPostCost(5, 0));
        self::assertSame(0, $rules->initialPostCost(5, 1));
        self::assertSame(0, $rules->initialPostCost(5, 2));
        self::assertSame(5, $rules->initialPostCost(5, 3));
        self::assertSame(0, $rules->extensionMinutes(1));
        self::assertSame(60, $rules->extensionMinutes(2));
        self::assertSame(55, $rules->extensionMinutes(3));
        self::assertSame(5, $rules->extensionMinutes(13));
    }

    public function test_total_reward(): void
    {
        self::assertSame(14, (new TrickRuleCalculator())->totalReward(6, 3, 5));
    }
}
