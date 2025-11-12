<?php
namespace App\Http\Controllers;

use App\Models\Deck;
use App\Models\Player;
use App\Models\Record;
use App\Models\LimitLog;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CardController extends Controller
{
    /**
     * Write a unified event log row (LimitLog model should map to event_logs table and cast JSON fields).
     */
    private function writeLog(array $data, ?Request $request = null): void
    {
        // Common meta
        $meta = [
            'route'       => $request?->path(),
            'ip'          => $request?->ip(),
            'user_agent'  => $request?->header('User-Agent'),
            'request_id'  => (string) ($request?->header('X-Request-Id') ?: Str::uuid()),
        ];
        // Create via model (assumes fillable/guarded is configured accordingly)
        LimitLog::create(array_merge($meta, $data));
    }
    // 山札からドロー
    public function draw(Request $request): JsonResponse
    {
        // body / query / header の順で userId を受理
        $userId = (string) ($request->input('userId') ?? $request->query('userId') ?? $request->header('X-User-Id'));
        if ($userId === '') {
            return response()->json(['message' => 'userId is required'], 422);
        }
        $payload = null;
        DB::transaction(function () use ($userId, &$payload, $request) {
            // 1) プレイヤー行をロックしてポイント確認
            $player = Player::where('name', $userId)->lockForUpdate()->firstOrFail();

            if ($player->draw_points <= 0) {
                // ポイントが無ければ何もしない
                $payload = [
                    'card' => null,
                    'remaining_draw_points' => $player->draw_points,
                ];
                return;
            }

            // 2) 山札（未配布）の中からランダムに1枚ロックして取得
            //    ※ 運用に合わせて「山札」の定義を調整してください
            $card = Deck::where(static function ($q) {
                $q->whereNull('state')        // まだ誰にも配られていない
                ->orWhere('state', '_deck'); // 初期状態が'_deck'の場合
            })
                ->inRandomOrder()
                ->lockForUpdate()
                ->first();

            if (!$card) {
                // 山札が空：手札枚数を Deck 実数に同期（誤差防止）
                $player->card_count = Deck::where('state', $userId)->lockForUpdate()->count();
                $player->save();

                $payload = [
                    'card' => null,
                    'remaining_draw_points' => $player->draw_points,
                    'message' => 'no available cards',
                ];
                return;
            }

            // 3) 取得者を設定して保存
            $prevState = $card->state;
            $card->state = $userId;
            $card->save();

            // 4) ドローポイントを1だけ消費し、手札枚数を Deck 実数に同期
            $actualHandCount = Deck::where('state', $userId)->lockForUpdate()->count();
            --$player->draw_points;
            $player->card_count = $actualHandCount;
            $player->save();

            $remainingDeck = Deck::where(static function ($q) {
                    $q->whereNull('state')->orWhere('state', '_deck');
                })->count();

            $this->writeLog([
                'event'                    => 'draw',
                'actor_name'               => $userId,
                'card_id'                  => $card->id,
                'stage_id'                 => $card->stage_id ?? ($card->stageId ?? null),
                'from_state'               => $prevState,
                'to_state'                 => $userId,
                'remaining_draw_points'    => $player->draw_points,
                'remaining_deck_count'     => $remainingDeck,
                'card_snapshot'            => $card->toArray(),
                'player_snapshot'          => $player->toArray(),
            ], $request);

            // 返却ペイロード
            $payload = [
                'card' => $card,
                'remaining_draw_points' => $player->draw_points,
            ];
        });

        return response()->json($payload);
    }

    // 自分の手札取得
    public function hand(Request $request)
    {
        $userId = (string) ($request->input('userId') ?? $request->query('userId'));
        return Deck::where('state', $userId)->get();
    }

    // フィールド上のカード取得
    public function fieldCards()
    {
        return Deck::where('state', '_field')->get();
    }

    // テイク
    public function take(Request $request, $id): Response|JsonResponse
    {
        // Accept userId from JSON body, query string, or header; fall back to current card owner
        $userId = (string) ($request->input('userId') ?? $request->query('userId') ?? $request->header('X-User-Id'));
        if (!$id) {
            return response()->json(['message' => 'id is required'], 422);
        }
        if (!$userId) {
            // Fallback: if this card is still in hand, its state should be the owner's userId
            $ownerState = Deck::where('id', $id)->value('state');
            if (is_string($ownerState) && $ownerState !== '' && $ownerState !== '_field' && $ownerState !== '_stack' && $ownerState !== 'trash') {
                $userId = (string) $ownerState;
            }
        }
        if (!$userId) {
            return response()->json(['message' => 'userId is required'], 422);
        }

        // 取引外でログに使う値を初期化（クロージャから参照渡し）
        $fromState = null;
        $previousLimit = null;
        $stackIds = [];
        $handCount = null;
        $blockedByHandCount = false;
        DB::transaction(function () use ($userId, $id, &$blockedByHandCount, &$fromState, &$previousLimit, &$stackIds, &$handCount) {
            // 1) 手札の行をロックしつつ、テイク時点の手札枚数を取得
            $handCount = Deck::where('state', $userId)
                ->lockForUpdate()
                ->count();

            // テイクは手札が3枚以上でのみ可能（2枚以下なら処理中止）
            if ($handCount <= 2) {
                $blockedByHandCount = true;
                return;
            }

            // 2) limit の日時（現在 + 1時間）を指定フォーマットで作成
            $limitAt = Carbon::now()->addHour()->format('Y-m-d H:i:s');

            // 事前情報: テイク対象のカードと前状態/前limit
            $selected = Deck::where('id', $id)->lockForUpdate()->first();
            $fromState = $selected?->state;
            $previousLimit = $selected?->limit;

            // スタック対象カードID一覧（選択カード以外の自分の手札）
            $stackIds = Deck::where('state', $userId)
                ->where('id', '!=', $id)
                ->pluck('id')
                ->all();

            // 3) 選択されていない手札をスタックへ移動
            Deck::where('state', $userId)
                ->where('id', '!=', $id)
                ->update(['state' => '_stack']);

            // 4) 選択カードをフィールドへ移動し、追加情報を書き込み（ロックして保存）
            if ($selected) {
                $selected->state   = '_field';
                $selected->rewards = $handCount;
                $selected->taker   = $userId;
                $selected->limit   = $limitAt;
                $selected->save();
            }
            // 5) プレイヤーの手札枚数を 0 にリセット
            Player::where('name', $userId)->update(['card_count' => 0]);
        });

        if ($blockedByHandCount) {
            return response()->json(['message' => 'take requires at least 3 cards in hand'], 422);
        }

        // ログ書き込み（transaction 後に最新スナップショットで）
        $selectedAfter = Deck::find($id);
        $this->writeLog([
            'event'                  => 'take',
            'actor_name'             => $userId,
            'card_id'                => $id,
            'stage_id'               => $selectedAfter?->stage_id ?? ($selectedAfter?->stageId ?? null),
            'from_state'             => $fromState ?? null,
            'to_state'               => '_field',
            'hand_count'             => $handCount ?? null,
            'rewards'                => $selectedAfter?->rewards,
            'previous_limit'         => $previousLimit ?? null,
            'new_limit'              => $selectedAfter?->limit ?? null,
            'stacked_card_ids'       => $stackIds ?? [],
            'card_snapshot'          => $selectedAfter?->toArray(),
        ], $request);

        return response()->noContent();
    }
    // リミットオーバー処理
    public function limitOver(Request $request, $id): Response
    {
        DB::transaction(function () use ($id, $request) {
            // 1) 対象カードをロックして取得
            /** @var Deck $card */
            $card = Deck::where('id', $id)->lockForUpdate()->firstOrFail();

            $fromState = $card->state;

            // 2) state を trash に更新
            $card->state = '_trash';
            $card->save();

            $this->writeLog([
                'event'      => 'limit_over',
                'actor_name' => null,
                'card_id'    => $card->id,
                'stage_id'   => $card->stage_id ?? ($card->stageId ?? null),
                'from_state' => $fromState,
                'to_state'   => $card->state,
                'card_snapshot' => $card->toArray(),
            ], $request);

            // 3) stageId & rewards(n) を取得（stageId or stage_id どちらでも対応）
            $stageId = $card->stageId ?? $card->stage_id ?? null;
            $n = (int) ($card->rewards ?? 0);

            if (!$stageId || $n <= 0) {
                // ステージ未設定や n=0 の場合は何もしない（要求仕様に合わせるなら return）
                return;
            }

            // 4) Record 抽出：stage一致 & flg > 1 を除外し、同一ユーザーは最大スコアのみ残す
            //    -> user_id ごとに MAX(score) を取る
            $bestPerPlayer = Record::query()
                ->where('stage_id', $stageId)
                ->where('flg', '<=', 1) // 「flg > 1 を除外」
                ->select('user_id', DB::raw('MAX(score) AS best_score'))
                ->groupBy('user_id')
                ->get();

            if ($bestPerPlayer->isEmpty()) {
                return;
            }

            // 5) スコア降順でランキング（同点は user_id 昇順で安定化）
            $ranked = $bestPerPlayer
                ->sortBy([
                    ['best_score', 'desc'],
                    ['user_id', 'asc'],
                ])
                ->values();

            $participants = $ranked->count();
            $topN = min($n, $participants);
            $bottomN = min($n, $participants);

            // 6) 加算量をプレイヤーごとに集計（重複対象は合算）
            $rankPointsDelta = []; // user_id => delta
            $drawPointsDelta = []; // user_id => delta

            // 上位 n： rank_points += (順位 - n + 1)
            for ($i = 0; $i < $topN; $i++) {
                $playerId = $ranked[$i]->user_id;
                $rank = $i + 1; // 1-based
                $delta = $rank - $n + 1;

                if ($delta !== 0) {
                    $rankPointsDelta[$playerId] = ($rankPointsDelta[$playerId] ?? 0) + $delta;
                }
            }

            // 下位 n： draw_points += (n - (参加人数 - 順位))
            for ($i = 0; $i < $bottomN; $i++) {
                $idx = $participants - 1 - $i;
                $playerId = $ranked[$idx]->user_id;
                $rank = $idx + 1; // 1-based
                $delta = $n - ($participants - $rank);

                if ($delta !== 0) {
                    $drawPointsDelta[$playerId] = ($drawPointsDelta[$playerId] ?? 0) + $delta;
                }
            }

            $perPlayerDeltas = []; // user_id => ['rank_delta'=>x, 'draw_delta'=>y]
            foreach ($rankPointsDelta as $playerId => $delta) {
                $perPlayerDeltas[$playerId]['rank_delta'] = ($perPlayerDeltas[$playerId]['rank_delta'] ?? 0) + $delta;
            }
            foreach ($drawPointsDelta as $playerId => $delta) {
                $perPlayerDeltas[$playerId]['draw_delta'] = ($perPlayerDeltas[$playerId]['draw_delta'] ?? 0) + $delta;
            }

            // 7) Player テーブルへ一括反映（INCREMENT）
            foreach ($perPlayerDeltas as $playerId => $deltas) {
                $rankDelta = $deltas['rank_delta'] ?? 0;
                $drawDelta = $deltas['draw_delta'] ?? 0;

                if ($rankDelta !== 0) {
                    Player::where('name', $playerId)->increment('rank_points', $rankDelta);
                }
                if ($drawDelta !== 0) {
                    Player::where('name', $playerId)->increment('draw_points', $drawDelta);
                }

                // ログ（各プレイヤー1行）
                $this->writeLog([
                    'event'                 => 'limit_over_update',
                    'actor_name'            => null,
                    'card_id'               => $card->id,
                    'stage_id'              => $card->stage_id ?? ($card->stageId ?? null),
                    'affected_player_id'    => $playerId,
                    'rank_points_delta'     => $rankDelta ?: null,
                    'draw_points_delta'     => $drawDelta ?: null,
                ], $request);
            }
        });

        return response()->noContent();
    }
    // 記録投稿時の更新処理
    public function updateStageOnRecord($stage_id): Response
    {
        DB::transaction(function () use ($stage_id) {
            // 1) 対象レコード群（stage_id = $stage_id, flg < 2）を集計
            $recordsQuery = Record::query()
                ->where('stage_id', $stage_id)
                ->where('flg', '<', 2);

            $totalCount = (clone $recordsQuery)->count();

            // 最高スコア（同点は created_at 昇順 → 早いもの勝ち）を取得
            $top = (clone $recordsQuery)
                ->orderBy('score', 'desc')
                ->orderBy('created_at')
                ->select('user_id', 'score')
                ->first();

            $topPlayerId = $top?->user_id;

            // 2) 該当の Deck 行をロックして取得
            $decks = Deck::query()
                ->where(function ($q) use ($stage_id) {
                    $q->where('stageId', $stage_id);
                })
                ->lockForUpdate()
                ->get();

            if ($decks->isEmpty()) {
                // ログ: 対象の Deck が存在しないケースでもイベントを記録
                $this->writeLog([
                    'event'         => 'update_stage_on_record',
                    'actor_name'    => null,
                    'card_id'       => null,
                    'stage_id'      => $stage_id,
                    'previous_limit'=> null,
                    'new_limit'     => null,
                    'top_user_id'   => $top?->user_id,
                    'top_score'     => $top?->score,
                    'records_count' => $totalCount,
                    'context'       => ['reason' => 'no_decks'],
                ]);
                return;
            }

            // 3) limit を 15 分加算して保存（NULL の場合は now + 15分）
            foreach ($decks as $deck) {
                $currentLimit = $deck->limit
                    ? Carbon::parse($deck->limit)
                    : Carbon::now();

                $prevLimit = $deck->limit ? Carbon::parse($deck->limit) : null;

                $newLimit = $currentLimit->copy()->addMinutes(15)->format('Y-m-d H:i:s');

                $deck->count     = $totalCount;      // 記録総数
                $deck->topPlayer = $topPlayerId;     // 最高スコアの user_id
                $deck->limit     = $newLimit;        // 15分加算
                $deck->save();

                $this->writeLog([
                    'event'          => 'update_stage_on_record',
                    'actor_name'     => null,
                    'card_id'        => $deck->id,
                    'stage_id'       => $deck->stage_id ?? ($deck->stageId ?? null),
                    'previous_limit' => optional($prevLimit)?->format('Y-m-d H:i:s'),
                    'new_limit'      => $newLimit,
                    'top_user_id'    => $top?->user_id,
                    'top_score'      => $top?->score,
                    'records_count'  => $totalCount,
                    'card_snapshot'  => $deck->toArray(),
                ]);
            }
        });

        return response()->noContent();
    }
}
