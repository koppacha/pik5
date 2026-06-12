<?php

namespace Tests\Unit;

use App\Services\EventStampService;
use PHPUnit\Framework\TestCase;

class EventStampServiceTest extends TestCase
{
    private EventStampService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new EventStampService();
    }

    public function test_it_ranks_limited_events_by_rps_and_other_events_by_score(): void
    {
        $rows = collect([
            $this->row(1, '期間限定ランキング', 'a', 100, 10),
            $this->row(1, '期間限定ランキング', 'b', 50, 30),
            $this->row(1, '期間限定ランキング', 'c', 200, 30),
            $this->row(2, 'その他', 'd', 100, 30),
            $this->row(2, 'その他', 'e', 50, 100),
        ]);

        $ranked = $this->service->withEventRanks($rows)->keyBy('user_id');

        $this->assertSame(3, $ranked['a']['event_rank']);
        $this->assertSame(1, $ranked['b']['event_rank']);
        $this->assertSame(1, $ranked['c']['event_rank']);
        $this->assertSame(1, $ranked['d']['event_rank']);
        $this->assertSame(2, $ranked['e']['event_rank']);
    }

    public function test_participation_uses_the_ranked_base_point(): void
    {
        $this->assertSame(1, $this->service->stamp($this->stampRow('p', 'その他', 7, 1)));
        $this->assertSame(3, $this->service->stamp($this->stampRow('p', 'その他', 8, 1)));
        $this->assertSame(2, $this->service->stamp($this->stampRow('p', 'その他', 8, 2)));
        $this->assertSame(1, $this->service->stamp($this->stampRow('p', 'その他', 8, 3)));
        $this->assertSame(6, $this->service->stamp($this->stampRow('p', 'その他', 20, 1)));
        $this->assertSame(2, $this->service->stamp($this->stampRow('p', 'その他', 20, 5)));
        $this->assertSame(1, $this->service->stamp($this->stampRow('p', 'その他', 20, 6)));
    }

    public function test_team_participation_uses_the_unranked_base_point(): void
    {
        $this->assertSame(1, $this->service->stamp($this->stampRow('p', 'その他', 7, 1, 1)));
        $this->assertSame(2, $this->service->stamp($this->stampRow('p', 'その他', 8, 1, 1)));
        $this->assertSame(2, $this->service->stamp($this->stampRow('p', 'その他', 8, 8, 1)));
        $this->assertSame(5, $this->service->stamp($this->stampRow('p', 'その他', 20, 1, 1)));
        $this->assertSame(5, $this->service->stamp($this->stampRow('p', 'その他', 20, 20, 1)));
    }

    public function test_special_result_replaces_the_base_point(): void
    {
        $this->assertSame(2, $this->service->stamp($this->stampRow('e', 'その他', 20, 1)));
    }

    public function test_mvp_adds_its_bonus_to_the_base_point(): void
    {
        $this->assertSame(11, $this->service->stamp($this->stampRow('m', 'その他', 8, 1)));
        $this->assertSame(13, $this->service->stamp($this->stampRow('m', 'その他', 9, 1)));
        $this->assertSame(15, $this->service->stamp($this->stampRow('m', 'その他', 20, 20, 1)));
    }

    /**
     * @dataProvider winPointProvider
     */
    public function test_win_adds_the_category_win_point(string $category, int $team, int $expected): void
    {
        $this->assertSame($expected, $this->service->stamp($this->stampRow('w', $category, 20, 1, $team)));
    }

    public function winPointProvider(): array
    {
        return [
            'challenge relay team' => ['チャレンジリレー', 1, 7],
            'challenge relay solo' => ['チャレンジリレー', 0, 10],
            'rta team' => ['RTA並走会', 1, 9],
            'rta solo' => ['RTA並走会', 0, 12],
            'limited team' => ['期間限定ランキング', 1, 9],
            'limited solo' => ['期間限定ランキング', 0, 12],
            'other team' => ['その他', 1, 7],
            'other solo' => ['その他', 0, 8],
        ];
    }

    private function row(int $eventId, string $category, string $userId, int $score, int $rps): array
    {
        return [
            'id' => ord($userId),
            'event_id' => $eventId,
            'category' => $category,
            'user_id' => $userId,
            'score' => $score,
            'rps' => $rps,
        ];
    }

    private function stampRow(
        string $result,
        string $category,
        int $members,
        int $rank,
        int $team = 0
    ): array {
        return [
            'result' => $result,
            'category' => $category,
            'event_members' => $members,
            'event_rank' => $rank,
            'team' => $team,
        ];
    }
}
