<?php

namespace App\Services;

use App\Models\EventResult;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class EventStampService
{
    public function totalForUser(string $userId): int
    {
        return Cache::remember("event-stamp-total:{$userId}", 300, function () use ($userId) {
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

                return $eventRows
                    ->sortBy([
                        [$rankField, 'desc'],
                        ['id', 'asc'],
                    ])
                    ->values()
                    ->map(static function ($row) use (&$rank, &$count, &$beforeRankValue, $members, $rankField) {
                        $data = $row instanceof EventResult ? $row->toArray() : $row;
                        $rankValue = (int) $data[$rankField];
                        if ($beforeRankValue !== $rankValue) {
                            $rank = $count;
                        }

                        $data['event_rank'] = $rank;
                        $data['event_members'] = $members;
                        $beforeRankValue = $rankValue;
                        $count++;

                        return $data;
                    });
            })
            ->values();
    }

    public function stamp(array $row): int
    {
        $result = (string) $row['result'];
        $category = (string) $row['category'];
        $members = (int) $row['event_members'];
        $rank = (int) $row['event_rank'];
        $team = (int) $row['team'];
        $basePoint = $this->basePoint($members, $rank, $team);

        if ($result === 'm') {
            return $basePoint + 7 + (int) ceil($members / 8);
        }

        if ($result === 'e') {
            return 2;
        }

        if ($result === 'w') {
            return $basePoint + $this->winPoint($category, $team);
        }

        return $basePoint;
    }

    private function basePoint(int $members, int $rank, int $team): int
    {
        if ($members <= 7) {
            return 1;
        }

        $topRanks = (int) ceil($members / 4);

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
