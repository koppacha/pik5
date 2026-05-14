<?php

namespace App\Http\Controllers;

use App\Models\Deck;
use App\Models\LimitLog;
use App\Models\Player;
use App\Models\Record;
use Carbon\Carbon;
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
    private const STAGE_ID_START = 1313;
    private const STAGE_ID_END = 9999;

    private array $deckColumns = [];

    public function tournament(): JsonResponse
    {
        return response()->json($this->tournamentPayload());
    }

    public function state(Request $request): JsonResponse
    {
        $this->collectExpiredCards($request);

        $userId = $this->userId($request);
        $players = Player::query()
            ->orderByDesc('rank_points')
            ->orderBy('name')
            ->get();

        $fieldStates = $this->isEnded() && !$this->isDebug()
            ? ['_field', '_collected']
            : ['_field'];

        return response()->json([
            'tournament' => $this->tournamentPayload(),
            'me' => $userId ? Player::where('name', $userId)->first() : null,
            'players' => $players,
            'deck_count' => $this->deckQuery()->where('state', '_deck')->count(),
            'trash_count' => $this->deckQuery()->where('state', '_trash')->count(),
            'field' => $this->normalizeCards($this->deckQuery()->whereIn('state', $fieldStates)->get()),
            'hand' => $userId ? $this->normalizeCards($this->handQuery($userId)->orderBy($this->deckColumn('drawn_order', 'updated_at'))->orderBy('updated_at')->get()) : [],
            'logs' => $this->logsPayload(),
            'server_now' => Carbon::now()->toIso8601String(),
        ]);
    }

    public function players(): JsonResponse
    {
        return response()->json(Player::query()->orderByDesc('rank_points')->orderBy('name')->get());
    }

    public function hand(Request $request): JsonResponse
    {
        $userId = $this->requireUserId($request);

        return response()->json($this->normalizeCards($this->handQuery($userId)->orderBy($this->deckColumn('drawn_order', 'updated_at'))->orderBy('updated_at')->get()));
    }

    public function field(): JsonResponse
    {
        return response()->json($this->normalizeCards($this->deckQuery()->where('state', '_field')->get()));
    }

    public function logs(): JsonResponse
    {
        return response()->json($this->logsPayload());
    }

    public function join(Request $request): JsonResponse
    {
        $this->assertAvailable();
        $userId = $this->requireUserId($request);
        $payload = null;

        DB::transaction(function () use ($userId, $request, &$payload) {
            $player = Player::where('name', $userId)->lockForUpdate()->first();
            $created = false;

            if (!$player) {
                $player = Player::create([
                    'name' => $userId,
                    'draw_points' => 3,
                    'rank_points' => 0,
                    'card_count' => 0,
                ]);
                $created = true;
            }

            if ($created && $this->handQuery($userId)->count() === 0) {
                for ($i = 0; $i < 3; $i++) {
                    $this->drawOne($player, false);
                }
            }

            $player->card_count = $this->handQuery($userId)->count();
            $player->save();

            $this->writeLog([
                'event' => $created ? 'join' : 'join_existing',
                'actor_name' => $userId,
                'player_snapshot' => $player->toArray(),
            ], $request);

            $payload = [
                'player' => $player->fresh(),
                'created' => $created,
                'hand' => $this->normalizeCards($this->handQuery($userId)->get()),
            ];
        });

        return response()->json($payload);
    }

    public function draw(Request $request): JsonResponse
    {
        $this->assertAvailable();
        $userId = $this->requireUserId($request);
        $payload = null;

        DB::transaction(function () use ($userId, $request, &$payload) {
            $player = Player::where('name', $userId)->lockForUpdate()->firstOrFail();
            $card = $this->drawOne($player, true);
            $player->card_count = $this->handQuery($userId)->count();
            $player->save();

            $this->writeLog([
                'event' => 'draw',
                'actor_name' => $userId,
                'card_id' => $card ? $this->eventCardId($card) : null,
                'stage_id' => $card ? $this->postingStageId($card) : null,
                'remaining_draw_points' => $player->draw_points,
                'remaining_deck_count' => $this->deckQuery()->where('state', '_deck')->count(),
                'card_snapshot' => $card?->toArray(),
                'player_snapshot' => $player->toArray(),
            ], $request);

            $payload = [
                'card' => $card ? $this->normalizeCard($card) : null,
                'player' => $player->fresh(),
                'hand' => $this->normalizeCards($this->handQuery($userId)->get()),
            ];
        });

        return response()->json($payload);
    }

    public function take(Request $request, int $deckId): JsonResponse
    {
        $this->assertAvailable();
        $userId = $this->requireUserId($request);
        $payload = null;

        $this->withStageAllocationLock(function () use ($userId, $deckId, $request, &$payload) {
            DB::transaction(function () use ($userId, $deckId, $request, &$payload) {
                $player = Player::where('name', $userId)->lockForUpdate()->firstOrFail();
                $hand = $this->handQuery($userId)->lockForUpdate()->get();
                $selected = $hand->firstWhere('id', $deckId);

                if (!$selected) {
                    abort(response()->json(['message' => '対象カードが手札にありません'], 409));
                }
                if ($hand->count() < 3) {
                    abort(response()->json(['message' => 'テイクには手札が3枚以上必要です'], 422));
                }
                if (!$this->isDebug() && Carbon::now()->greaterThanOrEqualTo($this->eventEnd()->subHour())) {
                    abort(response()->json(['message' => '大会終了1時間前以降はテイクできません'], 403));
                }

                $fieldCount = $this->deckQuery()->where('state', '_field')->lockForUpdate()->count();
                $participantCount = max(Player::count(), 1);
                if ($fieldCount >= $participantCount + 5 || $fieldCount > 15) {
                    abort(response()->json(['message' => '場札の上限に達しています'], 409));
                }

                $stackIds = $hand->where('id', '!=', $deckId)->pluck('id')->values()->all();
                $this->deckQuery()->whereIn('id', $stackIds)->update(array_filter([
                    'state' => '_stack',
                    'stack_parent_id' => $this->hasDeckColumn('stack_parent_id') ? $deckId : null,
                ], static fn ($value) => $value !== null));

                $stageId = $this->ensureStageForCard($selected);
                $selected->state = '_field';
                $this->setCardValue($selected, 'taker', $userId);
                $this->setCardValue($selected, 'stack_count', $hand->count(), 'rewards');
                $this->setCardValue($selected, 'taken_at', Carbon::now()->toDateTimeString());
                $this->setCardValue($selected, 'limit_at', null, 'limit');
                $selected->save();

                $player->card_count = 0;
                $player->save();

                $this->writeLog([
                    'event' => 'take',
                    'actor_name' => $userId,
                    'card_id' => $this->eventCardId($selected),
                    'stage_id' => $stageId,
                    'to_state' => '_field',
                    'hand_count' => $hand->count(),
                    'rewards' => $hand->count(),
                    'stacked_card_ids' => $stackIds,
                    'card_snapshot' => $selected->toArray(),
                    'player_snapshot' => $player->toArray(),
                ], $request);

                $payload = [
                    'card' => $this->normalizeCard($selected->fresh()),
                    'player' => $player->fresh(),
                ];
            });
        });

        return response()->json($payload);
    }

    public function scores(int $deckId): JsonResponse
    {
        $card = Deck::findOrFail($deckId);
        $stageId = $this->postingStageId($card);
        if (!$stageId) {
            return response()->json([]);
        }

        return response()->json($this->rankingsForStage($stageId));
    }

    public function recordPosted(Request $request): JsonResponse
    {
        $stageId = (int) $request->input('stage_id');
        if (!$stageId) {
            return response()->json(['message' => 'stage_id is required'], 422);
        }

        $payload = null;
        DB::transaction(function () use ($stageId, $request, &$payload) {
            $card = $this->deckByStage($stageId)->where('state', '_field')->lockForUpdate()->firstOrFail();
            $rankings = $this->rankingsForStage($stageId);
            $now = Carbon::now();
            $previousLimit = $this->cardValue($card, 'limit_at', 'limit');
            $newLimit = $previousLimit ? Carbon::parse($previousLimit)->addMinutes(15) : $now->copy()->addMinutes(90);
            if (!$this->isDebug() && $now->greaterThanOrEqualTo($this->eventEnd()->subHour())) {
                $newLimit = $previousLimit ? Carbon::parse($previousLimit) : null;
            }

            $this->setCardValue($card, 'limit_at', $newLimit?->toDateTimeString(), 'limit');
            $this->setCardValue($card, 'post_count', count($rankings), 'count');
            $this->setCardValue($card, 'top_player', $rankings[0]['user_id'] ?? null, 'topPlayer');
            $card->save();

            $this->recalculateRankPoints();
            $this->writeLog([
                'event' => $previousLimit ? 'limit_extended' : 'first_record_posted',
                'actor_name' => $this->userId($request),
                'card_id' => $this->eventCardId($card),
                'stage_id' => $stageId,
                'previous_limit' => $previousLimit,
                'new_limit' => $newLimit?->toDateTimeString(),
                'records_count' => count($rankings),
                'top_user_id' => $rankings[0]['user_id'] ?? null,
                'top_score' => $rankings[0]['score'] ?? null,
                'card_snapshot' => $card->toArray(),
            ], $request);

            $payload = ['card' => $this->normalizeCard($card->fresh()), 'rankings' => $rankings];
        });

        return response()->json($payload);
    }

    public function collect(Request $request, int $deckId): JsonResponse
    {
        $card = Deck::findOrFail($deckId);
        $this->collectCard($card, $request);

        return response()->json(['card' => $this->normalizeCard($card->fresh())]);
    }

    public function collectExpired(Request $request): JsonResponse
    {
        $count = $this->collectExpiredCards($request);

        return response()->json(['collected' => $count]);
    }

    private function drawOne(Player $player, bool $consumePoint): ?Deck
    {
        if ($consumePoint && $player->draw_points <= 0) {
            abort(response()->json(['message' => 'ドローポイントがありません'], 422));
        }

        if ($this->deckQuery()->where('state', '_deck')->count() === 0) {
            $this->deckQuery()->where('state', '_trash')->update(['state' => '_deck']);
        }

        $difficulty = $this->drawDifficulty();
        $rarity = $this->drawRarity();
        $query = $this->deckQuery()->where('state', '_deck')->where($this->deckColumn('difficulty'), $difficulty);
        if (!$query->exists()) {
            $query = $this->deckQuery()->where('state', '_deck');
        }

        $card = $query->inRandomOrder()->lockForUpdate()->first();
        if (!$card) {
            return null;
        }

        $card->state = $player->name;
        $this->setCardValue($card, 'rarity', $rarity);
        $this->setCardValue($card, 'drawn_order', $this->nextDrawnOrder($player->name));
        $card->save();

        if ($consumePoint) {
            --$player->draw_points;
        }

        return $card;
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
            if (!in_array($difficulty, $existing, true)) {
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
        if (!$this->hasDeckColumn('drawn_order')) {
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
                ++$count;
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
            if (!$stageId) {
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
            if (!$stageId) {
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
        $lockName = 'tricks_stage_' . $this->configuredEventId();
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
            if (!isset($usedIds[$stageId])) {
                return $stageId;
            }
        }

        abort(response()->json(['message' => '利用可能なイベント用ステージ番号がありません'], 409));
    }

    private function createEventStage(Deck $card, int $stageId): void
    {
        $now = Carbon::now()->toDateTimeString();
        $config = $this->eventStageConfig();
        $title = (string) ($this->cardValue($card, 'title') ?: ('カード' . $this->eventCardId($card)));
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
        if (!$originStageId) {
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
        $value = $this->cardValue($card, 'origin_stage_id', 'stageId');
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
        if (!$card) {
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
            'rule_name' => $this->cardValue($card, 'rule_name', 'ruleName'),
            'text' => $this->cardValue($card, 'text'),
            'state' => $card->state,
            'difficulty' => (int) $this->cardValue($card, 'difficulty'),
            'rarity' => (int) $this->cardValue($card, 'rarity'),
            'stack_count' => (int) $this->cardValue($card, 'stack_count', 'rewards'),
            'creator' => $this->cardValue($card, 'creator'),
            'taker' => $this->cardValue($card, 'taker'),
            'top_player' => $this->cardValue($card, 'top_player', 'topPlayer'),
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

    private function writeLog(array $data, ?Request $request = null): void
    {
        LimitLog::create(array_merge([
            'route' => $request?->path(),
            'ip' => $request?->ip(),
            'user_agent' => $request?->header('User-Agent'),
            'request_id' => (string) ($request?->header('X-Request-Id') ?: Str::uuid()),
        ], $data));
    }

    private function userId(Request $request): ?string
    {
        $value = $request->input('userId') ?? $request->query('userId') ?? $request->header('X-User-Id');
        return $value ? (string) $value : null;
    }

    private function requireUserId(Request $request): string
    {
        $userId = $this->userId($request);
        if (!$userId) {
            abort(response()->json(['message' => 'userId is required'], 401));
        }

        return $userId;
    }

    private function assertAvailable(): void
    {
        if (!$this->isAvailable()) {
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
        return filter_var(env('TRICKS_DEBUG', true), FILTER_VALIDATE_BOOLEAN);
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

    private function deckColumn(string $preferred, ?string $fallback = null): string
    {
        if ($this->hasDeckColumn($preferred)) {
            return $preferred;
        }

        return $fallback && $this->hasDeckColumn($fallback) ? $fallback : $preferred;
    }

    private function hasDeckColumn(string $column): bool
    {
        if (!$this->deckColumns) {
            $this->deckColumns = Schema::getColumnListing('decks');
        }

        return in_array($column, $this->deckColumns, true);
    }

    private function cardValue(Deck $card, string $preferred, ?string $fallback = null)
    {
        if ($this->hasDeckColumn($preferred)) {
            return $card->{$preferred};
        }
        if ($fallback && $this->hasDeckColumn($fallback)) {
            return $card->{$fallback};
        }

        return null;
    }

    private function setCardValue(Deck $card, string $preferred, $value, ?string $fallback = null): void
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
