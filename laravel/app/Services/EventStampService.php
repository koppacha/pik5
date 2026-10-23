<?php

namespace App\Services;

use App\Models\EventResult;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class EventStampService
{
    public function totalForUser(string $userId): int
    {
        return Cache::remember("event-stamp-total:{$userId}", 60, function () use ($userId) {
            return $this->withEventRanks(EventResult::all())
                ->where('user_id', $userId)
                ->sum(fn (array $row) => $this->stamp($row));
        });
    }

    public function withEventRanks(Collection $rows): Collection
    {
        return $rows
            ->groupBy('event_id')
            ->flatMap(static function (Collection $eventRows) {
                $rank = 1;
                $count = 1;
                $beforeRankValue = null;
                $members = $eventRows->count();
                $firstRow = $eventRows->first();
                $firstData = $firstRow instanceof EventResult ? $firstRow->toArray() : $firstRow;
                $rankField = (string) $firstData['category'] === '期間限定ランキング' ? 'rps' : 'score';
                // MVP replaces the winner code, so recover team victory from teammates.
                $winningTeams = $eventRows->filter(static fn ($row) => ($row['result'] ?? '') === 'w' && (int) ($row['team'] ?? 0) !== 0)
                    ->pluck('team')->map(static fn ($team) => (int) $team)->unique()->all();

                return $eventRows
                    ->sortBy([
                        [$rankField, 'desc'],
                        ['id', 'asc'],
                    ])
                    ->values()
                    ->map(static function ($row) use (&$rank, &$count, &$beforeRankValue, $members, $rankField, $winningTeams) {
                        $data = $row instanceof EventResult ? $row->toArray() : $row;
                        $rankValue = (int) $data[$rankField];
                        if ($beforeRankValue !== $rankValue) {
                            $rank = $count;
                        }

                        $data['event_rank'] = $rank;
                        $data['event_members'] = $members;
                        $data['event_winning_team'] = in_array((int) ($data['team'] ?? 0), $winningTeams, true);
                        $beforeRankValue = $rankValue;
                        $count++;

                        return $data;
                    });
            })
            ->values();
    }

    public function stamp(array $row): int
    {
        // The first event has a display-only dummy result. Keep its marker, but grant no stamps.
        if ((int) ($row['event_id'] ?? 0) === 151101 && (string) $row['category'] === '期間限定ランキング') {
            return 0;
        }

        $result = (string) $row['result'];
        $category = (string) $row['category'];
        $members = (int) $row['event_members'];
        $rank = (int) $row['event_rank'];
        $team = (int) $row['team'];
        $basePoint = $this->basePoint($members, $rank, $team, $category);

        if (in_array($result, ['m', 'h', 'b'], true)) {
            // b records both awards; each grants the complete MVP stamp amount.
            $bonus = 4;
            if ($category === '期間限定ランキング') {
                $eventId = (int) ($row['event_id'] ?? 0);
                $subTitle = (string) ($row['sub_title'] ?? '');
                if (in_array($eventId, [180901, 190802, 200723, 200918, 211105, 221008], true)
                    || str_contains($subTitle, 'エリア踏破')) {
                    $bonus += 3;
                } elseif ($eventId === 261009 || str_contains($subTitle, 'トリックテイキング')) {
                    $bonus += 7;
                }
            }
            $awardPoint = $basePoint + $bonus + (int) ceil($members / 8);
            if ($team !== 0 && ($row['event_winning_team'] ?? false)) {
                $awardPoint += $this->winPoint($category, $team);
            }

            return $result === 'b' ? 2 * $awardPoint : $awardPoint;
        }

        if ($result === 'e') {
            return 2;
        }

        if ($result === 'w') {
            return $basePoint + $this->winPoint($category, $team);
        }

        return $basePoint;
    }

    private function basePoint(int $members, int $rank, int $team, string $category): int
    {
        if ($members <= 7) {
            return 1;
        }

        $topRanks = (int) ceil($members / ($category === '期間限定ランキング' ? 2 : 4));

        if ($team !== 0) {
            return $topRanks;
        }

        return $rank <= $topRanks ? $topRanks + 2 - $rank : 1;
    }

    private function winPoint(string $category, int $team): int
    {
        if ($category === 'チャレンジリレー') {
            return $team !== 0 ? 2 : 4;
        }

        if ($category === 'RTA並走会' || $category === '期間限定ランキング') {
            return $team !== 0 ? 4 : 6;
        }

        return 2;
    }
}
