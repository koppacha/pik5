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

        $eligibleGroups = $this->eligibleGroups($rankGroups);
        $amounts = array_fill(0, count($eligibleGroups), 0);
        $remaining = $total;
        $selected = 0;
        foreach ($eligibleGroups as $index => $group) {
            $cost = count($group);
            if ($remaining < $cost) {
                break;
            }
            $amounts[$index] = 1;
            $remaining -= $cost;
            $selected = $index + 1;
        }
        if ($selected === 0) {
            return ['distribution' => [], 'taker_remainder' => $total];
        }

        $protectedGaps = min(3, $selected - 1);
        for ($index = 0; $index < $protectedGaps; $index++) {
            $needed = $amounts[$index + 1] + 1 - $amounts[$index];
            $cost = $needed * count($eligibleGroups[$index]);
            if ($needed > 0 && $remaining >= $cost) {
                $amounts[$index] += $needed;
                $remaining -= $cost;
            }
        }

        do {
            $changed = false;
            for ($index = 0; $index < $selected; $index++) {
                $cost = count($eligibleGroups[$index]);
                if ($remaining < $cost) {
                    continue;
                }
                $trial = $amounts;
                $trial[$index]++;
                if ($this->gapsAreValid($trial, $protectedGaps)) {
                    $amounts = $trial;
                    $remaining -= $cost;
                    $changed = true;
                    break;
                }
            }
        } while ($changed);

        $distribution = [];
        foreach (array_slice($eligibleGroups, 0, $selected) as $index => $group) {
            foreach ($group as $player) {
                $distribution[$player] = $amounts[$index];
            }
        }

        return ['distribution' => $distribution, 'taker_remainder' => $remaining];
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

    /** @param  list<list<string>>  $rankGroups */
    private function eligibleGroups(array $rankGroups): array
    {
        if (count($rankGroups) < 2) {
            return $rankGroups;
        }
        $playersAboveLast = array_sum(array_map('count', array_slice($rankGroups, 0, -1)));

        return $playersAboveLast >= 3 ? array_slice($rankGroups, 0, -1) : $rankGroups;
    }

    private function gapsAreValid(array $amounts, int $protectedGaps): bool
    {
        for ($index = 0; $index < $protectedGaps; $index++) {
            if ($amounts[$index] <= $amounts[$index + 1]) {
                return false;
            }
        }

        return true;
    }
}
