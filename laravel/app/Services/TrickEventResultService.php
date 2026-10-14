<?php

namespace App\Services;

use App\Models\EventResult;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class TrickEventResultService
{
    public const EVENT_ID = 261009;
    private const CATEGORY = '期間限定ランキング';

    /** Import frozen results only. Never modify the tournament or its records. */
    public function import(bool $persist = true): array
    {
        $event = DB::table('trick_events')->where('event_id', self::EVENT_ID)->first();
        if (!$event || !$event->ended_at || now()->lessThan($event->end_at)) {
            throw new RuntimeException('The tournament must be finalized before importing results.');
        }
        if (DB::table('trick_event_cards')->where('event_id', self::EVENT_ID)->where('state', '_field')->exists()) {
            throw new RuntimeException('Uncollected field cards remain.');
        }

        $players = DB::table('players')->where('event_id', self::EVENT_ID)
            ->orderBy('name')->get(['name', 'rank_points']);
        if ($players->isEmpty()) {
            throw new RuntimeException('No tournament participants.');
        }
        $points = $players->mapWithKeys(static fn ($player) => [(string) $player->name => (int) $player->rank_points])->all();
        $firstPlaces = array_fill_keys(array_keys($points), 0);
        $logPoints = $firstPlaces;
        $collectedIds = DB::table('trick_event_cards')->where('event_id', self::EVENT_ID)
            ->whereNotNull('collected_at')->orderBy('id')->pluck('id')->map(static fn ($id) => (int) $id)->all();
        $logs = DB::table('limit_logs')->where('event_id', self::EVENT_ID)->where('event', 'collect')
            ->orderBy('event_card_id')->get(['event_card_id', 'context']);
        $logIds = $logs->pluck('event_card_id')->map(static fn ($id) => (int) $id)->all();
        if ($collectedIds === [] || $collectedIds !== $logIds) {
            throw new RuntimeException('Collection snapshots are missing or duplicated.');
        }
        foreach ($logs as $log) {
            $context = json_decode($log->context, true, 512, JSON_THROW_ON_ERROR);
            if (!isset($context['rankings']) || !is_array($context['rankings'])) {
                throw new RuntimeException('Invalid collection snapshot.');
            }
            $seen = [];
            foreach ($context['rankings'] as $ranking) {
                $name = (string) ($ranking['user_id'] ?? '');
                if (!array_key_exists($name, $points) || isset($seen[$name])
                    || !isset($ranking['rank'], $ranking['rps'])
                    || !is_int($ranking['rank']) || $ranking['rank'] < 1
                    || !is_int($ranking['rps']) || $ranking['rps'] < 0) {
                    throw new RuntimeException('Invalid ranked participant in collection snapshot.');
                }
                $seen[$name] = true;
                $logPoints[$name] += $ranking['rps'];
                if ($ranking['rank'] === 1) {
                    $firstPlaces[$name]++;
                }
            }
        }
        if ($logPoints !== $points) {
            throw new RuntimeException('Frozen rank points do not match participant totals.');
        }

        $maxPoints = max($points);
        $maxFirstPlaces = max($firstPlaces);
        $rows = [];
        foreach ($points as $name => $rankPoints) {
            $mvp = $maxPoints > 0 && $rankPoints === $maxPoints;
            $topHolder = $maxFirstPlaces > 0 && $firstPlaces[$name] === $maxFirstPlaces;
            $result = $mvp && $topHolder ? 'b' : ($mvp ? 'm' : ($topHolder ? 'h' : 'p'));
            $rows[] = [
                'event_id' => self::EVENT_ID,
                'event_title' => '第19回期間限定ランキング',
                'sub_title' => 'トリックテイキング制',
                'category' => self::CATEGORY,
                'user_id' => $name,
                'team' => 0,
                // Mixed stage scores have no meaningful raw-score total in this format.
                'score' => 0,
                'rps' => $rankPoints,
                'rps_adjust' => $rankPoints,
                'result' => $result,
            ];
        }
        if ($persist) {
            DB::transaction(static function () use ($rows, $points) {
                $existing = EventResult::where('event_id', self::EVENT_ID)->where('category', self::CATEGORY)
                    ->lockForUpdate()->get();
                if ($existing->pluck('user_id')->diff(array_keys($points))->isNotEmpty()
                    || $existing->pluck('user_id')->duplicates()->isNotEmpty()) {
                    throw new RuntimeException('Unexpected existing tournament results.');
                }
                foreach ($rows as $row) {
                    EventResult::updateOrCreate([
                        'event_id' => self::EVENT_ID,
                        'category' => self::CATEGORY,
                        'user_id' => $row['user_id'],
                    ], $row);
                }
            });
            foreach (array_keys($points) as $name) {
                Cache::forget("event-stamp-total:{$name}");
            }
        }

        return ['rows' => $rows, 'first_place_cards' => $firstPlaces, 'collected_cards' => count($collectedIds)];
    }
}
