<?php

namespace App\Services\Tricks;

use App\Models\LimitLog;
use App\Models\Player;
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
    ) {
    }

    public function tournament(TrickEvent $event): array
    {
        $now = $this->clock->now($event);

        return [
            'event_id' => $event->event_id,
            'title' => $event->title,
            'subtitle' => 'トリックテイキング制',
            'start_at' => $event->start_at->toIso8601String(),
            'end_at' => $event->end_at->toIso8601String(),
            'server_now' => $now->toIso8601String(),
            'debug' => $event->debug,
            'test_mode' => $event->test_mode,
            'state' => $event->state,
            'available' => $this->available($event, $now),
        ];
    }

    public function snapshot(TrickEvent $event, ?string $userId): array
    {
        $provisional = $this->records->provisionalByEvent($event);
        $players = Player::query()
            ->where('event_id', $event->event_id)
            ->orderByDesc('rank_points')
            ->orderBy('name')
            ->get()
            ->map(fn (Player $player) => $this->normalizePlayer($player, $provisional[$player->name] ?? 0))
            ->sortByDesc('total_rank_points')
            ->values();
        $cards = TrickEventCard::query()
            ->with('deck')
            ->where('event_id', $event->event_id)
            ->get();
        $ended = $event->state === 'ended';
        $field = $ended ? [] : $this->fieldWithPostingState($event, $cards->where('state', '_field'), $userId);

        $payload = [
            'tournament' => $this->tournament($event),
            'me' => $userId ? $players->firstWhere('name', $userId) : null,
            'players' => $players,
            'deck_count' => $ended ? 0 : $cards->where('state', '_deck')->count(),
            'trash_count' => $ended ? 0 : $cards->where('state', '_trash')->count(),
            'field' => $field,
            'hand' => ! $ended && $userId
                ? $this->normalizeCards($cards->where('state', $userId)->sortBy('drawn_order'))
                : [],
            'logs' => $this->logs($event),
            'server_now' => $this->clock->now($event)->toIso8601String(),
        ];

        if ($event->debug || $event->test_mode) {
            $now = $this->clock->now($event);
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
        $provisional = $this->records->provisionalByEvent($event);

        return Player::query()->where('event_id', $event->event_id)
            ->orderByDesc('rank_points')->orderBy('name')->get()
            ->map(fn (Player $player) => $this->normalizePlayer($player, $provisional[$player->name] ?? 0))
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
            'event_id' => $card->event_id,
            'stage_id' => $deck?->stage_id,
            'origin_stage_id' => $deck?->origin_stage_id,
            'stage_name' => $deck?->title,
            'eng_stage_name' => $deck?->title,
            'title' => $deck?->title,
            'rule_name' => $deck?->rule_name ?: $deck?->ruleName,
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
        ];
    }

    public function logs(TrickEvent $event): array
    {
        return LimitLog::query()->where('event_id', $event->event_id)
            ->whereIn('event', [
                'join', 'join_existing', 'take', 'record_posted', 'record_updated', 'record_deleted',
                'limit_extended', 'collect', 'subsidy_paid', 'event_ended',
            ])
            ->latest()->limit(100)->get()->reverse()->values()->all();
    }

    private function normalizeCards(Collection $cards): array
    {
        return $cards->map(fn (TrickEventCard $card) => $this->normalizeCard($card))->values()->all();
    }

    private function fieldWithPostingState(TrickEvent $event, Collection $cards, ?string $userId): array
    {
        $payments = TrickCardPayment::query()->where('event_id', $event->event_id)
            ->whereIn('event_card_id', $cards->pluck('id'))->orderBy('created_at')->get()->groupBy('event_card_id');
        $extensions = ($event->debug || $event->test_mode)
            ? LimitLog::query()->where('event_id', $event->event_id)->where('event', 'record_posted')
                ->whereIn('event_card_id', $cards->pluck('id'))->orderBy('created_at')->get()->groupBy('event_card_id')
            : collect();

        return $cards->map(function (TrickEventCard $card) use ($event, $extensions, $payments, $userId) {
            $cardPayments = $payments->get($card->id, collect());
            $initialParticipantCount = $cardPayments->count();
            $paid = $userId !== null && $cardPayments->contains('player_name', $userId);

            $payload = [
                ...$this->normalizeCard($card),
                'participant_count' => $card->post_count,
                'initial_participant_count' => $initialParticipantCount,
                'my_initial_payment_recorded' => $paid,
                'my_initial_post_cost' => $paid ? 0 : $this->rules->initialPostCost(
                    max(1, (int) $card->rarity),
                    $initialParticipantCount,
                ),
            ];
            if ($event->debug || $event->test_mode) {
                $payload['debug'] = [
                    'initial_participants' => $cardPayments->values()->map(fn (TrickCardPayment $payment, int $index) => [
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

    private function normalizePlayer(Player $player, int $provisionalRankPoints = 0): array
    {
        $nextTakeAt = $player->last_take_at?->copy()->addMinutes(90);

        return [
            ...$player->toArray(),
            'points' => $player->draw_points,
            'confirmed_rank_points' => $player->rank_points,
            'provisional_rank_points' => $provisionalRankPoints,
            'total_rank_points' => $player->rank_points + $provisionalRankPoints,
            'next_take_at' => $nextTakeAt?->toIso8601String(),
        ];
    }

    private function available(TrickEvent $event, CarbonImmutable $now): bool
    {
        return $event->initialized_at !== null
            && $event->state !== 'ended'
            && $now->greaterThanOrEqualTo($event->start_at)
            && $now->lessThan($event->end_at);
    }
}
