<?php

namespace App\Services\Tricks;

use App\Models\Deck;
use App\Models\LimitLog;
use App\Models\Player;
use App\Models\Record;
use App\Models\TrickCardPayment;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Models\TrickEventRecord;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class TrickRecordService
{
    public function __construct(
        private readonly TrickClock $clock,
        private readonly TrickSubsidyService $subsidies,
        private readonly TrickRuleCalculator $rules,
        private readonly TrickRankCalculator $ranks,
        private readonly TrickRewardDistributor $rewards,
        private readonly TrickRequestIdentity $identity,
    ) {
    }

    public function saved(Record $record, Record $replacedRecord = null, Request $request = null): void
    {
        $context = $this->resolveContext($record, $replacedRecord, $request);
        if ($context === null) {
            return;
        }
        [$event, $card] = $context;
        $this->authorizeSavedRecord($event, $record, $replacedRecord, $request);
        $deck = $card->relationLoaded('deck') ? $card->deck : $card->deck()->first();
        if ($deck === null || (int) $record->stage_id !== (int) $deck->stage_id) {
            abort(response()->json(['message' => '投稿ステージと大会カードが一致しません'], 422));
        }
        $now = $this->clock->now($event);
        if ($event->state === 'ended' || $now->lessThan($event->start_at) || $now->greaterThanOrEqualTo($event->end_at)) {
            abort(response()->json(['message' => '大会開催時間外です'], 403));
        }
        if ($card->state !== '_field') {
            abort(response()->json(['message' => '回収済みまたは切り札でないカードへは投稿できません'], 409));
        }
        if ($card->limit_at === null || $now->greaterThanOrEqualTo($card->limit_at)) {
            abort(response()->json(['message' => '切り札の投稿期限を過ぎています'], 409));
        }
        if (! in_array((int) $record->rule, [1, (int) $event->event_id], true) || (int) $record->score < 1 || (int) $record->score > 999999) {
            abort(response()->json(['message' => '大会記録のルールまたはスコアが不正です'], 422));
        }

        $player = Player::query()->where('event_id', $event->event_id)
            ->where('name', $record->user_id)->lockForUpdate()->first();
        if ($player === null) {
            abort(response()->json(['message' => '大会へ参加していないユーザーは投稿できません'], 403));
        }

        TrickEventRecord::query()->firstOrCreate(['record_id' => $record->post_id], [
            'event_id' => $event->event_id,
            'event_card_id' => $card->id,
            'deck_id' => $card->deck_id,
        ]);

        $initialPayment = TrickCardPayment::query()
            ->where('event_id', $event->event_id)
            ->where('event_card_id', $card->id)
            ->where('player_name', $record->user_id)
            ->where('payment_type', 'initial_post')
            ->first();
        $hasInitialPost = $initialPayment !== null;
        $participantOrder = null;
        $extension = 0;
        if (! $hasInitialPost) {
            $existingParticipants = TrickCardPayment::query()
                ->where('event_id', $event->event_id)
                ->where('event_card_id', $card->id)
                ->where('payment_type', 'initial_post')
                ->lockForUpdate()
                ->count();
            $participantOrder = $existingParticipants + 1;
        }
        $submissionNumber = TrickCardPayment::query()
            ->where('event_id', $event->event_id)
            ->where('event_card_id', $card->id)
            ->where('player_name', $record->user_id)
            ->whereIn('payment_type', ['initial_post', 'score_update'])
            ->count() + 1;
        $paymentType = $hasInitialPost ? 'score_update' : 'initial_post';
        $idempotencyKey = implode(':', [
            'record',
            $record->post_id,
            $paymentType,
            (string) $record->score,
            $record->updated_at?->format('YmdHisv') ?? 'new',
        ]);
        $existingOperation = TrickCardPayment::query()
            ->where('event_id', $event->event_id)
            ->where('event_card_id', $card->id)
            ->whereIn('idempotency_key', [
                $idempotencyKey,
                str_replace(':score_update:', ':initial_post:', $idempotencyKey),
            ])
            ->first();
        $pointsDue = $this->rules->initialPostCost(
            max(1, (int) $card->difficulty),
            $record->user_id === $card->taker,
            $hasInitialPost,
        );
        $pointsPaid = $existingOperation === null ? $pointsDue : 0;
        if ($existingOperation === null) {
            TrickCardPayment::query()->create([
                'event_id' => $event->event_id,
                'event_card_id' => $card->id,
                'deck_id' => $card->deck_id,
                'stage_id' => $record->stage_id,
                'player_name' => $record->user_id,
                'payment_type' => $paymentType,
                'submission_number' => $submissionNumber,
                'points_paid' => $pointsPaid,
                'record_id' => $record->post_id,
                'idempotency_key' => $idempotencyKey,
            ]);
            if ($pointsPaid > 0) {
                $player->decrement('draw_points', $pointsPaid);
                $card->increment('paid_points_total', $pointsPaid);
            }

            if (! $hasInitialPost && $pointsDue === 0) {
                $this->subsidies->grantInstant($event, $player, $now, $player->card_count, 'free_post', $request);
            }

            if (! $hasInitialPost && $card->limit_at !== null) {
                $limit = CarbonImmutable::instance($card->limit_at);
                $remainingMinutes = max(0.0, $now->diffInSeconds($limit, false) / 60);
                $extension = $this->rules->extensionMinutes((int) $participantOrder, $remainingMinutes);
                $card->limit_at = $limit->addMinutes($extension);
                $card->save();
            }
        }

        $rankings = $this->rankings($card);
        $card->post_count = count($rankings);
        $card->top_player = $rankings[0]['user_id'] ?? null;
        $card->save();
        $this->log($event, $card, $record, $participantOrder, $pointsPaid, $extension, $rankings, $request);
    }

    public function deleted(Record $record, Request $request = null): void
    {
        $link = TrickEventRecord::query()->where('record_id', $record->post_id)->first();
        if ($link === null) {
            return;
        }
        $event = TrickEvent::query()->where('event_id', $link->event_id)->lockForUpdate()->firstOrFail();
        if ($request !== null) {
            $userId = $this->identity->resolveForEvent($request, $event);
            if ($userId === null) {
                abort(response()->json(['message' => '認証が必要です'], 401));
            }
            if ($userId !== (string) $record->user_id && $this->identity->role($request) <= 0) {
                abort(response()->json(['message' => '他ユーザーの記録は削除できません'], 403));
            }
        }
        $card = TrickEventCard::query()->whereKey($link->event_card_id)->lockForUpdate()->first();
        if ($card === null) {
            return;
        }
        $rankings = $card->state === '_collected' ? [] : $this->rankings($card);
        if ($card->state !== '_collected') {
            $card->post_count = count($rankings);
            $card->top_player = $rankings[0]['user_id'] ?? null;
            $card->save();
        }
        LimitLog::query()->create([
            'event' => 'record_deleted',
            'event_id' => $link->event_id,
            'event_card_id' => $card->id,
            'actor_name' => $record->user_id,
            'card_id' => $card->deck_id,
            'stage_id' => $record->stage_id,
            'records_count' => $card->state === '_collected' ? $card->post_count : count($rankings),
            'top_user_id' => $card->state === '_collected' ? $card->top_player : ($rankings[0]['user_id'] ?? null),
            'top_score' => $rankings[0]['score'] ?? null,
            'request_id' => (string) Str::uuid(),
            'context' => [
                'record_id' => $record->post_id,
                'collection_result_frozen' => $card->state === '_collected',
            ],
        ]);
    }

    public function rankings(TrickEventCard $card): array
    {
        $card = $card->fresh() ?? $card;
        $rankings = $this->rankingsByCards(collect([$card]))[$card->id] ?? [];

        return $this->withProvisionalRewards($card, $rankings, $this->provisionalPotFor($card));
    }

    /** @return array<string, int> */
    public function provisionalByEvent(TrickEvent $event): array
    {
        $totals = [];
        $cards = TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_field')->get();
        $rankingsByCard = $this->rankingsByCards($cards);
        foreach ($rankingsByCard as $rankings) {
            foreach ($rankings as $ranking) {
                $totals[$ranking['user_id']] = ($totals[$ranking['user_id']] ?? 0) + $ranking['rps'];
            }
        }

        return $totals;
    }

    /** @return array<int, array<int, array<string, mixed>>> */
    public function rankingsByCards(Collection $cards): array
    {
        if ($cards->isEmpty()) {
            return [];
        }
        $cards = (new \Illuminate\Database\Eloquent\Collection($cards->all()))->loadMissing('deck');
        $cardIds = $cards->pluck('id');
        $rows = Record::query()
            ->join('trick_event_records', 'trick_event_records.record_id', '=', 'records.post_id')
            ->leftJoin('users', 'records.user_id', '=', 'users.user_id')
            ->where('trick_event_records.event_id', $cards->first()->event_id)
            ->whereIn('trick_event_records.event_card_id', $cardIds)
            ->where('records.flg', '<', 2)
            ->select('records.*', 'users.user_name', 'trick_event_records.event_card_id as trick_event_card_id')
            ->get()
            ->groupBy('trick_event_card_id');
        $paidPlayers = TrickCardPayment::query()->where('event_id', $cards->first()->event_id)
            ->where('payment_type', 'initial_post')
            ->whereIn('event_card_id', $cardIds)->get(['event_card_id', 'player_name'])
            ->groupBy('event_card_id')->map(fn (Collection $payments) => $payments->pluck('player_name')->flip());

        return $cards->mapWithKeys(fn (TrickEventCard $card) => [
            $card->id => $this->rankRows($rows->get($card->id, collect()), $paidPlayers->get($card->id, collect()), $card->deck?->score_type === 'time' ? 'time' : 'points', TrickScoreOrder::ascending($card->deck)),
        ])->all();
    }

    private function rankRows(Collection $rows, Collection $paidPlayers, string $scoreType, bool $ascending): array
    {
        if ($rows->isEmpty()) {
            return [];
        }

        $best = [];
        foreach ($rows as $row) {
            $score = (int) $row->score;
            if (! isset($best[$row->user_id])
                || ($ascending ? $score < $best[$row->user_id]->score : $score > $best[$row->user_id]->score)) {
                $best[$row->user_id] = $row;
            }
        }
        $rankData = $this->ranks->calculate(
            collect($best)->mapWithKeys(fn ($row, $userId) => [$userId => (int) $row->score])->all(),
            $ascending,
        );

        return collect($best)->map(function ($row, $userId) use ($rankData, $paidPlayers, $scoreType) {
            $data = collect($row->toArray())->only([
                'post_id', 'unique_id', 'user_id', 'user_name', 'score', 'stage_id', 'rule', 'console',
                'difficulty', 'region', 'post_comment', 'img_url', 'video_url', 'flg', 'team', 'created_at',
            ])->all();
            $data['user_id'] = $userId;
            $data['user_name'] = $data['user_name'] ?: $userId;
            $data['score'] = (int) $data['score'];
            $data['score_type'] = $scoreType;
            $data['rank'] = $rankData[$userId]['rank'];
            $data['post_rank'] = $rankData[$userId]['rank'];
            $data['rps'] = $rankData[$userId]['rank_points'];
            $data['initial_payment_recorded'] = $paidPlayers->has($userId);

            return $data;
        })->sortBy('rank')->values()->all();
    }

    private function withProvisionalRewards(TrickEventCard $card, array $rankings, int $potPoints = 0): array
    {
        if ($rankings === []) {
            return [];
        }
        if (count($rankings) === 1) {
            $rankings[0]['provisional_reward_points'] = $this->rules->totalReward(
                (int) $card->stack_count,
                (int) $card->paid_points_total,
                1,
                $potPoints,
                (int) ($card->rarity ?? 1),
            );

            return $rankings;
        }

        $rankGroups = collect($rankings)->groupBy('rank')->values()
            ->map(fn ($group) => $group->pluck('user_id')->values()->all())->all();
        $result = $this->rewards->distribute(
            $this->rules->totalReward(
                (int) $card->stack_count,
                (int) $card->paid_points_total,
                count($rankings),
                $potPoints,
                (int) ($card->rarity ?? 1),
            ),
            $rankGroups,
        );

        return collect($rankings)->map(function (array $ranking) use ($result, $card): array {
            $points = (int) ($result['distribution'][$ranking['user_id']] ?? 0);
            if ($ranking['user_id'] === $card->taker) {
                $points += (int) $result['taker_remainder'];
            }
            $ranking['provisional_reward_points'] = $points;

            return $ranking;
        })->all();
    }

    public function unrankedTakerRemainder(TrickEventCard $card, array $rankings, int $potPoints): int
    {
        if (count($rankings) < 2 || collect($rankings)->contains('user_id', $card->taker)) {
            return 0;
        }
        $groups = collect($rankings)->groupBy('rank')->values()
            ->map(fn ($group) => $group->pluck('user_id')->values()->all())->all();

        return $this->rewards->distribute($this->rules->totalReward(
            (int) $card->stack_count, (int) $card->paid_points_total, count($rankings),
            $potPoints, (int) ($card->rarity ?? 1),
        ), $groups)['taker_remainder'];
    }

    private function provisionalPotFor(TrickEventCard $card): int
    {
        if ($card->state !== '_field' || $card->post_count <= 0) {
            return 0;
        }
        $targetId = TrickEventCard::query()->where('event_id', $card->event_id)
            ->where('state', '_field')->where('post_count', '>', 0)
            ->orderByRaw('limit_at IS NULL')->orderBy('limit_at')->orderBy('id')->value('id');
        if ((int) $targetId !== (int) $card->id) {
            return 0;
        }

        return (int) (TrickEvent::query()->where('event_id', $card->event_id)->value('pot_points') ?? 0);
    }

    private function authorizeSavedRecord(
        TrickEvent $event,
        Record $record,
        ?Record $replacedRecord,
        ?Request $request,
    ): void {
        if ($request === null) {
            return;
        }
        $userId = $this->identity->resolveForEvent($request, $event);
        if ($userId === null) {
            abort(response()->json(['message' => '認証が必要です'], 401));
        }
        if ($userId !== (string) $record->user_id) {
            abort(response()->json(['message' => '投稿者と認証ユーザーが一致しません'], 403));
        }
        if ($replacedRecord !== null
            && $userId !== (string) $replacedRecord->user_id
            && $this->identity->role($request) <= 0) {
            abort(response()->json(['message' => '他ユーザーの記録は編集できません'], 403));
        }
    }

    /** @return array{0: TrickEvent, 1: TrickEventCard}|null */
    private function resolveContext(Record $record, ?Record $replacedRecord, ?Request $request): ?array
    {
        if ($replacedRecord !== null) {
            $oldLink = TrickEventRecord::query()->where('record_id', $replacedRecord->post_id)->first();
            if ($oldLink !== null) {
                $event = TrickEvent::query()->where('event_id', $oldLink->event_id)->lockForUpdate()->firstOrFail();
                $card = TrickEventCard::query()->with('deck')->whereKey($oldLink->event_card_id)->lockForUpdate()->firstOrFail();

                return [$event, $card];
            }
        }

        if ($request?->input('tricks_event_id') !== null) {
            $validated = $request->validate(['tricks_event_id' => ['required', 'integer', 'min:1', 'max:2147483647']]);
            $event = TrickEvent::query()->where('event_id', $validated['tricks_event_id'])->lockForUpdate()->firstOrFail();
            $card = TrickEventCard::query()->with('deck')->where('event_id', $event->event_id)
                ->whereHas('deck', fn ($query) => $query->where('stage_id', $record->stage_id))->lockForUpdate()->firstOrFail();

            return [$event, $card];
        }

        $deck = Deck::query()->where('stage_id', $record->stage_id)->first();
        if ($deck === null) {
            return null;
        }
        $events = TrickEvent::query()->where('state', '!=', 'ended')->orderByDesc('event_id')->get();
        foreach ($events as $candidate) {
            $now = $this->clock->now($candidate);
            if ($now->lessThan($candidate->start_at) || $now->greaterThanOrEqualTo($candidate->end_at)) {
                continue;
            }
            $cardId = TrickEventCard::query()->where('event_id', $candidate->event_id)
                ->where('deck_id', $deck->id)->value('id');
            if ($cardId === null) {
                continue;
            }
            $event = TrickEvent::query()->where('event_id', $candidate->event_id)->lockForUpdate()->firstOrFail();
            $card = TrickEventCard::query()->with('deck')->whereKey($cardId)->lockForUpdate()->firstOrFail();

            return [$event, $card];
        }

        return null;
    }

    private function log(
        TrickEvent $event,
        TrickEventCard $card,
        Record $record,
        ?int $participantOrder,
        int $pointsPaid,
        int $extension,
        array $rankings,
        ?Request $request,
    ): void {
        $actorRanking = collect($rankings)->firstWhere('user_id', $record->user_id);
        LimitLog::query()->create([
            'event' => $participantOrder === null ? 'record_updated' : 'record_posted',
            'event_id' => $event->event_id,
            'event_card_id' => $card->id,
            'actor_name' => $record->user_id,
            'card_id' => $card->deck_id,
            'stage_id' => $record->stage_id,
            'points_delta' => -$pointsPaid,
            'previous_limit' => $extension > 0 ? $card->limit_at?->copy()->subMinutes($extension) : $card->limit_at,
            'new_limit' => $card->limit_at,
            'records_count' => count($rankings),
            'top_user_id' => $rankings[0]['user_id'] ?? null,
            'top_score' => $rankings[0]['score'] ?? null,
            'route' => $request?->path(),
            'ip' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'request_id' => (string) ($request?->header('X-Request-Id') ?: Str::uuid()),
            'context' => [
                'record_id' => $record->post_id,
                'participant_order' => $participantOrder,
                'extension_minutes' => $extension,
                'score' => (int) $record->score,
                'rank' => isset($actorRanking['rank']) ? (int) $actorRanking['rank'] : null,
            ],
        ]);
    }
}
