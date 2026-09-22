<?php

namespace App\Services\Tricks;

class TrickRuleCalculator
{
    public function subsidyEligible(int $points, int $participantCount): bool
    {
        return $points < $participantCount;
    }

    public function emptyFieldSubsidyEligible(int $points, int $handCount): bool
    {
        return $points + $handCount < 8;
    }

    public function returnSubsidyEligible(int $pointsAfterPayment): bool
    {
        return $pointsAfterPayment <= 4;
    }

    public function rarityWeights(float $elapsedHours): array
    {
        $elapsedHours = max(0.0, min(46.0, $elapsedHours));
        $rareRate = min(100.0, 10.0 * (10 ** ($elapsedHours / 46.0)));
        $scale = $rareRate / 10.0;

        return [
            1 => 100.0 - $rareRate,
            2 => 6.0 * $scale,
            3 => 3.0 * $scale,
            4 => 0.9 * $scale,
            5 => 0.1 * $scale,
        ];
    }

    public function takeLevel(int $takeCount): int
    {
        return (int) floor(sqrt(max(0, $takeCount)));
    }

    public function requiredHand(int $takeCount): int
    {
        return $this->takeLevel($takeCount) + 2;
    }

    public function handLimit(int $takeCount): int
    {
        return $this->requiredHand($takeCount) * 3;
    }

    public function balanceTaxThreshold(int $takeCount): int
    {
        return $this->requiredHand($takeCount) * 5;
    }

    public function fieldCap(int $participantCount): int
    {
        return min(max(1, $participantCount - 1), 16);
    }

    public function initialPostCost(int $difficulty, bool $isTaker, bool $hasInitialPost): int
    {
        return $isTaker || $hasInitialPost ? max(1, $difficulty) : 0;
    }

    public function initialCountdownMinutes(int $difficulty): int
    {
        return 60 + max(0, min(5, max(1, $difficulty)) - 2) * 20;
    }

    public function extensionMinutes(int $participantOrder, float $remainingMinutes): int
    {
        if ($participantOrder <= 0) {
            return 0;
        }
        if ($participantOrder === 1) {
            return $remainingMinutes < 15 ? 30 : 15;
        }

        return 10;
    }

    public function totalReward(
        int $stackCount,
        int $paidPointsTotal,
        int $participantCount,
        int $potPoints = 0,
    ): int {
        if ($participantCount <= 0) {
            return 0;
        }

        return max(0, $stackCount + $paidPointsTotal + $potPoints);
    }
}
