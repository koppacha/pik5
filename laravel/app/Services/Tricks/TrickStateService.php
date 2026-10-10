<?php

namespace App\Services\Tricks;

use App\Models\LimitLog;
use App\Models\Player;
use App\Models\Record;
use App\Models\TrickCardHolder;
use App\Models\TrickCardPayment;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class TrickStateService
{
    public function __construct(
        private readonly TrickClock $clock,
        private readonly TrickRecordService $records,
        private readonly TrickRuleCalculator $rules,
        private readonly TrickSubsidyService $subsidies,
        private readonly TrickTakeCooldownService $cooldowns,
    ) {
    }

    public function tournament(TrickEvent $event): array
    {
        $now = $this->clock->now($event);

        return [
            'event_id' => $event->event_id,
            'title' => $event->title,
            'participant_count' => Player::query()->where('event_id', $event->event_id)->count(),
            'subtitle' => 'トリックテイキング制',
            'rule_name' => 'トリックテイキング制×スタンダード',
            'start_at' => $event->start_at->toIso8601String(),
            'end_at' => $event->end_at->toIso8601String(),
            'server_now' => $now->toIso8601String(),
            'debug' => $event->debug,
            'test_mode' => $event->test_mode,
            'state' => $event->state,
            'available' => $this->available($event, $now),
            'pot_points' => (int) $event->pot_points,
        ];
    }

    public function snapshot(TrickEvent $event, ?string $userId): array
    {
        if ($userId !== null && ! TrickRequestIdentity::isSafeUserId($userId)) {
            $userId = null;
        }
        $now = $this->clock->now($event);
        $provisional = $this->records->provisionalByEvent($event);
        $collectedCounts = $this->collectedCountsByPlayer($event);
        $players = Player::query()
            ->where('event_id', $event->event_id)
            ->orderByDesc('rank_points')
            ->orderBy('name')
            ->get()
            ->map(fn (Player $player) => $this->normalizePlayer(
                $event,
                $player,
                $provisional[$player->name] ?? 0,
                $now,
                (int) ($collectedCounts[$player->name] ?? 0),
            ))
            ->sortByDesc('total_rank_points')
            ->values();
        $cards = TrickEventCard::query()
            ->with('deck')
            ->where('event_id', $event->event_id)
            ->get();
        $holderCards = TrickCardHolder::query()->where('event_id', $event->event_id)
            ->whereIn('event_card_id', $cards->where('state', '_collected')->pluck('id'))
            ->get()->map(function (TrickCardHolder $holder) use ($cards): array {
                $card = $cards->firstWhere('id', $holder->event_card_id);

                return [
                    'player_name' => $holder->player_name,
                    'id' => $card?->deck_id,
                    'title' => $card?->deck?->title,
                    'rule_name' => $card?->deck?->rule_name,
                    'score_type' => $card?->deck?->score_type === 'time' ? 'time' : 'points',
                    'stage_id' => (int) ($card?->deck?->stage_id ?? 0),
                    'rarity' => (int) ($card?->rarity ?? 1),
                    'difficulty' => $card?->difficulty,
                ];
            })->values();
        $ended = $event->state === 'ended';
        $field = $ended ? [] : $this->fieldWithPostingState($event, $cards->where('state', '_field'), $userId);
        if (! $ended) {
            $potTargetId = $cards->where('state', '_field')->where('post_count', '>', 0)
                ->sortBy(fn (TrickEventCard $card) => sprintf('%s:%020d', $card->limit_at?->format('Y-m-d H:i:s.u') ?? '9999', $card->id))
                ->first()?->id;
            $field = collect($field)->map(function (array $card) use ($event, $potTargetId): array {
                $pot = (int) $card['event_card_id'] === (int) $potTargetId ? (int) $event->pot_points : 0;
                $card['provisional_pot_points'] = $pot;
                $card['live_total_reward'] = $this->rules->totalReward(
                    (int) $card['stack_count'],
                    (int) $card['paid_points_total'],
                    1,
                    $pot,
                    (int) ($card['rarity'] ?? 1),
                );
                $card['provisional_total_reward'] = $this->rules->totalReward(
                    (int) $card['stack_count'],
                    (int) $card['paid_points_total'],
                    (int) $card['participant_count'],
                    $pot,
                    (int) ($card['rarity'] ?? 1),
                );

                return $card;
            })->values()->all();
        }

        $deckCards = $ended ? collect() : $cards->where('state', '_deck');
        $deckDifficultyCounts = array_fill_keys(range(1, 5), 0);
        $deckSeriesCounts = array_fill_keys(range(1, 4), 0);
        $creatorCounts = [];

        foreach ($deckCards as $card) {
            $difficulty = (int) $card->difficulty;
            if (array_key_exists($difficulty, $deckDifficultyCounts)) {
                $deckDifficultyCounts[$difficulty]++;
            }
            $origin = (int) $card->deck?->origin_stage_id;
            $series = $origin >= 100 && $origin < 500 ? intdiv($origin, 100) : 0;
            $deckSeriesCounts[$series] = ($deckSeriesCounts[$series] ?? 0) + 1;
            $creator = (string) $card->deck?->creator;
            if (trim($creator) !== '') {
                $creatorCounts[$creator] = ($creatorCounts[$creator] ?? 0) + 1;
            }
        }

        $deckCreatorCounts = collect($creatorCounts)->map(fn (int $count, string $creator) => [
            'creator' => $creator, 'count' => $count,
        ])->sort(function (array $a, array $b): int {
            return ($b['count'] <=> $a['count']) ?: strcmp($a['creator'], $b['creator']);
        })->take(5)->values()->all();

        $payload = [
            'tournament' => $this->tournament($event),
            'me' => $userId ? $players->firstWhere('name', $userId) : null,
            'players' => $players,
            'deck_count' => $deckCards->count(),
            'deck_difficulty_counts' => $deckDifficultyCounts,
            'deck_series_counts' => $deckSeriesCounts,
            'deck_creator_counts' => $deckCreatorCounts,
            'trash_count' => $ended ? 0 : $cards->where('state', '_trash')->count(),
            'collected_count' => $cards->where('state', '_collected')->count(),
            'draw_total' => LimitLog::query()->where('event_id', $event->event_id)->where('event', 'draw')->count(),
            'post_total' => Record::query()
                ->join('trick_event_records', 'trick_event_records.record_id', '=', 'records.post_id')
                ->where('trick_event_records.event_id', $event->event_id)
                ->where('records.flg', '<', 2)->count(),
            'take_total' => (int) $players->sum('take_count'),
            // live_total_reward already includes the pot assigned to one field card.
            'points_total' => (int) $players->sum('draw_points')
                + (int) $event->pot_points
                + (int) collect($field)->sum(fn (array $card) =>
                    (int) $card['live_total_reward'] - (int) $card['provisional_pot_points']),
            'holder_cards' => $holderCards,
            'field' => $field,
            'hand' => ! $ended && $userId
                ? $this->normalizeCards($cards->where('state', $userId)->sortBy('drawn_order'))
                : [],
            'logs' => $this->logs($event),
            'server_now' => $now->toIso8601String(),
        ];

        if ($event->debug || $event->test_mode) {
            $payload['debug_state'] = [
                'server_now' => $now->toIso8601String(),
                'frozen' => $event->debug_now !== null,
                'last_subsidy_slot_at' => $event->last_subsidy_slot_at?->toIso8601String(),
                'next_subsidy_slot_at' => $this->subsidies->currentSlot($now)->addMinutes(30)->toIso8601String(),
            ];
        }

        return $payload;
    }

    public function players(TrickEvent $event): array
    {
        $now = $this->clock->now($event);
        $provisional = $this->records->provisionalByEvent($event);
        $collectedCounts = $this->collectedCountsByPlayer($event);

        return Player::query()->where('event_id', $event->event_id)
            ->orderByDesc('rank_points')->orderBy('name')->get()
            ->map(fn (Player $player) => $this->normalizePlayer(
                $event,
                $player,
                $provisional[$player->name] ?? 0,
                $now,
                (int) ($collectedCounts[$player->name] ?? 0),
            ))
            ->sortByDesc('total_rank_points')->values()->all();
    }

    public function cards(TrickEvent $event, string $state): array
    {
        if ($event->state === 'ended' && $state !== '_collected') {
            return [];
        }

        return $this->normalizeCards(TrickEventCard::query()->with('deck')
            ->where('event_id', $event->event_id)->where('state', $state)
            ->orderBy('drawn_order')->get());
    }

    public function normalizeCard(TrickEventCard $card): array
    {
        $deck = $card->relationLoaded('deck') ? $card->deck : $card->deck()->first();

        return [
            'id' => $card->deck_id,
            'event_card_id' => $card->id,
            'card_id' => (int) ($deck?->card_id ?: $card->deck_id),
            'card_key' => $deck?->card_key,
            'event_id' => $card->event_id,
            'stage_id' => $deck?->stage_id,
            'origin_stage_id' => $deck?->origin_stage_id,
            'stage_name' => $deck?->title,
            'eng_stage_name' => $deck?->title,
            'title' => $deck?->title,
            'rule_name' => $deck?->rule_name,
            'score_type' => $deck?->score_type === 'time' ? 'time' : 'points',
            'text' => $deck?->text,
            'state' => $card->state,
            'difficulty' => $card->difficulty,
            'rarity' => $card->rarity,
            'stack_count' => $card->stack_count,
            'creator' => $deck?->creator,
            'taker' => $card->taker,
            'top_player' => $card->top_player,
            'post_count' => $card->post_count,
            'paid_points_total' => $card->paid_points_total,
            'limit_at' => $card->limit_at?->toIso8601String(),
            'taken_at' => $card->taken_at?->toIso8601String(),
            'collected_at' => $card->collected_at?->toIso8601String(),
            'stack_parent_id' => $card->stack_parent_id,
            'was_returned' => $card->returned_count > 0,
            'was_opened' => $card->rarity !== null && $card->draw_count > 1,
        ];
    }

    public function logs(TrickEvent $event): array
    {
        $logs = LimitLog::query()->where('event_id', $event->event_id)
            ->whereIn('event', [
                'join', 'join_existing', 'take', 'record_posted', 'record_updated', 'record_deleted',
                'rule_changed', 'ranking_reset', 'ranking_reset_compensation',
                'limit_extended', 'player_extension', 'empty_field_floor_grant', 'collect', 'subsidy_paid', 'instant_subsidy_paid', 'event_ended',
            ])
            ->latest()->orderByDesc('id')->limit(100)->get()->values();
        $cards = TrickEventCard::query()->with('deck')
            ->where('event_id', $event->event_id)
            ->whereIn('id', $logs->pluck('event_card_id')->filter())
            ->get()->keyBy('id');
        $rankingsByCard = $this->records->rankingsByCards($cards);
        $subsidyCountsBySlot = $logs->where('event', 'subsidy_paid')->countBy(function (LimitLog $log): string {
            $context = is_array($log->context) ? $log->context : [];

            return (string) ($context['slot'] ?? "log:{$log->id}");
        });

        return $logs->map(function (LimitLog $log) use ($cards, $rankingsByCard, $subsidyCountsBySlot): array {
            $payload = collect($log->toArray())->only([
                'id', 'event', 'event_id', 'event_card_id', 'actor_name', 'card_id', 'stage_id',
                'affected_player_name',
                'from_state', 'to_state', 'points_delta', 'rank_points_delta', 'draw_points_delta',
                'remaining_draw_points', 'remaining_deck_count', 'hand_count', 'rewards', 'records_count',
                'top_user_id', 'top_score', 'previous_limit', 'new_limit', 'created_at',
            ])->all();
            $card = $cards->get($log->event_card_id);
            $context = is_array($log->context) ? $log->context : [];
            $ranking = null;
            if (in_array($log->event, ['record_posted', 'record_updated'], true) && $card !== null) {
                $ranking = collect($rankingsByCard[$card->id] ?? [])->firstWhere('user_id', $log->actor_name);
            }
            if ($log->event === 'collect') {
                $topRanking = collect($context['final_rankings'] ?? [])->where('rank', 1)
                    ->sortBy(fn (array $row) => sprintf('%s:%020d', $row['created_at'] ?? '', $row['post_id'] ?? 0))
                    ->first();
                $payload['top_user_id'] = $topRanking['user_id'] ?? $log->top_user_id;
            }
            $payload['card_title'] = $card?->deck?->title;
            $payload['rule_name'] = $card?->deck?->rule_name;
            $payload['rarity'] = $card?->rarity !== null ? (int) $card->rarity : null;
            $payload['score_type'] = $card?->deck?->score_type === 'time' ? 'time' : 'points';
            $payload['score'] = isset($context['score']) ? (int) $context['score'] : ($ranking['score'] ?? null);
            $payload['rank'] = isset($context['rank']) ? (int) $context['rank'] : ($ranking['rank'] ?? null);
            $payload['subsidy_slot'] = $log->event === 'subsidy_paid' ? ($context['slot'] ?? null) : null;
            $payload['subsidy_recipient_count'] = $log->event === 'subsidy_paid'
                ? $subsidyCountsBySlot->get((string) ($context['slot'] ?? "log:{$log->id}"), 1)
                : null;
            $payload['granted_points_total'] = $log->event === 'empty_field_floor_grant'
                ? (int) ($context['total_points'] ?? 0)
                : null;

            return $payload;
        })->unique(fn (array $log): string => $log['event'] === 'subsidy_paid'
            ? 'subsidy:'.($log['subsidy_slot'] ?? "log:{$log['id']}")
            : "log:{$log['id']}")
            ->values()->all();
    }

    private function normalizeCards(Collection $cards): array
    {
        return $cards->map(fn (TrickEventCard $card) => $this->normalizeCard($card))->values()->all();
    }

    private function fieldWithPostingState(TrickEvent $event, Collection $cards, ?string $userId): array
    {
        $rankings = $this->records->rankingsByCards($cards);
        $isParticipant = $userId !== null && Player::query()->where('event_id', $event->event_id)->where('name', $userId)->exists();
        $payments = TrickCardPayment::query()->where('event_id', $event->event_id)
            ->whereIn('event_card_id', $cards->pluck('id'))->orderBy('created_at')->get()->groupBy('event_card_id');
        $extensions = ($event->debug || $event->test_mode)
            ? LimitLog::query()->where('event_id', $event->event_id)
                ->whereIn('event', ['record_posted', 'player_extension'])
                ->whereIn('event_card_id', $cards->pluck('id'))->orderBy('created_at')->get()->groupBy('event_card_id')
            : collect();

        $potTargetId = $cards->where('post_count', '>', 0)
            ->sortBy(fn (TrickEventCard $card) => sprintf('%s:%020d', $card->limit_at?->format('Y-m-d H:i:s.u') ?? '9999', $card->id))
            ->first()?->id;

        return $cards->map(function (TrickEventCard $card) use ($event, $extensions, $payments, $userId, $rankings, $isParticipant, $potTargetId) {
            $cardPayments = $payments->get($card->id, collect());
            $initialPayments = $cardPayments->where('payment_type', 'initial_post')->values();
            $initialParticipantCount = $initialPayments->count();
            $paid = $userId !== null && $initialPayments->contains('player_name', $userId);

            $payload = [
                ...$this->normalizeCard($card),
                'participant_count' => $card->post_count,
                'provisional_taker_remainder' => $this->records->unrankedTakerRemainder(
                    $card, $rankings[$card->id] ?? [], $card->id === $potTargetId ? (int) $event->pot_points : 0,
                ),
                'initial_participant_count' => $initialParticipantCount,
                'my_has_record' => $isParticipant && collect($rankings[$card->id] ?? [])->contains('user_id', $userId),
                'my_can_post' => $isParticipant && $this->available($event, $this->clock->now($event)),
                'my_initial_payment_recorded' => $paid,
                'my_initial_post_cost' => $this->rules->initialPostCost(
                    max(1, (int) $card->difficulty),
                    $userId !== null && $userId === $card->taker,
                    $paid,
                ),
                'my_can_extend' => $isParticipant
                    && $this->available($event, $this->clock->now($event))
                    && $this->clock->now($event)->lessThan($event->end_at->copy()->subHour())
                    && $card->limit_at !== null
                    && $card->limit_at->lessThan($event->end_at)
                    && $this->clock->now($event)->lessThan($card->limit_at),
            ];
            if ($event->debug || $event->test_mode) {
                $payload['debug'] = [
                    'initial_participants' => $initialPayments->map(fn (TrickCardPayment $payment, int $index) => [
                        'order' => $index + 1,
                        'player_name' => $payment->player_name,
                        'points_paid' => (int) $payment->points_paid,
                    ])->all(),
                    'extension_history' => $extensions->get($card->id, collect())->values()
                        ->filter(fn (LimitLog $log) => (int) ($log->context['extension_minutes'] ?? 0) > 0)
                        ->map(fn (LimitLog $log) => [
                            'player_name' => $log->actor_name,
                            'minutes' => (int) $log->context['extension_minutes'],
                            'new_limit' => $log->new_limit?->toIso8601String(),
                        ])->all(),
                ];
            }

            return $payload;
        })->values()->all();
    }

    private function normalizePlayer(
        TrickEvent $event,
        Player $player,
        int $provisionalRankPoints,
        CarbonImmutable $now,
        int $collectedCardCount,
    ): array {
        $nextTakeAt = $this->cooldowns->nextTakeAt($event, $player, $now);

        return [
            'name' => $player->name,
            'draw_points' => $player->draw_points,
            'rank_points' => $player->rank_points,
            'card_count' => $player->card_count,
            'collected_card_count' => $collectedCardCount,
            'take_count' => (int) $player->take_count,
            'take_level' => $this->rules->takeLevel((int) $player->take_count),
            'take_cost' => $this->rules->requiredHand((int) $player->take_count),
            'hand_limit' => $this->rules->handLimit((int) $player->take_count),
            'balance_tax_threshold' => $this->rules->balanceTaxThreshold((int) $player->take_count),
            'balance_tax_eligible' => $player->draw_points > $this->rules->balanceTaxThreshold((int) $player->take_count),
            'last_take_at' => $player->last_take_at?->toIso8601String(),
            'points' => $player->draw_points,
            'confirmed_rank_points' => $player->rank_points,
            'provisional_rank_points' => $provisionalRankPoints,
            'total_rank_points' => $player->rank_points + $provisionalRankPoints,
            'next_take_at' => $nextTakeAt?->toIso8601String(),
            'subsidy_flag' => $this->available($event, $now)
                && $this->rules->recurringSubsidyEligible($player->draw_points, $player->card_count),
        ];
    }

    private function collectedCountsByPlayer(TrickEvent $event): Collection
    {
        return TrickCardHolder::query()
            ->where('event_id', $event->event_id)
            ->selectRaw('player_name, COUNT(*) as aggregate')
            ->groupBy('player_name')
            ->pluck('aggregate', 'player_name');
    }

    private function available(TrickEvent $event, CarbonImmutable $now): bool
    {
        return $event->initialized_at !== null
            && $event->state !== 'ended'
            && $now->greaterThanOrEqualTo($event->start_at)
            && $now->lessThan($event->end_at);
    }
}
