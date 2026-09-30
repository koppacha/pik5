<?php

namespace App\Services\Tricks;

use App\Http\Controllers\TotalController;
use App\Models\Record;
use App\Models\Stage;
use App\Models\TrickCardHolder;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use Illuminate\Support\Facades\Cache;

class TrickHolderCatalog
{
    private const HISTORICAL_EVENTS = [
        160306, 160319, 160423, 160430, 160806, 170101, 170211,
        170325, 170429, 171013, 180101, 180901, 190802, 200723,
        200918, 211105, 221008,
    ];

    public function historicalCards(): array
    {
        return Cache::remember('tricks:historical-holders:v2', now()->addHour(), function (): array {
            $stageEvents = [];
            foreach (self::HISTORICAL_EVENTS as $eventId) {
                foreach (TotalController::stage_list((string) $eventId) as $stageId) {
                    $stageEvents[(int) $stageId] = $eventId;
                }
            }
            $stages = Stage::query()->whereIn('stage_id', array_keys($stageEvents))->get()->keyBy('stage_id');
            $records = Record::query()->whereIn('stage_id', array_keys($stageEvents))
                ->where('flg', '<', 2)
                ->where(function ($query) use ($stageEvents) {
                    foreach (self::HISTORICAL_EVENTS as $eventId) {
                        $query->orWhere(function ($eventQuery) use ($eventId, $stageEvents) {
                            $eventQuery->where('rule', $eventId)
                                ->whereIn('stage_id', array_keys(array_filter($stageEvents, fn ($id) => $id === $eventId)));
                        });
                    }
                })
                ->orderByDesc('score')->orderBy('created_at')->orderBy('post_id')->get()
                ->groupBy('stage_id');
            $bestByStage = [];
            $maximumByEvent = [];
            foreach ($records as $stageId => $rows) {
                $best = $rows->unique('user_id')->values();
                $bestByStage[$stageId] = $best;
                $eventId = $stageEvents[(int) $stageId];
                $maximumByEvent[$eventId] = max($maximumByEvent[$eventId] ?? 0, $best->count());
            }

            $cards = [];
            foreach ($bestByStage as $stageId => $best) {
                $eventId = $stageEvents[(int) $stageId];
                $previousScore = null;
                $rank = 0;
                $rankings = [];
                foreach ($best as $index => $record) {
                    if ($previousScore !== (int) $record->score) $rank = $index + 1;
                    $rankings[] = [
                        'post_id' => $record->post_id,
                        'unique_id' => $record->unique_id,
                        'user_id' => $record->user_id,
                        'score' => (int) $record->score,
                        'stage_id' => (int) $stageId,
                        'rule' => $eventId,
                        'console' => $record->console,
                        'region' => $record->region,
                        'post_rank' => $rank,
                        'rps' => $maximumByEvent[$eventId] - $rank + 1,
                        'created_at' => $record->created_at,
                    ];
                    $previousScore = (int) $record->score;
                }
                $holder = $best->first();
                $stage = $stages->get($stageId);
                $fullTitle = $stage?->stage_name ?? "ステージ #{$stageId}";
                $title = $fullTitle;
                $ruleName = '';
                if (preg_match('/^(.+?)[（(](.+)[）)](.*)$/u', $fullTitle, $parts)) {
                    $title = trim($parts[1].$parts[3]);
                    $ruleName = trim($parts[2]);
                }
                $cards[] = [
                    'id' => (int) $stageId,
                    'event_id' => $eventId,
                    'stage_id' => (int) $stageId,
                    'title' => $title,
                    'rule_name' => $ruleName,
                    'text' => $stage?->stage_sub ?? '',
                    'difficulty' => null,
                    'rarity' => 1,
                    'creator' => null,
                    'taker' => null,
                    'holders' => [$holder->user_id],
                    'rank_points' => $maximumByEvent[$eventId],
                    'rankings' => $rankings,
                ];
            }

            return $cards;
        });
    }

    public function historicalCounts(): array
    {
        $counts = [];
        foreach ($this->historicalCards() as $card) {
            $holder = $card['holders'][0];
            $counts[$holder] = ($counts[$holder] ?? 0) + 1;
        }

        return $counts;
    }

    public function counts(): array
    {
        $counts = $this->historicalCounts();
        $current = TrickCardHolder::query()->join('trick_events', 'trick_events.event_id', '=', 'trick_card_holders.event_id')
            ->where('trick_events.test_mode', false)
            ->where('trick_events.title', 'like', '%期間限定ランキング%')
            ->whereNotIn('trick_events.event_id', self::HISTORICAL_EVENTS)
            ->selectRaw('trick_card_holders.player_name, COUNT(*) as aggregate')
            ->groupBy('trick_card_holders.player_name')->pluck('aggregate', 'player_name');
        foreach ($current as $userId => $count) $counts[$userId] = ($counts[$userId] ?? 0) + (int) $count;

        return $counts;
    }

    public function cardsFor(string $userId, TrickStateService $state, TrickRecordService $records): array
    {
        $cards = array_values(array_filter($this->historicalCards(), fn ($card) => $card['holders'][0] === $userId));
        $events = TrickEvent::query()->where('state', 'ended')->where('test_mode', false)
            ->where('title', 'like', '%期間限定ランキング%')
            ->whereNotIn('event_id', self::HISTORICAL_EVENTS)->pluck('event_id');
        foreach ($events as $eventId) {
            $heldIds = TrickCardHolder::query()->where('event_id', $eventId)
                ->where('player_name', $userId)->pluck('event_card_id');
            $eventCards = TrickEventCard::query()->with('deck')->whereIn('id', $heldIds)
                ->where('state', '_collected')->get();
            $rankings = $records->rankingsByCards($eventCards);
            foreach ($eventCards as $card) {
                $rows = $rankings[$card->id] ?? [];
                $own = collect($rows)->firstWhere('user_id', $userId);
                $cards[] = [
                    ...$state->normalizeCard($card),
                    'holders' => [$userId],
                    'rank_points' => (int) ($own['rps'] ?? 0),
                    'rankings' => $rows,
                ];
            }
        }
        usort($cards, fn ($a, $b) => ($b['rank_points'] <=> $a['rank_points']) ?: ($b['stage_id'] <=> $a['stage_id']));

        return $cards;
    }
}
