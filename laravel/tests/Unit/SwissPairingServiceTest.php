<?php

namespace Tests\Unit;

use App\Services\SwissPairingService;
use PHPUnit\Framework\TestCase;

class SwissPairingServiceTest extends TestCase
{
    public function test_it_avoids_previous_pairings_when_an_alternative_exists(): void
    {
        $service = new SwissPairingService();
        $players = [
            $this->player('a', 1, 0, 1), $this->player('b', 1, 0, 2),
            $this->player('c', 1, 0, 3), $this->player('d', 1, 0, 4),
        ];
        $previous = [$service->key('a', 'b') => true, $service->key('c', 'd') => true];

        $pairs = $service->swiss($players, $previous, false);

        $this->assertCount(2, $pairs);
        foreach ($pairs as $pair) {
            $this->assertArrayNotHasKey($service->key($pair['player1'], $pair['player2']), $previous);
        }
    }

    public function test_it_assigns_a_bye_to_the_player_with_fewer_byes(): void
    {
        $service = new SwissPairingService();
        $players = [
            $this->player('a', 1, 0, 1, 1), $this->player('b', 1, 0, 2, 0), $this->player('c', 0, 1, 3, 0),
        ];

        $pairs = $service->swiss($players, [], false);
        $bye = collect($pairs)->firstWhere('bye', true);

        $this->assertSame('c', $bye['player1']);
    }

    public function test_elimination_prefers_the_player_without_a_prior_bye(): void
    {
        $service = new SwissPairingService();
        $pairs = $service->elimination([
            $this->player('a', 3, 0, 1, 1), $this->player('b', 3, 0, 2, 0), $this->player('c', 3, 0, 3, 0),
        ], []);

        $bye = collect($pairs)->firstWhere('bye', true);
        $this->assertNotSame('a', $bye['player1']);
    }

    private function player(string $userId, int $wins, int $losses, int $rank, int $byeCount = 0): array
    {
        return ['user_id' => $userId, 'wins' => $wins, 'losses' => $losses, 'provisional_rank' => $rank, 'bye_count' => $byeCount];
    }
}
