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

    public function requiredHand(int $fieldCount): int
    {
        return 3 + intdiv(max(0, $fieldCount), 2);
    }

    public function fieldCap(int $participantCount): int
    {
        return min(max(1, $participantCount - 1), 16);
    }

    public function initialPostCost(int $rarity, int $existingParticipantCount): int
    {
        return $existingParticipantCount >= 1 && $existingParticipantCount < 3 ? 0 : $rarity;
    }

    public function extensionMinutes(int $participantOrder, bool $lateFirstExtension = false): int
    {
        return $participantOrder <= 1 ? 0 : max(5, ($lateFirstExtension ? 50 : 70) - 5 * $participantOrder);
    }

    public function totalReward(int $stackCount, int $paidPointsTotal, int $difficulty): int
    {
        $base = intdiv($stackCount + $paidPointsTotal, 5);

        return $stackCount + $paidPointsTotal + max(1, $difficulty) * $base;
    }
}
