<?php

namespace App\Services;

class SwissPairingService
{
    public function swiss(array $players, array $previousPairs, bool $firstRound): array
    {
        if ($firstRound) {
            shuffle($players);
            return $this->pair($players, $previousPairs);
        }

        usort($players, static function ($a, $b) {
            $record = [$b['wins'] <=> $a['wins'], $a['losses'] <=> $b['losses']];
            if ($record[0] !== 0) return $record[0];
            if ($record[1] !== 0) return $record[1];
            $rank = ($a['provisional_rank'] ?? PHP_INT_MAX) <=> ($b['provisional_rank'] ?? PHP_INT_MAX);
            return $rank !== 0 ? $rank : random_int(-1, 1);
        });
        $groups = [];
        foreach ($players as $player) $groups[$player['wins'] . '-' . $player['losses']][] = $player;
        $carry = null;
        $pairs = [];
        foreach ($groups as $group) {
            if ($carry) array_unshift($group, $carry);
            if (count($group) % 2 === 1) $carry = array_pop($group); else $carry = null;
            $pairs = array_merge($pairs, $this->pairPlayers($group, $previousPairs));
        }
        if ($carry) $pairs[] = ['player1' => $carry['user_id'], 'player2' => null, 'bye' => true];
        return $pairs;
    }

    public function elimination(array $players, array $previousPairs): array
    {
        usort($players, static function ($a, $b) {
            $bye = $a['bye_count'] <=> $b['bye_count'];
            if ($bye !== 0) return $bye;
            return ($a['provisional_rank'] ?? PHP_INT_MAX) <=> ($b['provisional_rank'] ?? PHP_INT_MAX);
        });
        return $this->pair($players, $previousPairs);
    }

    private function pair(array $players, array $previousPairs): array
    {
        if (count($players) % 2 === 1) {
            usort($players, static fn ($a, $b) => $a['bye_count'] <=> $b['bye_count']);
            $bye = array_shift($players);
            return array_merge($this->pairPlayers($players, $previousPairs), [['player1' => $bye['user_id'], 'player2' => null, 'bye' => true]]);
        }
        return $this->pairPlayers($players, $previousPairs);
    }

    private function pairPlayers(array $players, array $previousPairs): array
    {
        $pairs = [];
        while ($players) {
            $first = array_shift($players);
            $index = 0;
            foreach ($players as $candidateIndex => $candidate) {
                $key = $this->key($first['user_id'], $candidate['user_id']);
                if (!isset($previousPairs[$key])) { $index = $candidateIndex; break; }
            }
            $second = array_splice($players, $index, 1)[0];
            $pairs[] = ['player1' => $first['user_id'], 'player2' => $second['user_id'], 'bye' => false];
        }
        return $pairs;
    }

    public function key(string $a, string $b): string
    {
        return $a < $b ? "$a:$b" : "$b:$a";
    }
}
