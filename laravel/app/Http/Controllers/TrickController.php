<?php

namespace App\Http\Controllers;

use App\Models\Deck;
use App\Models\LimitLog;
use App\Models\Player;
use App\Models\Record;
use App\Models\TrickCardHolder;
use App\Models\TrickCardPayment;
use App\Models\TrickCollectionReward;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Services\Tricks\TrickCollectionService;
use App\Services\Tricks\TrickDebugTimeService;
use App\Services\Tricks\TrickEventFinalizer;
use App\Services\Tricks\TrickEventResolver;
use App\Services\Tricks\TrickGameService;
use App\Services\Tricks\TrickHolderCatalog;
use App\Services\Tricks\TrickOperationAuthorizer;
use App\Services\Tricks\TrickRecordService;
use App\Services\Tricks\TrickRequestIdentity;
use App\Services\Tricks\TrickStateService;
use App\Services\Tricks\TrickSubsidyService;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class TrickController extends Controller
{
    private const EVENT_ID = 251227;

    private const START_AT = '2026-05-03 00:00:00';

    private const END_AT = '2026-05-05 00:00:00';

    private const POLL_LIMIT = 100;

    private const STAGE_ID_START = 1001;

    private const STAGE_ID_END = 1999;

    private array $deckColumns = [];

    public function tournament(Request $request, TrickEventResolver $events, TrickRequestIdentity $identity, TrickStateService $state): JsonResponse
    {
        return response()->json($state->tournament($events->forRequest($request, $identity)));
    }

    public function state(Request $request, TrickEventResolver $events, TrickStateService $state): JsonResponse
    {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));

        return response()->json($state->snapshot($event, $this->userId($request, $event)));
    }

    public function players(Request $request, TrickEventResolver $events, TrickRequestIdentity $identity, TrickStateService $state): JsonResponse
    {
        return response()->json($state->players($events->forRequest($request, $identity)));
    }

    public function hand(Request $request, TrickEventResolver $events, TrickStateService $state): JsonResponse
    {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $userId = $this->requireUserId($request, $event);

        return response()->json($state->cards($event, $userId));
    }

    public function field(Request $request, TrickEventResolver $events, TrickRequestIdentity $identity, TrickStateService $state): JsonResponse
    {
        return response()->json($state->cards($events->forRequest($request, $identity), '_field'));
    }

    public function logs(Request $request, TrickEventResolver $events, TrickRequestIdentity $identity, TrickStateService $state): JsonResponse
    {
        return response()->json($state->logs($events->forRequest($request, $identity)));
    }

    public function collected(
        Request $request,
        TrickEventResolver $events,
        TrickStateService $state,
        TrickRecordService $records,
    ): JsonResponse {
        $eventId = (int) $request->query('event_id', 0);
        $event = app(TrickRequestIdentity::class)->isTest($request)
            ? $events->forRequest($request, app(TrickRequestIdentity::class))
            : ($eventId > 0
            ? TrickEvent::query()->where('event_id', $eventId)->firstOrFail()
            : $events->current());
        $cards = TrickEventCard::query()->with('deck')->where('event_id', $event->event_id)
            ->where('state', '_collected')->orderBy('collected_at')->get();
        $holders = TrickCardHolder::query()->where('event_id', $event->event_id)
            ->whereIn('event_card_id', $cards->pluck('id'))->get()->groupBy('event_card_id');
        $cards = $cards->filter(fn (TrickEventCard $card) => $holders->has($card->id))->values();
        $rankings = $records->rankingsByCards($cards);
        $collectionLogs = LimitLog::query()->where('event_id', $event->event_id)
            ->where('event', 'collect')->whereIn('event_card_id', $cards->pluck('id'))
            ->get()->keyBy('event_card_id');
        $rewards = TrickCollectionReward::query()->where('event_id', $event->event_id)
            ->whereIn('event_card_id', $cards->pluck('id'))->get()->groupBy('event_card_id');

        return response()->json($cards->map(function (TrickEventCard $card) use (
            $state,
            $rankings,
            $collectionLogs,
            $holders,
            $rewards,
        ) {
            $cardHolders = $holders->get($card->id, collect())->pluck('player_name')->values()->all();
            $finalRankings = $collectionLogs->get($card->id)?->context['final_rankings'] ?? null;

            return [
                ...$state->normalizeCard($card),
                'holders' => $cardHolders,
                'holder_label' => implode(' / ', $cardHolders),
                'returns_next_event' => false,
                'rankings' => is_array($finalRankings) ? $finalRankings : ($rankings[$card->id] ?? []),
                'rewards' => $rewards->get($card->id, collect())->values()->all(),
                'total_reward_points' => $rewards->get($card->id, collect())->sum('points_delta'),
            ];
        })->values());
    }

    public function holders(Request $request, TrickHolderCatalog $catalog, TrickStateService $state, TrickRecordService $records): JsonResponse
    {
        $userId = trim((string) $request->query('user_id', ''));
        if ($userId !== '' && (strlen($userId) > 191 || ! preg_match('/^[a-zA-Z0-9_.-]+$/', $userId))) {
            return response()->json(['message' => 'Invalid user_id'], 422);
        }

        return response()->json([
            'counts' => $catalog->counts(),
            'historical_counts' => $catalog->historicalCounts(),
            'cards' => $userId === '' ? [] : $catalog->cardsFor($userId, $state, $records),
        ]);
    }

    public function collectedAdminStats(
        Request $request,
        TrickEventResolver $events,
        TrickRequestIdentity $identity,
    ): JsonResponse {
        if ($identity->role($request) !== 10) {
            abort(403);
        }

        $eventId = (int) $request->query('event_id', 0);
        $event = $identity->isTest($request)
            ? $events->forRequest($request, $identity)
            : ($eventId > 0
            ? TrickEvent::query()->where('event_id', $eventId)->firstOrFail()
            : $events->current());

        return response()->json($this->collectedAdminStatsPayload($event));
    }

    public function join(Request $request, TrickEventResolver $events, TrickGameService $game): JsonResponse
    {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $userId = $this->requireUserId($request, $event);

        return response()->json($game->join($event, $userId, $request));
    }

    public function draw(Request $request, TrickEventResolver $events, TrickGameService $game): JsonResponse
    {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $userId = $this->requireUserId($request, $event);

        return response()->json($game->draw($event, $userId, $request));
    }

    public function take(Request $request, int $deckId, TrickEventResolver $events, TrickGameService $game): JsonResponse
    {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $userId = $this->requireUserId($request, $event);

        return response()->json($game->take($event, $userId, $deckId, $request));
    }

    public function returnToDeck(Request $request, int $deckId, TrickEventResolver $events, TrickGameService $game): JsonResponse
    {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $userId = $this->requireUserId($request, $event);

        return response()->json($game->returnToDeck($event, $userId, $deckId, $request));
    }

    public function extend(Request $request, int $deckId, TrickEventResolver $events, TrickGameService $game): JsonResponse
    {
        $validated = $request->validate([
            'idempotency_key' => ['required', 'string', 'min:8', 'max:96'],
        ]);
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $userId = $this->requireUserId($request, $event);

        return response()->json($game->extend(
            $event,
            $userId,
            $deckId,
            $validated['idempotency_key'],
            $request,
        ));
    }

    public function scores(Request $request, int $deckId, TrickEventResolver $events, TrickRequestIdentity $identity, TrickRecordService $records): JsonResponse
    {
        $event = $events->forRequest($request, $identity);
        $card = TrickEventCard::query()->where('event_id', $event->event_id)
            ->where('deck_id', $deckId)->firstOrFail();

        return response()->json($records->rankings($card));
    }

    public function collect(
        Request $request,
        int $deckId,
        TrickEventResolver $events,
        TrickOperationAuthorizer $authorization,
        TrickCollectionService $collections,
    ): JsonResponse {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $actor = $authorization->assertAdminForEvent($event, $request);

        return response()->json($collections->collect($event, $deckId, true, $actor, $request));
    }

    public function debugCollect(
        Request $request,
        int $deckId,
        TrickEventResolver $events,
        TrickOperationAuthorizer $authorization,
        TrickCollectionService $collections,
    ): JsonResponse {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $actor = $authorization->assertDebugAdmin($event, $request);

        return response()->json($collections->collect($event, $deckId, true, $actor, $request));
    }

    public function collectExpired(
        Request $request,
        TrickEventResolver $events,
        TrickOperationAuthorizer $authorization,
        TrickCollectionService $collections,
    ): JsonResponse {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $actor = $authorization->assertParticipantForEvent($event, $request);

        return response()->json($collections->collectExpired($event, $actor, $request));
    }

    public function subsidy(
        Request $request,
        TrickEventResolver $events,
        TrickOperationAuthorizer $authorization,
        TrickSubsidyService $subsidies,
    ): JsonResponse {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $actor = $authorization->assertParticipantForEvent($event, $request);

        return response()->json($subsidies->processCurrent($event, $actor, $request));
    }

    public function finalize(
        Request $request,
        TrickEventResolver $events,
        TrickOperationAuthorizer $authorization,
        TrickEventFinalizer $finalizer,
    ): JsonResponse {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $actor = $authorization->assertAdminForEvent($event, $request);

        return response()->json($finalizer->finalize($event, false, $actor, $request));
    }

    public function debugTimeFreeze(
        Request $request,
        TrickEventResolver $events,
        TrickOperationAuthorizer $authorization,
        TrickDebugTimeService $time,
    ): JsonResponse {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $authorization->assertDebugAdmin($event, $request);

        return response()->json($time->freeze($event));
    }

    public function debugTimeSet(
        Request $request,
        TrickEventResolver $events,
        TrickOperationAuthorizer $authorization,
        TrickDebugTimeService $time,
    ): JsonResponse {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $authorization->assertDebugAdmin($event, $request);
        $request->validate(['now' => ['required', 'date']]);

        try {
            return response()->json($time->set($event, CarbonImmutable::parse((string) $request->input('now'))));
        } catch (DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function debugTimeAdvance(
        Request $request,
        TrickEventResolver $events,
        TrickOperationAuthorizer $authorization,
        TrickDebugTimeService $time,
    ): JsonResponse {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $actor = $authorization->assertDebugAdmin($event, $request);
        $request->validate([
            'seconds' => ['nullable', 'integer', 'min:0'],
            'minutes' => ['nullable', 'integer', 'min:0'],
            'hours' => ['nullable', 'integer', 'min:0'],
        ]);
        $seconds = (int) $request->input('seconds', 0)
            + (int) $request->input('minutes', 0) * 60
            + (int) $request->input('hours', 0) * 3600;

        return response()->json($time->advance($event, $seconds, $actor, $request));
    }

    public function debugTimeReset(
        Request $request,
        TrickEventResolver $events,
        TrickOperationAuthorizer $authorization,
        TrickDebugTimeService $time,
    ): JsonResponse {
        $event = $events->forRequest($request, app(TrickRequestIdentity::class));
        $authorization->assertDebugAdmin($event, $request);

        return response()->json($time->reset($event));
    }

    private function drawRarity(): int
    {
        return $this->weightedDraw([1 => 820, 2 => 100, 3 => 50, 4 => 25, 5 => 5]);
    }

    private function drawDifficulty(): int
    {
        $base = [1 => 54, 2 => 30, 3 => 10, 4 => 5, 5 => 1];
        $existing = $this->deckQuery()->where('state', '_deck')->pluck($this->deckColumn('difficulty'))->map(fn ($v) => (int) $v)->unique()->values()->all();
        if (count($existing) === 0) {
            return 1;
        }

        $missingWeight = 0;
        foreach ($base as $difficulty => $weight) {
            if (! in_array($difficulty, $existing, true)) {
                $missingWeight += $weight;
                unset($base[$difficulty]);
            }
        }
        $lowest = min(array_keys($base));
        $base[$lowest] += $missingWeight;

        return $this->weightedDraw($base);
    }

    private function weightedDraw(array $weights): int
    {
        $total = array_sum($weights);
        $roll = random_int(1, $total);
        foreach ($weights as $value => $weight) {
            $roll -= $weight;
            if ($roll <= 0) {
                return (int) $value;
            }
        }

        return (int) array_key_first($weights);
    }

    private function nextDrawnOrder(string $userId): int
    {
        if (! $this->hasDeckColumn('drawn_order')) {
            return 0;
        }

        return ((int) $this->handQuery($userId)->max('drawn_order')) + 1;
    }

    private function collectExpiredCards(Request $request): int
    {
        $now = Carbon::now()->toDateTimeString();
        $expired = $this->deckQuery()
            ->where('state', '_field')
            ->whereNotNull($this->deckColumn('limit_at', 'limit'))
            ->where($this->deckColumn('limit_at', 'limit'), '<=', $now)
            ->get();

        $count = 0;
        foreach ($expired as $card) {
            if ($this->collectCard($card, $request)) {
                $count++;
            }
        }

        return $count;
    }

    private function collectCard(Deck $card, Request $request): bool
    {
        if ($card->state === '_collected') {
            return false;
        }

        DB::transaction(function () use ($card, $request) {
            $card = Deck::where('id', $card->id)->lockForUpdate()->firstOrFail();
            if ($card->state === '_collected') {
                return;
            }

            $stageId = $this->postingStageId($card);
            if (! $stageId) {
                return;
            }
            $stackCount = max((int) $this->cardValue($card, 'stack_count', 'rewards'), 1);
            $difficulty = max((int) $this->cardValue($card, 'difficulty'), 1);
            $rankings = $this->rankingsForStage($stageId);

            foreach ($rankings as $row) {
                if ($row['rank'] <= $stackCount) {
                    Player::where('name', $row['user_id'])->increment('rank_points', $stackCount - $row['rank'] + 1);
                    $drawDelta = $difficulty - $row['rank'] + 1;
                    if ($drawDelta > 0) {
                        Player::where('name', $row['user_id'])->increment('draw_points', $drawDelta);
                    }
                }
            }

            $card->state = '_collected';
            $this->setCardValue($card, 'collected_at', Carbon::now()->toDateTimeString());
            $card->save();

            if ($this->hasDeckColumn('stack_parent_id')) {
                Deck::where('stack_parent_id', $card->id)->where('state', '_stack')->update(['state' => '_trash']);
            }

            $this->writeLog([
                'event' => 'collect',
                'card_id' => $this->eventCardId($card),
                'stage_id' => $stageId,
                'from_state' => '_field',
                'to_state' => '_collected',
                'records_count' => count($rankings),
                'card_snapshot' => $card->toArray(),
            ], $request);
        });

        return true;
    }

    private function rankingsForStage(int $stageId): array
    {
        $card = $this->deckByStage($stageId)->first();
        $stackCount = $card ? max((int) $this->cardValue($card, 'stack_count', 'rewards'), 1) : 1;
        $rows = Record::query()
            ->leftJoin('users', 'records.user_id', '=', 'users.user_id')
            ->where('records.stage_id', $stageId)
            ->where('records.flg', '<=', 1)
            ->select('records.*', 'users.user_name as user_name')
            ->orderByDesc('records.score')
            ->orderBy('records.created_at')
            ->get();
        $seen = [];
        $rankings = [];
        foreach ($rows as $row) {
            if (isset($seen[$row->user_id])) {
                continue;
            }
            $seen[$row->user_id] = true;
            $rank = count($rankings) + 1;
            $data = $row->toArray();
            $data['rank'] = $rank;
            $data['post_rank'] = $rank;
            $data['rps'] = max($stackCount - $rank + 1, 0);
            $data['user_name'] = $data['user_name'] ?: $data['user_id'];
            $data['score'] = (int) $data['score'];
            $rankings[] = $data;
        }

        return $rankings;
    }

    private function recalculateRankPoints(): void
    {
        Player::query()->update(['rank_points' => 0]);
        $cards = $this->deckQuery()->whereIn('state', ['_field', '_collected'])->get();
        foreach ($cards as $card) {
            $stageId = $this->postingStageId($card);
            if (! $stageId) {
                continue;
            }
            $stackCount = max((int) $this->cardValue($card, 'stack_count', 'rewards'), 1);
            foreach ($this->rankingsForStage($stageId) as $row) {
                if ($row['rank'] <= $stackCount) {
                    Player::where('name', $row['user_id'])->increment('rank_points', $stackCount - $row['rank'] + 1);
                }
            }
        }
    }

    private function ensureStageForCard(Deck $card): int
    {
        $stageId = $this->postingStageId($card);
        if ($stageId) {
            $this->createEventStage($card, $stageId);

            return $stageId;
        }

        $stageId = $this->nextEventStageId();
        $this->createEventStage($card, $stageId);
        $this->setCardValue($card, 'stage_id', $stageId);

        return $stageId;
    }

    private function withStageAllocationLock(callable $callback)
    {
        $lockName = 'tricks_stage_'.$this->configuredEventId();
        $result = DB::selectOne('SELECT GET_LOCK(?, 10) AS locked', [$lockName]);
        if ((int) ($result->locked ?? 0) !== 1) {
            abort(response()->json(['message' => 'ステージ番号の採番に失敗しました'], 409));
        }

        try {
            return (int) $callback();
        } finally {
            DB::selectOne('SELECT RELEASE_LOCK(?) AS released', [$lockName]);
        }
    }

    private function nextEventStageId(): int
    {
        $config = $this->eventStageConfig();
        $start = (int) $config['stage_id_start'];
        $end = (int) $config['stage_id_end'];
        $stageColumn = $this->deckColumn('stage_id');
        $used = DB::table('stages')
            ->whereBetween('stage_id', [$start, $end])
            ->pluck('stage_id')
            ->map(static fn ($value) => (int) $value)
            ->all();
        $usedDeckIds = $this->deckQuery()
            ->whereNotNull($stageColumn)
            ->whereBetween($stageColumn, [$start, $end])
            ->pluck($stageColumn)
            ->map(static fn ($value) => (int) $value)
            ->all();
        $usedIds = array_flip(array_merge($used, $usedDeckIds));

        for ($stageId = $start; $stageId <= $end; $stageId++) {
            if (! isset($usedIds[$stageId])) {
                return $stageId;
            }
        }

        abort(response()->json(['message' => '利用可能なイベント用ステージ番号がありません'], 409));
    }

    private function createEventStage(Deck $card, int $stageId): void
    {
        $now = Carbon::now()->toDateTimeString();
        $config = $this->eventStageConfig();
        $title = (string) ($this->cardValue($card, 'title') ?: ('カード'.$this->eventCardId($card)));
        DB::table('stages')->updateOrInsert(
            ['stage_id' => $stageId],
            [
                'stage_name' => $title,
                'eng_stage_name' => $title,
                'stage_sub' => $config['stage_sub'],
                'type' => $config['type'],
                'display' => $config['display'],
                'series' => $this->seriesFromOriginStageId($this->originStageId($card)),
                'parent' => $config['parent'],
                'time' => 0,
                'treasure' => 0,
                'pikmin' => 0,
                'border1' => 0,
                'border2' => 0,
                'border3' => 0,
                'border4' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }

    private function eventStageConfig(): array
    {
        $configs = [
            self::EVENT_ID => [
                'stage_id_start' => (int) env('TRICKS_STAGE_ID_START', self::STAGE_ID_START),
                'stage_id_end' => (int) env('TRICKS_STAGE_ID_END', self::STAGE_ID_END),
                'stage_sub' => '期間限定チャレンジ',
                'type' => 'stage',
                'display' => 'int',
                'parent' => (int) env('TRICKS_STAGE_PARENT', 260704),
            ],
        ];

        return $configs[$this->configuredEventId()] ?? $configs[self::EVENT_ID];
    }

    private function seriesFromOriginStageId(?int $originStageId): int
    {
        if (! $originStageId) {
            return 0;
        }

        return (int) substr((string) $originStageId, 0, 1);
    }

    private function eventCardId(Deck $card): int
    {
        return (int) ($this->cardValue($card, 'card_id') ?: $card->id);
    }

    private function postingStageId(Deck $card): ?int
    {
        $value = $this->cardValue($card, 'stage_id');

        return $value ? (int) $value : null;
    }

    private function originStageId(Deck $card): ?int
    {
        $value = $this->cardValue($card, 'origin_stage_id');

        return $value ? (int) $value : null;
    }

    private function deckQuery()
    {
        return Deck::query()->where($this->deckColumn('event_id', 'eventId'), $this->deckEventId());
    }

    private function deckByStage(int $stageId)
    {
        return $this->deckQuery()->where($this->deckColumn('stage_id'), $stageId);
    }

    private function handQuery(string $userId)
    {
        return $this->deckQuery()->where('state', $userId);
    }

    private function normalizeCards(Collection $cards): array
    {
        return $cards->map(fn (Deck $card) => $this->normalizeCard($card))->values()->all();
    }

    private function normalizeCard(?Deck $card): ?array
    {
        if (! $card) {
            return null;
        }

        return [
            'id' => $card->id,
            'card_id' => $this->eventCardId($card),
            'event_id' => $this->cardValue($card, 'event_id', 'eventId'),
            'stage_id' => $this->postingStageId($card),
            'origin_stage_id' => $this->originStageId($card),
            'stage_name' => $this->cardValue($card, 'title'),
            'eng_stage_name' => $this->cardValue($card, 'title'),
            'title' => $this->cardValue($card, 'title'),
            'rule_name' => $this->cardValue($card, 'rule_name'),
            'text' => $this->cardValue($card, 'text'),
            'state' => $card->state,
            'difficulty' => (int) $this->cardValue($card, 'difficulty'),
            'rarity' => $card->eventCards()->where('event_id', $this->configuredEventId())->value('rarity'),
            'stack_count' => (int) $this->cardValue($card, 'stack_count', 'rewards'),
            'creator' => $this->cardValue($card, 'creator'),
            'taker' => $this->cardValue($card, 'taker'),
            'top_player' => $this->cardValue($card, 'top_player'),
            'post_count' => (int) $this->cardValue($card, 'post_count', 'count'),
            'limit_at' => $this->cardValue($card, 'limit_at', 'limit'),
            'taken_at' => $this->cardValue($card, 'taken_at'),
            'collected_at' => $this->cardValue($card, 'collected_at'),
            'stack_parent_id' => $this->cardValue($card, 'stack_parent_id'),
        ];
    }

    private function tournamentPayload(): array
    {
        return [
            'event_id' => $this->configuredEventId(),
            'deck_event_id' => $this->deckEventId(),
            'title' => '第19回期間限定ランキング',
            'subtitle' => 'トリックテイキング制',
            'start_at' => $this->eventStart()->toIso8601String(),
            'end_at' => $this->eventEnd()->toIso8601String(),
            'server_now' => Carbon::now()->toIso8601String(),
            'debug' => $this->isDebug(),
            'available' => $this->isAvailable(),
        ];
    }

    private function logsPayload(): array
    {
        return LimitLog::query()
            ->whereIn('event', ['join', 'join_existing', 'draw', 'take', 'collect', 'first_record_posted', 'limit_extended'])
            ->latest()
            ->limit(self::POLL_LIMIT)
            ->get()
            ->reverse()
            ->values()
            ->all();
    }

    private function writeLog(array $data, Request $request = null): void
    {
        LimitLog::create(array_merge([
            'route' => $request?->path(),
            'ip' => $request?->ip(),
            'user_agent' => $request?->header('User-Agent'),
            'request_id' => (string) ($request?->header('X-Request-Id') ?: Str::uuid()),
        ], $data));
    }

    private function collectedAdminStatsPayload(TrickEvent $event): array
    {
        $stats = Player::query()->where('event_id', $event->event_id)->get()
            ->mapWithKeys(fn (Player $player) => [$player->name => [
                'user_id' => $player->name,
                'total_rank_points' => (int) $player->rank_points,
                'collected_card_count' => 0,
                'take_count' => (int) $player->take_count,
                'draw_count' => 0,
                'return_count' => 0,
                'post_count' => 0,
                'spent_points' => 0,
                'creator_take_count' => 0,
            ]])->all();
        $cards = TrickEventCard::query()->with('deck')->where('event_id', $event->event_id)->get();

        foreach ($cards->whereNotNull('taker') as $card) {
            $creator = $card->deck?->creator;
            if ($creator && isset($stats[$creator])) {
                $stats[$creator]['creator_take_count']++;
            }
        }

        $logs = LimitLog::query()->where('event_id', $event->event_id)
            ->whereIn('event', ['draw', 'return_to_deck', 'record_posted', 'record_updated', 'player_extension', 'balance_tax_collected'])
            ->get();
        foreach ($logs as $log) {
            $playerName = $log->event === 'balance_tax_collected' ? $log->affected_player_name : $log->actor_name;
            if (! $playerName || ! isset($stats[$playerName])) {
                continue;
            }
            if ($log->event === 'draw') {
                $stats[$playerName]['draw_count']++;
            }
            if ($log->event === 'return_to_deck') {
                $stats[$playerName]['return_count']++;
            }
            if (in_array($log->event, ['record_posted', 'record_updated'], true)) {
                $stats[$playerName]['post_count']++;
            }
            if ((int) $log->points_delta < 0) {
                $stats[$playerName]['spent_points'] -= (int) $log->points_delta;
            }
        }

        $holders = TrickCardHolder::query()->where('event_id', $event->event_id)
            ->whereIn('event_card_id', $cards->where('state', '_collected')->pluck('id'))
            ->orderBy('id')->get()->groupBy('event_card_id');
        $payments = TrickCardPayment::query()->where('event_id', $event->event_id)
            ->whereIn('event_card_id', $holders->keys())->orderBy('event_card_id')->orderBy('created_at')->orderBy('id')->get()
            ->groupBy('event_card_id');
        foreach ($holders as $eventCardId => $cardHolders) {
            $holderNames = $cardHolders->pluck('player_name');
            $firstHolder = $payments->get($eventCardId, collect())
                ->first(fn (TrickCardPayment $payment) => $holderNames->contains($payment->player_name))?->player_name
                ?? $holderNames->first();
            if ($firstHolder && isset($stats[$firstHolder])) {
                $stats[$firstHolder]['collected_card_count']++;
            }
        }

        return collect($stats)->sortByDesc('total_rank_points')->values()->all();
    }

    private function userId(Request $request, TrickEvent $event = null): ?string
    {
        return $event === null
            ? app(TrickRequestIdentity::class)->resolve($request)
            : app(TrickRequestIdentity::class)->resolveForEvent($request, $event);
    }

    private function requireUserId(Request $request, TrickEvent $event = null): string
    {
        $userId = $this->userId($request, $event);
        if (! $userId) {
            abort(response()->json(['message' => '認証が必要です'], 401));
        }

        return $userId;
    }

    private function assertAvailable(): void
    {
        if (! $this->isAvailable()) {
            abort(response()->json(['message' => '大会開催時間外です'], 403));
        }
    }

    private function isAvailable(): bool
    {
        return $this->isDebug() || (Carbon::now()->between($this->eventStart(), $this->eventEnd()));
    }

    private function isEnded(): bool
    {
        return Carbon::now()->greaterThanOrEqualTo($this->eventEnd());
    }

    private function isDebug(): bool
    {
        return filter_var(env('TRICKS_DEBUG', false), FILTER_VALIDATE_BOOLEAN);
    }

    private function configuredEventId(): int
    {
        return (int) env('TRICKS_EVENT_ID', self::EVENT_ID);
    }

    private function deckEventId(): int
    {
        $column = $this->deckColumn('event_id', 'eventId');
        $eventId = $this->configuredEventId();
        if (Deck::query()->where($column, $eventId)->exists()) {
            return $eventId;
        }

        if ($this->isDebug()) {
            $fallback = Deck::query()
                ->whereNotNull($column)
                ->orderByDesc($column)
                ->value($column);

            if ($fallback) {
                return (int) $fallback;
            }
        }

        return $eventId;
    }

    private function eventStart(): Carbon
    {
        return Carbon::parse(env('TRICKS_START_AT', self::START_AT), 'Asia/Tokyo');
    }

    private function eventEnd(): Carbon
    {
        return Carbon::parse(env('TRICKS_END_AT', self::END_AT), 'Asia/Tokyo');
    }

    private function deckColumn(string $preferred, string $fallback = null): string
    {
        if ($this->hasDeckColumn($preferred)) {
            return $preferred;
        }

        return $fallback && $this->hasDeckColumn($fallback) ? $fallback : $preferred;
    }

    private function hasDeckColumn(string $column): bool
    {
        if (! $this->deckColumns) {
            $this->deckColumns = Schema::getColumnListing('decks');
        }

        return in_array($column, $this->deckColumns, true);
    }

    private function cardValue(Deck $card, string $preferred, string $fallback = null)
    {
        if ($this->hasDeckColumn($preferred)) {
            return $card->{$preferred};
        }
        if ($fallback && $this->hasDeckColumn($fallback)) {
            return $card->{$fallback};
        }

        return null;
    }

    private function setCardValue(Deck $card, string $preferred, $value, string $fallback = null): void
    {
        if ($this->hasDeckColumn($preferred)) {
            $card->{$preferred} = $value;

            return;
        }
        if ($fallback && $this->hasDeckColumn($fallback)) {
            $card->{$fallback} = $value;
        }
    }
}
