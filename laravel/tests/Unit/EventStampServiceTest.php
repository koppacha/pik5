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

    public function test_limited_events_use_half_the_members_and_keep_the_small_event_exception(): void
    {
        $this->assertSame(1, $this->service->stamp($this->stampRow('p', '期間限定ランキング', 7, 1)));
        foreach ([1 => 9, 2 => 8, 5 => 5, 8 => 2, 9 => 1, 15 => 1] as $rank => $expected) {
            $this->assertSame($expected, $this->service->stamp($this->stampRow('p', '期間限定ランキング', 15, $rank)));
        }
        $this->assertSame(8, $this->service->stamp($this->stampRow('p', '期間限定ランキング', 15, 15, 1)));
    }

    public function test_award_bonus_depends_on_the_limited_format_and_early_winners_only_receive_w(): void
    {
        $row = $this->stampRow('m', '期間限定ランキング', 16, 1);
        foreach ([170101 => 15, 190802 => 18, 261009 => 22] as $eventId => $expected) {
            $row['event_id'] = $eventId;
            $this->assertSame($expected, $this->service->stamp($row));
        }
        foreach ([160306, 160319, 160423, 160430, 160806] as $eventId) {
            $row['event_id'] = $eventId;
            $row['result'] = 'w';
            $this->assertSame(15, $this->service->stamp($row));
        }
    }

    public function test_first_limited_event_always_grants_zero_without_affecting_other_events(): void
    {
        foreach (['p', 'w', 'm', 'h', 'b', 'e'] as $result) {
            $row = $this->stampRow($result, '期間限定ランキング', 16, 1);
            $row['event_id'] = 151101;
            $this->assertSame(0, $this->service->stamp($row));
        }
        $row = $this->stampRow('w', 'その他', 16, 1);
        $row['event_id'] = 151101;
        $this->assertSame(7, $this->service->stamp($row));
    }

    public function test_winning_team_mvp_receives_w_but_losing_team_mvp_does_not(): void
    {
        $rows = collect();
        for ($i = 0; $i < 16; $i++) {
            $row = $this->stampRow('p', '期間限定ランキング', 16, $i + 1, $i < 8 ? 1 : 2);
            $row += ['id' => $i, 'user_id' => 'test-'.$i, 'score' => 0, 'rps' => 16 - $i];
            $row['event_id'] = 211105;
            $row['result'] = $i === 0 || $i === 8 ? 'm' : ($i < 8 ? 'w' : 'p');
            $rows->push($row);
        }
        $ranked = $this->service->withEventRanks($rows)->keyBy('user_id');
        $this->assertSame(21, $this->service->stamp($ranked['test-0']));
        $this->assertSame(12, $this->service->stamp($ranked['test-1']));
        $this->assertSame(17, $this->service->stamp($ranked['test-8']));
        $this->assertSame(8, $this->service->stamp($ranked['test-9']));
    }

    public function test_special_result_replaces_the_base_point(): void
    {
        $this->assertSame(2, $this->service->stamp($this->stampRow('e', 'その他', 20, 1)));
    }

    public function test_mvp_adds_its_bonus_to_the_base_point(): void
    {
        $this->assertSame(8, $this->service->stamp($this->stampRow('m', 'その他', 8, 1)));
        $this->assertSame(10, $this->service->stamp($this->stampRow('m', 'その他', 9, 1)));
        $this->assertSame(12, $this->service->stamp($this->stampRow('m', 'その他', 20, 20, 1)));
    }

    public function test_top_holder_receives_the_mvp_formula_and_both_awards_double_it(): void
    {
        foreach ([1, 2, 8] as $rank) {
            $single = $this->service->stamp($this->stampRow('m', '期間限定ランキング', 15, $rank));
            $this->assertSame($single, $this->service->stamp($this->stampRow('h', '期間限定ランキング', 15, $rank)));
            $this->assertSame(2 * $single, $this->service->stamp($this->stampRow('b', '期間限定ランキング', 15, $rank)));
        }
        $this->assertSame(22, $this->service->stamp($this->stampRow('m', '期間限定ランキング', 15, 1)));
        $this->assertSame(21, $this->service->stamp($this->stampRow('h', '期間限定ランキング', 15, 2)));
        $this->assertSame(44, $this->service->stamp($this->stampRow('b', '期間限定ランキング', 15, 1)));
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
            'limited team' => ['期間限定ランキング', 1, 14],
            'limited solo' => ['期間限定ランキング', 0, 17],
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
            'event_id' => 261009,
        ];
    }
}
