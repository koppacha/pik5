<?php

namespace App\Http\Controllers;

use App\Models\Battle;
use App\Models\EventResult;
use App\Services\EventStampService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class EventResultController extends Controller
{
    private const CATEGORY_NAME_IDS = [
        '期間限定ランキング' => 151,
        '旧日替わりチャレンジ' => 161,
        '全ステージ一本勝負' => 191,
        'タマゴムシ取り大会' => 211,
        'RTA並走会' => 231,
        'ダンドリバトル大会' => 241,
        'チャレンジリレー' => 242,
        'その他' => 251,
        'インスタント研究会' => 261,
        'ピクチャレアリーナ対戦' => 262,
    ];

    private const EVENT_CATEGORY_FALLBACKS = [
        151101 => 151,
        161022 => 161,
        190209 => 191,
        190321 => 191,
        210829 => 211,
        260704 => 151,
    ];

    private const CATEGORY_MAP = [
        151 => ['期間限定ランキング'],
        161 => ['旧日替わりチャレンジ'],
        191 => ['全ステージ一本勝負'],
        200 => ['インスタント研究会', 'ダンドリバトル大会', 'チャレンジリレー', 'RTA並走会', 'タマゴムシ取り大会', 'その他'],
        211 => ['タマゴムシ取り大会'],
        231 => ['RTA並走会'],
        241 => ['ダンドリバトル大会'],
        242 => ['チャレンジリレー'],
        251 => ['その他'],
        261 => ['インスタント研究会'],
        262 => ['ピクチャレアリーナ対戦'],
    ];

    private const SCORE_RANK_CATEGORY_IDS = [161, 191, 211, 241, 261, 262];

    public function show(Request $request, EventStampService $eventStampService, ?string $category = null): JsonResponse
    {
        $categoryId = $this->normalizeCategory($category);
        if ($categoryId === null) {
            return response()->json(['message' => 'Invalid category'], 404);
        }

        $rows = $this->eventRows($categoryId);
        $rankedRows = $eventStampService->withEventRanks($rows);
        $battleScores = $categoryId === 241 ? $this->latestBattleScores() : [];

        $users = [];
        foreach ($rankedRows as $row) {
            $userId = (string)$row['user_id'];
            if (!isset($users[$userId])) {
                $users[$userId] = [
                    'user_id' => $userId,
                    'score' => 0,
                    'rps' => 0,
                    'rps_adjust' => 0,
                    'stamp' => 0,
                    'events' => [],
                    'category' => 'event-total',
                    'last_event_id' => 0,
                    'created_at' => null,
                ];
            }

            $stamp = $eventStampService->stamp($row);
            $eventId = (int)$row['event_id'];
            $users[$userId]['score'] += $this->score($row);
            $users[$userId]['rps'] += (int)$row['rps'];
            $users[$userId]['rps_adjust'] += (int)$row['rps_adjust'];
            $users[$userId]['stamp'] += $stamp;
            if ($eventId > (int)$users[$userId]['last_event_id']) {
                $users[$userId]['last_event_id'] = $eventId;
                $users[$userId]['created_at'] = $this->eventDate($eventId);
            }
            $users[$userId]['events'][] = [
                'event_id' => $eventId,
                'result' => (string)$row['result'],
                'stamp' => $stamp,
                'team' => (int)$row['team'],
                'category' => (string)$row['category'],
                'event_title' => (string)$row['event_title'],
                'sub_title' => (string)($row['sub_title'] ?? ''),
            ];
        }

        if ($categoryId === 241) {
            foreach ($battleScores as $userId => $score) {
                if (!isset($users[$userId])) {
                    $users[$userId] = [
                        'user_id' => $userId,
                        'score' => 0,
                        'rps' => 0,
                        'rps_adjust' => 0,
                        'stamp' => 0,
                        'events' => [],
                        'category' => 'event-total',
                        'last_event_id' => 0,
                        'created_at' => null,
                    ];
                }
                $users[$userId]['score'] = $score;
            }
        }

        $ranking = $this->rankedUsers(array_values($users), $categoryId);

        return response()->json([
            'category' => $categoryId,
            'posts' => $ranking,
            'events' => $this->events($rows),
            'last_updated_at' => collect($ranking)->max('created_at'),
        ]);
    }

    public function category(int $event): JsonResponse
    {
        $category = EventResult::where('event_id', $event)->value('category');
        $categoryId = self::CATEGORY_NAME_IDS[$category] ?? self::EVENT_CATEGORY_FALLBACKS[$event] ?? null;

        if ($categoryId === null) {
            return response()->json(['message' => 'Event category not found'], 404);
        }

        return response()->json(['category' => $categoryId]);
    }

    private function normalizeCategory(?string $category): ?int
    {
        if ($category === null || $category === '') {
            return 0;
        }

        if (!ctype_digit($category)) {
            return null;
        }

        $value = (int)$category;
        if ($value === 0) {
            return 0;
        }

        return strlen($category) === 3 ? $value : null;
    }

    private function eventRows(int $categoryId): Collection
    {
        if ($categoryId !== 0 && !isset(self::CATEGORY_MAP[$categoryId])) {
            return collect();
        }

        $query = EventResult::query();
        if ($categoryId !== 0) {
            $query->whereIn('category', self::CATEGORY_MAP[$categoryId]);
        }

        return $query
            ->orderBy('event_id')
            ->orderByDesc('score')
            ->orderBy('id')
            ->get()
            ->map(static function (EventResult $row) {
                $data = $row->toArray();
                if ((int)$data['event_id'] === 180901 && (int)$data['team'] === 0) {
                    $data['team'] = 999;
                }

                return $data;
            });
    }

    private function score(array $row): int
    {
        if ((string)$row['category'] === 'インスタント研究会' && (string)$row['result'] !== 'w') {
            return 0;
        }

        return (int)$row['score'];
    }

    private function latestBattleScores(): array
    {
        return Battle::orderByDesc('session_id')
            ->orderByDesc('battle_id')
            ->get()
            ->unique('user_id')
            ->mapWithKeys(static function (Battle $battle) {
                return [(string)$battle['user_id'] => (int)$battle['result_point']];
            })
            ->all();
    }

    private function eventDate(int $eventId): string
    {
        $value = str_pad((string)$eventId, 6, '0', STR_PAD_LEFT);
        $year = (int)substr($value, 0, 2);
        $prefix = $year >= 70 ? '19' : '20';

        return sprintf(
            '%s%s-%s-%s 00:00:00',
            $prefix,
            substr($value, 0, 2),
            substr($value, 2, 2),
            substr($value, 4, 2),
        );
    }

    private function rankedUsers(array $users, int $categoryId): array
    {
        $sortKey = $this->sortKey($categoryId);
        usort($users, static function ($a, $b) use ($sortKey) {
            return ($b[$sortKey] <=> $a[$sortKey]) ?: strcmp($a['user_id'], $b['user_id']);
        });

        $rank = 1;
        $count = 1;
        $before = null;
        foreach ($users as $key => $user) {
            $value = (int)$user[$sortKey];
            if ($before !== $value) {
                $rank = $count;
            }
            $users[$key]['post_rank'] = $rank;
            $users[$key]['sort_key'] = $sortKey;
            $before = $value;
            $count++;
        }

        return $users;
    }

    private function sortKey(int $categoryId): string
    {
        if ($categoryId === 151) {
            return 'rps_adjust';
        }

        if (in_array($categoryId, self::SCORE_RANK_CATEGORY_IDS, true)) {
            return 'score';
        }

        return 'stamp';
    }

    private function events(Collection $rows): array
    {
        return $rows
            ->groupBy('event_id')
            ->map(static function (Collection $eventRows, $eventId) {
                $first = $eventRows->first();
                return [
                    'event_id' => (int)$eventId,
                    'event_title' => (string)$first['event_title'],
                    'sub_title' => (string)($first['sub_title'] ?? ''),
                    'category' => (string)$first['category'],
                ];
            })
            ->values()
            ->all();
    }
}
