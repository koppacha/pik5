<?php

namespace App\Services\Tricks;

use App\Models\Deck;
use App\Models\TrickEventCard;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TrickReplayService
{
    public function __construct(
        private readonly TrickStateService $normalizer,
        private readonly TrickRankCalculator $ranks,
        private readonly TrickRuleCalculator $rules,
        private readonly TrickRewardDistributor $rewards,
    ) {}

    private ?array $batchFiles = null;
    private ?array $batchMetadata = null;

    private function directory(int $eventId): string
    {
        abort_if($eventId <= 0, 404);
        return storage_path("app/tricks/replay/{$eventId}");
    }

    private function read(int $eventId, string $file): array
    {
        $cacheKey = "{$eventId}/{$file}";
        if ($this->batchFiles !== null && isset($this->batchFiles[$cacheKey])) return $this->batchFiles[$cacheKey];
        $path = $this->directory($eventId).'/'.$file;
        abort_unless(is_file($path), 404, 'Replay is not prepared');
        $raw = file_get_contents($path);
        if (str_ends_with($file, '.gz')) $raw = gzdecode($raw);
        $value = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if ($this->batchFiles !== null) {
            // Only retain the current checkpoint; eight independent raw states are unnecessary.
            if (str_starts_with($file, 'checkpoint-')) {
                foreach (array_keys($this->batchFiles) as $key) {
                    if (str_contains($key, '/checkpoint-')) unset($this->batchFiles[$key]);
                }
            }
            $this->batchFiles[$cacheKey] = $value;
        }
        return $value;
    }

    public function manifest(int $eventId): array
    {
        $manifest = $this->read($eventId, 'manifest.json');
        abort_unless(($manifest['version'] ?? null) === 1 && (int) $manifest['event_id'] === $eventId, 404);
        abort_if(CarbonImmutable::now('Asia/Tokyo')->lessThan(CarbonImmutable::parse($manifest['published_at'])), 403, 'Replay is not public yet');
        return $manifest;
    }

    public function index(int $eventId): array
    {
        $manifest = $this->manifest($eventId);
        $publicLogs = [];
        $subsidies = [];
        foreach ($this->read($eventId, 'catalog.json.gz')['public_logs'] as $entry) {
            $log = $entry['log'];
            if ($log['event'] === 'subsidy_paid') {
                $slot = $log['subsidy_slot'];
                $subsidies[$slot] = ($subsidies[$slot] ?? 0) + 1;
                $log['subsidy_recipient_count'] = $subsidies[$slot];
            }
            $publicLogs[$entry['cursor']] = array_intersect_key($log, array_flip(['id', 'event', 'actor_name', 'affected_player_name', 'card_id', 'card_title', 'rule_name', 'rarity', 'score', 'score_type', 'rank', 'created_at', 'records_count', 'top_user_id', 'subsidy_recipient_count', 'granted_points_total']));
        }
        return [
            ...array_intersect_key($manifest, array_flip(['version', 'event_id', 'title', 'start_at', 'end_at', 'ended_at', 'additions'])),
            'timeline' => array_map(fn ($entry) => [...$entry, 'log' => $publicLogs[$entry['cursor']] ?? null], $manifest['timeline']),
            'checkpoints' => array_map(fn ($entry, $index) => ['index' => $index, 'at' => $entry['at'], 'cursor' => $entry['cursor']], $manifest['checkpoints'], array_keys($manifest['checkpoints'])),
        ];
    }

    public function snapshot(int $eventId, ?int $frame, ?int $checkpoint): array
    {
        $manifest = $this->manifest($eventId);
        if ($frame !== null) {
            abort_unless(isset($manifest['timeline'][$frame]), 422, 'Unknown replay frame');
            $target = $manifest['timeline'][$frame];
            $source = $manifest['checkpoints'][0];
            foreach ($manifest['checkpoints'] as $candidate) {
                if ($candidate['cursor'] <= $target['cursor'] && $candidate['at'] <= $target['at']) $source = $candidate;
            }
        } else {
            abort_unless(isset($manifest['checkpoints'][$checkpoint ?? 0]), 422, 'Unknown checkpoint');
            $source = $manifest['checkpoints'][$checkpoint ?? 0];
            $target = $source;
        }
        // Only builder-owned filenames, never a request-controlled path.
        abort_unless(preg_match('/^checkpoint-\d{3}\.json\.gz$/', $source['file']), 404);
        $state = $this->read($eventId, $source['file']);
        if ($source['cursor'] < $target['cursor']) {
            $frames = $this->read($eventId, 'frames.json.gz');
            for ($i = $source['cursor']; $i < $target['cursor']; $i++) {
                $patch = $frames[$i]['patch'];
                foreach ($patch['maps'] as $key => $entries) {
                    foreach ($entries as $id => $value) $state[$key][$id] = $value;
                }
                foreach ($patch['values'] as $key => $value) $state[$key] = $value;
            }
        }
        $catalog = $this->read($eventId, 'catalog.json.gz');
        return $this->present($state, $catalog, $manifest, $target);
    }

    public function snapshots(int $eventId, string $mode, int $start, int $count): array
    {
        $manifest = $this->manifest($eventId);
        $steps = $mode === 'frame' ? $manifest['timeline'] : $manifest['checkpoints'];
        abort_unless(isset($steps[$start]), 422, 'Unknown replay cursor');
        $this->batchFiles = [];
        try {
            $snapshots = [];
            for ($index = $start; $index < min(count($steps), $start + $count); $index++) {
                $snapshots[] = $this->snapshot($eventId, $mode === 'frame' ? $index : null, $mode === 'checkpoint' ? $index : null);
            }
            return ['start' => $start, 'snapshots' => $snapshots];
        } finally {
            $this->batchFiles = null;
            $this->batchMetadata = null;
        }
    }

    private function metadata(array $catalog): array
    {
        if ($this->batchMetadata !== null) return $this->batchMetadata;
        $metadata = $catalog['metadata'];
        // Replays keep the latest evidence without exposing records' audit columns.
        if (Schema::hasTable('records') && $metadata !== []) {
            $rows = DB::table('records')->whereIn('unique_id', array_keys($metadata))
                ->orderBy('updated_at')->orderBy('post_id')
                ->get(['post_id', 'unique_id', 'console', 'post_comment', 'video_url', 'img_url', 'updated_at']);
            foreach ($rows as $row) {
                $key = (string) $row->unique_id;
                if ($row->updated_at >= ($metadata[$key]['updated_at'] ?? '')) {
                    $metadata[$key] = array_replace($metadata[$key], (array) $row);
                }
            }
        }
        if ($this->batchFiles !== null) $this->batchMetadata = $metadata;
        return $metadata;
    }

    private function present(array $state, array $catalog, array $manifest, array $target): array
    {
        $at = CarbonImmutable::parse($target['at']);
        $metadata = $this->metadata($catalog);
        $cards = [];
        foreach ($state['cards'] as $id => $raw) {
            $card = new TrickEventCard();
            $card->setRawAttributes(array_diff_key($raw, ['deck' => true]), true);
            $card->setRelation('deck', new Deck($raw['deck']));
            $cards[$id] = [...$this->normalizer->normalizeCard($card),
                'drawn_order' => $raw['drawn_order'], 'late_first_extension' => $raw['late_first_extension'],
                'my_can_post' => false, 'my_can_extend' => false, 'my_has_record' => false,
                'my_initial_post_cost' => null,
            ];
        }
        $rankings = [];
        $active = array_filter($state['records'], fn ($row) => $row['active']);
        $byCard = collect($active)->groupBy('event_card_id');
        foreach ($cards as $id => &$card) {
            $rows = $byCard->get($id, collect());
            $ascending = TrickScoreOrder::ascending(new Deck($state['cards'][$id]['deck']));
            $best = [];
            foreach ($rows as $row) {
                $user = $row['user_id'];
                if (!isset($best[$user]) || ($ascending ? $row['score'] < $best[$user]['score'] : $row['score'] > $best[$user]['score'])) $best[$user] = $row;
            }
            $ranks = $this->ranks->calculate(array_map(fn ($row) => (int) $row['score'], $best), $ascending);
            $values = [];
            foreach ($best as $user => $row) {
                $values[] = [...$row, 'rank' => $ranks[$user]['rank'], 'post_rank' => $ranks[$user]['rank'], 'rps' => $ranks[$user]['rank_points']];
            }
            usort($values, fn ($a, $b) => ($a['rank'] <=> $b['rank']) ?: ($a['post_id'] <=> $b['post_id']));
            if ($card['state'] === '_collected' && isset($state['final_rankings'][$id])) $values = $state['final_rankings'][$id];
            $rankings[$id] = array_map(function ($row) use ($metadata, $card) {
                $meta = $metadata[(string) ($row['unique_id'] ?? '')] ?? [];
                return [
                    ...array_intersect_key($meta, array_flip(['unique_id', 'rule', 'console', 'difficulty', 'region', 'post_comment', 'img_url', 'video_url', 'team'])),
                    ...array_intersect_key($row, array_flip(['post_id', 'unique_id', 'user_id', 'score', 'created_at', 'rank', 'post_rank', 'rps', 'provisional_reward_points'])),
                    'score_type' => $card['score_type'], 'stage_id' => $card['stage_id'],
                ];
            }, $values);
            $card['post_count'] = count($values);
            $card['participant_count'] = count($values);
            $card['top_player'] = $values[0]['user_id'] ?? null;
            $card['total_reward_points'] = $state['rewards'][$id] ?? 0;
            $card['holders'] = $state['holders'][$id] ?? [];
        }
        unset($card);
        $fieldIds = array_keys(array_filter($cards, fn ($card) => $card['state'] === '_field'));
        usort($fieldIds, fn ($a, $b) => (($cards[$a]['limit_at'] ?? '9999') <=> ($cards[$b]['limit_at'] ?? '9999')) ?: ($a <=> $b));
        $potTarget = null;
        foreach ($fieldIds as $id) if ($rankings[$id] !== []) { $potTarget = $id; break; }
        $provisional = [];
        foreach ($fieldIds as $id) {
            $card = &$cards[$id];
            $pot = $id === $potTarget ? $state['pot_points'] : 0;
            $total = $this->rules->totalReward((int) $card['stack_count'], (int) $card['paid_points_total'], count($rankings[$id]), $pot, (int) $card['rarity']);
            // Display the potential fund even before the first post, as the live mode does.
            $card['live_total_reward'] = $this->rules->totalReward((int) $card['stack_count'], (int) $card['paid_points_total'], 1, $pot, (int) $card['rarity']);
            $card['provisional_total_reward'] = $total;
            $card['provisional_pot_points'] = $pot;
            $groups = collect($rankings[$id])->groupBy('rank')->values()->map(fn ($group) => $group->pluck('user_id')->all())->all();
            $paid = $this->rewards->distribute($total, $groups);
            foreach ($rankings[$id] as &$row) {
                $row['provisional_reward_points'] = ($paid['distribution'][$row['user_id']] ?? 0) + ($row['user_id'] === $card['taker'] ? $paid['taker_remainder'] : 0);
                $provisional[$row['user_id']] = ($provisional[$row['user_id']] ?? 0) + $row['rps'];
            }
            unset($row);
            $card['provisional_taker_remainder'] = collect($rankings[$id])->contains('user_id', $card['taker']) ? 0 : $paid['taker_remainder'];
            $card['rankings'] = $rankings[$id];
            unset($card);
        }
        $hands = [];
        $holderCards = [];
        $historicalCounts = [];
        foreach ($cards as $id => $card) {
            if (!str_starts_with($card['state'], '_')) $hands[$card['state']][] = $card;
            foreach ($card['holders'] as $user) {
                $holderCards[] = [...$card, 'rankings' => $rankings[$id], 'player_name' => $user];
                $historicalCounts[$user] = ($historicalCounts[$user] ?? 0) + 1;
            }
        }
        foreach ($hands as &$hand) usort($hand, fn ($a, $b) => ($a['drawn_order'] <=> $b['drawn_order']) ?: ($a['id'] <=> $b['id']));
        unset($hand);
        $players = [];
        foreach ($state['players'] as $user => $raw) {
            $take = (int) $raw['take_count'];
            $handCount = count($hands[$user] ?? []);
            $confirmed = (int) $raw['rank_points'];
            $pending = $provisional[$user] ?? 0;
            $lastTake = $raw['last_take_at'] ? CarbonImmutable::parse($raw['last_take_at']) : null;
            $nextTake = $lastTake?->addMinutes(TrickTakeCooldownService::COOLDOWN_MINUTES);
            $players[] = [...$raw, 'card_count' => $handCount, 'collected_card_count' => $historicalCounts[$user] ?? 0,
                'confirmed_rank_points' => $confirmed, 'provisional_rank_points' => $pending, 'total_rank_points' => $confirmed + $pending,
                'take_level' => $this->rules->takeLevel($take), 'take_cost' => $this->rules->requiredHand($take), 'hand_limit' => $this->rules->handLimit($take),
                'balance_tax_threshold' => $this->rules->balanceTaxThreshold($take), 'balance_tax_eligible' => $raw['draw_points'] > $this->rules->balanceTaxThreshold($take),
                'subsidy_flag' => !$state['ended'] && $this->rules->recurringSubsidyEligible($raw['draw_points'], $handCount),
                'next_take_at' => $nextTake && $nextTake->greaterThan($at) && $at->lessThan(CarbonImmutable::parse($manifest['end_at'])->subMinutes(TrickTakeCooldownService::ENDGAME_FREE_MINUTES)) ? $nextTake->toIso8601String() : null,
            ];
        }
        usort($players, fn ($a, $b) => ($b['total_rank_points'] <=> $a['total_rank_points']) ?: strcmp($a['name'], $b['name']));
        $deck = array_filter($cards, fn ($card) => $card['state'] === '_deck');
        $difficultyCounts = array_fill(1, 5, 0);
        $seriesCounts = array_fill(1, 4, 0);
        $creatorCounts = [];
        foreach ($deck as $card) {
            $difficultyCounts[$card['difficulty']] = ($difficultyCounts[$card['difficulty']] ?? 0) + 1;
            $series = intdiv((int) $card['origin_stage_id'], 100);
            $seriesCounts[$series] = ($seriesCounts[$series] ?? 0) + 1;
            if (trim((string) $card['creator']) !== '') $creatorCounts[$card['creator']] = ($creatorCounts[$card['creator']] ?? 0) + 1;
        }
        arsort($creatorCounts);
        $logs = [];
        foreach ($catalog['public_logs'] as $entry) {
            if ($entry['cursor'] > $target['cursor']) break;
            $log = $entry['log'];
            $card = $cards[$log['event_card_id']] ?? [];
            $logs[] = [...$log, 'card_title' => $log['card_title'] ?? $card['title'] ?? null, 'rule_name' => $log['rule_name'] ?? $card['rule_name'] ?? null, 'score_type' => $log['score_type'] ?? $card['score_type'] ?? 'points'];
        }
        $subsidyCounts = collect($logs)->where('event', 'subsidy_paid')->countBy('subsidy_slot');
        $logs = collect(array_reverse($logs))->map(function ($log) use ($subsidyCounts) {
            if ($log['event'] === 'subsidy_paid') $log['subsidy_recipient_count'] = $subsidyCounts->get($log['subsidy_slot'], 1);
            return $log;
        })->unique(fn ($log) => $log['event'] === 'subsidy_paid' ? 'subsidy:'.$log['subsidy_slot'] : 'log:'.$log['id'])->take(100)->values()->all();
        return [
            'mode' => 'replay', 'read_only' => true, 'snapshot_at' => $target['at'], 'log_cursor' => $target['cursor'], 'server_now' => $target['at'],
            'tournament' => ['event_id' => $manifest['event_id'], 'title' => $manifest['title'], 'start_at' => $manifest['start_at'], 'end_at' => $manifest['end_at'], 'state' => $state['ended'] ? 'ended' : 'active', 'available' => false, 'debug' => false, 'test_mode' => false],
            'me' => null, 'players' => $players, 'field' => array_map(fn ($id) => $cards[$id], $fieldIds),
            'hands_by_player' => $hands, 'hand' => [], 'holder_cards' => $holderCards, 'historical_holder_counts' => app(TrickHolderCatalog::class)->historicalCounts(),
            'rankings_by_card' => array_combine(array_map(fn ($id) => $cards[$id]['id'], array_keys($cards)), array_values($rankings)),
            'deck_count' => count($deck), 'trash_count' => count(array_filter($cards, fn ($card) => $card['state'] === '_trash')),
            'deck_difficulty_counts' => $difficultyCounts, 'deck_series_counts' => $seriesCounts,
            'deck_creator_counts' => array_map(fn ($creator, $count) => ['creator' => $creator, 'count' => $count], array_keys(array_slice($creatorCounts, 0, 5, true)), array_values(array_slice($creatorCounts, 0, 5, true))),
            'collected_count' => count(array_filter($cards, fn ($card) => $card['state'] === '_collected')), 'draw_total' => $state['draw_total'], 'take_total' => $state['take_total'], 'post_total' => count($active),
            'points_total' => array_sum(array_column($players, 'draw_points')) + $state['pot_points'] + array_sum(array_map(fn ($id) => $cards[$id]['live_total_reward'] - $cards[$id]['provisional_pot_points'], $fieldIds)),
            'logs' => $logs,
        ];
    }
}
