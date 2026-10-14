<?php

namespace App\Services\Tricks;

class TrickRankCalculator
{
    /**
     * @param  array<string, int|float>  $scores
     * @return array<string, array{score: int|float, rank: int, rank_points: int}>
     */
    public function calculate(array $scores, bool $ascending = false): array
    {
        $entries = [];
        foreach ($scores as $player => $score) {
            $entries[] = ['player' => $player, 'score' => $score];
        }
        usort($entries, static function (array $left, array $right) use ($ascending): int {
            $comparison = $left['score'] <=> $right['score'];
            if (! $ascending) {
                $comparison *= -1;
            }

            return $comparison !== 0 ? $comparison : strcmp($left['player'], $right['player']);
        });

        $participantCount = count($entries);
        $previousScore = null;
        $previousRank = 0;
        $result = [];
        foreach ($entries as $index => $entry) {
            $rank = $index === 0 || $entry['score'] !== $previousScore ? $index + 1 : $previousRank;
            $result[$entry['player']] = [
                'score' => $entry['score'],
                'rank' => $rank,
                'rank_points' => $participantCount - $rank + 1 + ($rank === 1 ? 1 : 0),
            ];
            $previousScore = $entry['score'];
            $previousRank = $rank;
        }

        return $result;
    }
}
