<?php

namespace App\Services\Tricks;

class TrickRewardDistributor
{
    /**
     * @param  list<list<string>>  $rankGroups
     * @return array{distribution: array<string, int>, taker_remainder: int}
     */
    public function distribute(int $total, array $rankGroups): array
    {
        if ($total <= 0 || $rankGroups === []) {
            return ['distribution' => [], 'taker_remainder' => max(0, $total)];
        }

        $participantCount = array_sum(array_map('count', $rankGroups));
        $amounts = $this->strictRankAmounts($participantCount, $total);

        $distribution = [];
        $remainder = 0;
        $offset = 0;
        foreach ($rankGroups as $group) {
            $groupTotal = array_sum(array_slice($amounts, $offset, count($group)));
            $share = intdiv($groupTotal, count($group));
            $remainder += $groupTotal % count($group);
            foreach ($group as $player) {
                $distribution[$player] = $share;
            }
            $offset += count($group);
        }

        return ['distribution' => $distribution, 'taker_remainder' => $remainder];
    }

    /** @param list<string> $lastPlayers */
    public function lastPlaceRemainder(int $remainder, array $lastPlayers): array
    {
        if ($remainder <= 0 || $lastPlayers === []) {
            return [];
        }
        sort($lastPlayers, SORT_STRING);
        $share = intdiv($remainder, count($lastPlayers));
        $extra = $remainder % count($lastPlayers);
        $distribution = [];
        foreach ($lastPlayers as $index => $player) {
            $amount = $share + ($index < $extra ? 1 : 0);
            if ($amount > 0) {
                $distribution[$player] = $amount;
            }
        }

        return $distribution;
    }

    /** @return list<int> */
    private function strictRankAmounts(int $participantCount, int $total): array
    {
        if ($participantCount === 1) {
            return [$total];
        }

        $amounts = match ($participantCount) {
            2 => [3, 2],
            3 => [4, 2, 0],
            4 => [4, 2, 1, 0],
            default => [3, 2, 2, ...array_fill(0, $participantCount - 4, 1), 0],
        };
        $baseEqual = [];
        for ($index = 1; $index < count($amounts); $index++) {
            $baseEqual[$index] = $amounts[$index - 1] === $amounts[$index];
        }
        while (array_sum($amounts) > $total) {
            for ($index = count($amounts) - 1; $index >= 0 && array_sum($amounts) > $total; $index--) {
                if ($amounts[$index] > 0) {
                    $amounts[$index]--;
                    break;
                }
            }
        }
        while (array_sum($amounts) < $total) {
            $added = false;
            for ($index = 1; $index < count($amounts) - 1; $index++) {
                $requiredGap = $index === 1 ? 2 : ($baseEqual[$index] ? 0 : 1);
                if ($amounts[$index - 1] - $amounts[$index] > $requiredGap) {
                    $amounts[$index]++;
                    $added = true;
                    break;
                }
            }
            if (! $added) {
                $amounts[0]++;
            }
        }

        return $amounts;
    }
}
