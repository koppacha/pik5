<?php

namespace App\Services;

use App\Models\EventResult;
use App\Models\Record;
use App\Models\Stage;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LimitedEventResultService
{
    private const CATEGORY = '期間限定ランキング';

    private const EVENT_IDS = [
        151101, 160306, 160319, 160423, 160430, 160806,
        170101, 170211, 170325, 170429, 171013, 180101,
        180901, 190802, 200723, 200918, 211105, 221008,
    ];

    private const STANDARD_EVENT_IDS = [
        151101, 160306, 160319, 160423, 160430, 160806,
    ];

    private const TEAM_POINT_EVENT_IDS = [
        170101, 170211, 170325, 170429, 171013, 180101,
        200723, 200918, 211105,
    ];

    private const AREA_TEAM_EVENT_IDS = [
        200723, 200918, 211105, 221008,
    ];

    private const TITLE_BY_EVENT_ID = [
        151101 => '第1回期間限定ランキング',
        160306 => '第2回期間限定ランキング',
        160319 => '第3回期間限定ランキング',
        160423 => '第4回期間限定ランキング',
        160430 => '第5回期間限定ランキング',
        160806 => '第6回期間限定ランキング',
        170101 => '第7回期間限定ランキング',
        170211 => '第8回期間限定ランキング',
        170325 => '第9回期間限定ランキング',
        170429 => '第10回期間限定ランキング',
        171013 => '第11回期間限定ランキング',
        180101 => '第12回期間限定ランキング',
        180901 => '第13回期間限定ランキング',
        190802 => '第14回期間限定ランキング',
        200723 => '第15回期間限定ランキング',
        200918 => '第16回期間限定ランキング',
        211105 => '第17回期間限定ランキング',
        221008 => '第18回期間限定ランキング',
    ];

    private const SUB_TITLE_BY_EVENT_ID = [
        151101 => 'スタンダード制',
        160306 => 'スタンダード制',
        160319 => 'スタンダード制',
        160423 => 'スタンダード制',
        160430 => 'スタンダード制',
        160806 => 'スタンダード制',
        170101 => 'チーム対抗制',
        170211 => 'チーム対抗制',
        170325 => 'チーム対抗制×短期決戦',
        170429 => 'チーム対抗制×ピンポイント戦',
        171013 => 'チーム対抗制×代表選抜戦',
        180101 => 'チーム対抗制×ブラインド戦',
        180901 => 'エリア踏破制×協力戦',
        190802 => 'エリア踏破制×スタンダード',
        200723 => 'エリア踏破制×チーム対抗戦',
        200918 => 'エリア踏破制×チーム対抗戦',
        211105 => 'エリア踏破制×マイニング戦',
        221008 => 'エリア踏破制×チーム対抗戦',
    ];

    public function recalculatePastLimitedResults(bool $persist = true): array
    {
        $eventIds = self::EVENT_IDS;
        $results = collect();
        $holders = [];

        foreach ($eventIds as $eventId) {
            $event = $this->buildEventResults($eventId);
            $results = $results->merge($event['results']);
            $holders += $event['holders'];
        }

        if ($persist) {
            DB::transaction(static function () use ($eventIds, $results, $holders) {
                EventResult::where('category', self::CATEGORY)
                    ->whereIn('event_id', $eventIds)
                    ->delete();

                foreach ($results->values()->chunk(500) as $chunk) {
                    EventResult::insert($chunk->all());
                }

                Stage::whereIn('parent', $eventIds)->update(['holder' => null]);
                foreach ($holders as $stageId => $holder) {
                    Stage::where('stage_id', $stageId)->update(['holder' => $holder]);
                }
            });
        }

        return [
            'events' => count($eventIds),
            'results' => $results->count(),
            'holders' => count($holders),
        ];
    }

    private function buildEventResults(int $eventId): array
    {
        $stages = Stage::where('parent', $eventId)
            ->orderBy('stage_id')
            ->get()
            ->keyBy('stage_id');

        if ($stages->isEmpty()) {
            return ['results' => collect(), 'holders' => []];
        }

        $records = Record::where('rule', $eventId)
            ->whereIn('stage_id', $stages->keys()->all())
            ->where('flg', '<', 2)
            ->orderByDesc('score')
            ->orderBy('created_at')
            ->get();

        if ($records->isEmpty()) {
            return ['results' => collect(), 'holders' => []];
        }

        $teamByUser = $this->teamByUser($records);
        $eventMember = $records->pluck('user_id')->unique()->count();
        $rankedByStage = $this->rankedBestRecordsByStage($records);
        $users = [];
        $holders = [];

        foreach ($rankedByStage as $stageId => $stageRecords) {
            $stage = $stages->get($stageId);
            $stageMember = count($stageRecords);

            foreach ($stageRecords as $index => $record) {
                if ($index === 0) {
                    $holders[$stageId] = $record['user_id'];
                }

                $userId = $record['user_id'];
                $team = $teamByUser[$userId] ?? (int)$record['team'];

                if (!isset($users[$userId])) {
                    $users[$userId] = [
                        'event_id' => $eventId,
                        'event_title' => self::TITLE_BY_EVENT_ID[$eventId],
                        'sub_title' => self::SUB_TITLE_BY_EVENT_ID[$eventId],
                        'category' => self::CATEGORY,
                        'user_id' => $userId,
                        'team' => $team,
                        'score' => 0,
                        'rps' => 0,
                        'rps_adjust' => 0,
                        'result' => 'p',
                    ];
                }

                $users[$userId]['score'] += $this->scoreForTotal($eventId, (int)$record['score'], (int)$stage['series']);
                $users[$userId]['rps'] += $this->rankPoint($eventId, (int)$record['post_rank'], $stageMember, $eventMember);
                $users[$userId]['rps_adjust'] += $this->adjustedRankPoint((int)$record['post_rank'], $stageMember);
            }
        }

        $winners = $this->winnerUserIds($eventId, $users, $rankedByStage);
        $mvpUsers = $this->mvpUserIds($eventId, $users);

        foreach ($users as $userId => $user) {
            if (in_array($userId, $winners, true)) {
                $users[$userId]['result'] = 'w';
            }
            if (in_array($userId, $mvpUsers, true)) {
                $users[$userId]['result'] = 'm';
            }
        }

        return [
            'results' => collect(array_values($users)),
            'holders' => $holders,
        ];
    }

    private function teamByUser(Collection $records): array
    {
        return $records
            ->sortBy('created_at')
            ->groupBy('user_id')
            ->map(static function (Collection $userRecords) {
                $teamRecord = $userRecords->first(static function ($record) {
                    return (int)$record['team'] !== 0;
                });

                return $teamRecord ? (int)$teamRecord['team'] : 0;
            })
            ->all();
    }

    private function rankedBestRecordsByStage(Collection $records): array
    {
        $bestRecords = $records
            ->unique(static function ($record) {
                return $record['stage_id'] . '-' . $record['user_id'];
            })
            ->groupBy('stage_id');

        return $bestRecords
            ->map(function (Collection $stageRecords) {
                $rank = 1;
                $count = 1;
                $beforeScore = null;

                return $stageRecords
                    ->sortBy([
                        ['score', 'desc'],
                        ['created_at', 'asc'],
                    ])
                    ->values()
                    ->map(static function ($record) use (&$rank, &$count, &$beforeScore) {
                        if ($beforeScore !== (int)$record['score']) {
                            $rank = $count;
                        }

                        $data = $record->toArray();
                        $data['post_rank'] = $rank;
                        $beforeScore = (int)$record['score'];
                        $count++;

                        return $data;
                    })
                    ->all();
            })
            ->all();
    }

    private function scoreForTotal(int $eventId, int $score, int $stageSeries): int
    {
        if (in_array($eventId, self::STANDARD_EVENT_IDS, true) && $stageSeries === 1) {
            return $score * 100;
        }

        return $score;
    }

    private function rankPoint(int $eventId, int $rank, int $stageMember, int $eventMember): int
    {
        if ($eventId === 221008) {
            return $this->adjustedRankPoint($rank, $stageMember);
        }

        if (in_array($eventId, self::TEAM_POINT_EVENT_IDS, true)) {
            return $eventMember - $rank + 1;
        }

        return $stageMember - $rank + 1;
    }

    private function adjustedRankPoint(int $rank, int $stageMember): int
    {
        return ($stageMember - $rank + 1) + ($rank === 1 ? 1 : 0);
    }

    private function winnerUserIds(int $eventId, array $users, array $rankedByStage): array
    {
        if (in_array($eventId, self::STANDARD_EVENT_IDS, true)) {
            return $this->maxUserIds($users, 'score');
        }

        if (in_array($eventId, [170101, 170211, 170325, 170429, 171013, 180101], true)) {
            return $this->usersInWinningTeams($users, $this->teamScores($users, 'rps'));
        }

        if ($eventId === 180901) {
            return array_keys($users);
        }

        if ($eventId === 190802) {
            return $this->maxTerritoryUserIds($rankedByStage);
        }

        if (in_array($eventId, self::AREA_TEAM_EVENT_IDS, true)) {
            return $this->usersInWinningTeams($users, $this->teamTerritories($rankedByStage, count($users), $this->userTeams($users)));
        }

        return [];
    }

    private function mvpUserIds(int $eventId, array $users): array
    {
        if (in_array($eventId, self::STANDARD_EVENT_IDS, true)) {
            return [];
        }

        return $this->maxUserIds($users, 'rps');
    }

    private function maxUserIds(array $users, string $column): array
    {
        $max = max(array_column($users, $column));

        return array_values(array_map('strval', array_keys(array_filter($users, static function ($user) use ($column, $max) {
            return (int)$user[$column] === (int)$max;
        }))));
    }

    private function teamScores(array $users, string $column): array
    {
        $scores = [];
        foreach ($users as $user) {
            $team = (int)$user['team'];
            if ($team === 0) {
                continue;
            }
            $scores[$team] = ($scores[$team] ?? 0) + (int)$user[$column];
        }

        return $scores;
    }

    private function userTeams(array $users): array
    {
        return array_map(static function ($user) {
            return (int)$user['team'];
        }, $users);
    }

    private function usersInWinningTeams(array $users, array $teamScores): array
    {
        if (!$teamScores) {
            return [];
        }

        $max = max($teamScores);
        $winnerTeams = array_keys(array_filter($teamScores, static function ($score) use ($max) {
            return (int)$score === (int)$max;
        }));

        return array_values(array_map('strval', array_keys(array_filter($users, static function ($user) use ($winnerTeams) {
            return in_array((int)$user['team'], $winnerTeams, true);
        }))));
    }

    private function maxTerritoryUserIds(array $rankedByStage): array
    {
        $territories = [];
        foreach ($rankedByStage as $stageRecords) {
            if (!isset($stageRecords[0])) {
                continue;
            }
            $userId = $stageRecords[0]['user_id'];
            $territories[$userId] = ($territories[$userId] ?? 0) + 1;
        }

        if (!$territories) {
            return [];
        }

        $max = max($territories);

        return array_values(array_map('strval', array_keys(array_filter($territories, static function ($count) use ($max) {
            return (int)$count === (int)$max;
        }))));
    }

    private function teamTerritories(array $rankedByStage, int $eventMember, array $teamByUser): array
    {
        $territories = [];
        foreach ($rankedByStage as $stageRecords) {
            $scores = [];
            foreach ($stageRecords as $record) {
                $team = $teamByUser[$record['user_id']] ?? (int)$record['team'];
                if ($team === 0) {
                    continue;
                }
                $scores[$team] = ($scores[$team] ?? 0) + (int)$this->rankPoint(
                    (int)$record['rule'],
                    (int)$record['post_rank'],
                    count($stageRecords),
                    $eventMember
                );
            }

            if (!$scores) {
                continue;
            }

            $max = max($scores);
            foreach ($scores as $team => $score) {
                if ((int)$score === (int)$max) {
                    $territories[$team] = ($territories[$team] ?? 0) + 1;
                }
            }
        }

        return $territories;
    }
}
