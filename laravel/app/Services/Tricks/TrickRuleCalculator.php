<?php

namespace App\Services\Tricks;

class TrickRuleCalculator
{
    public function requiredHand(int $fieldCount): int
    {
        return 3 + max(0, $fieldCount);
    }

    public function fieldCap(int $participantCount): int
    {
        return min(max(1, $participantCount - 1), 16);
    }

    public function initialPostCost(int $rarity, int $existingParticipantCount): int
    {
        return $existingParticipantCount >= 1 && $existingParticipantCount < 3 ? 0 : $rarity;
    }

    public function extensionMinutes(int $participantOrder): int
    {
        return $participantOrder <= 1 ? 0 : max(5, 70 - 5 * $participantOrder);
    }

    public function totalReward(int $stackCount, int $paidPointsTotal, int $difficulty): int
    {
        $base = intdiv($stackCount + $paidPointsTotal, 5);

        return $stackCount + $paidPointsTotal + max(1, $difficulty) * $base;
    }
}
