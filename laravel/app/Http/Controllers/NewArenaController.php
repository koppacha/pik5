<?php

namespace App\Http\Controllers;

use App\Models\ArenaEvent;
use App\Models\ArenaMatch;
use App\Models\ArenaPlayer;
use App\Models\ArenaResult;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NewArenaController extends Controller
{
    private const DEFAULT_POINT = 1000;
    private const MATCH_LIMIT = 20;
    private const PAYMENT_RATE = 0.10;
    private const PAYMENT_EXTRA_DIVISOR = 10000;
    private const MIN_PAYMENT = 50;
    private const MAX_PAYMENT = 220;
    private const RECEIVER_FEE_RATE = 0.10;
    private const MIN_RECEIVER_FEE = 5;
    private const MAX_RECEIVER_FEE = 15;
    private const MIN_WIN_PROFIT = 5;
    private const MAX_WINNER_SHARE = 0.90;

    private const HOLDER_WIN_SHARE_BY_STREAK = [
        0 => 0.70,
        1 => 0.70,
        2 => 0.71,
        3 => 0.72,
        4 => 0.73,
    ];

    private const CHALLENGER_WIN_SHARE_BY_STREAK = [
        0 => 0.70,
        1 => 0.72,
        2 => 0.74,
        3 => 0.76,
        4 => 0.78,
    ];

    public function state(): JsonResponse
    {
        $event = $this->currentEvent();
        return response()->json($this->buildState($event));
    }

    public function addPlayer(Request $request): JsonResponse
    {
        $userId = trim((string)$request->input('user_id', ''));
        if ($userId === '') {
            return response()->json(['error' => true, 'message' => 'user_id is required'], 422);
        }

        $event = $this->currentEvent();

        try {
            DB::transaction(function () use ($event, $userId) {
                $existing = ArenaPlayer::where('event_id', $event->id)
                    ->where('user_id', $userId)
                    ->lockForUpdate()
                    ->first();

                if ($existing && $existing->active) {
                    throw new Exception('already joined');
                }

                $lastPoint = $this->latestPointBeforeEvent($event, $userId);
                $position = ((int)ArenaPlayer::where('event_id', $event->id)
                    ->where('active', true)
                    ->max('position')) + 1;

                if ($existing) {
                    $existing->fill([
                        'position' => $position,
                        'start_point' => $lastPoint,
                        'current_point' => $lastPoint,
                        'active' => true,
                        'joined_at' => now(),
                        'left_at' => null,
                    ])->save();
                    return;
                }

                ArenaPlayer::create([
                    'event_id' => $event->id,
                    'user_id' => $userId,
                    'position' => $position,
                    'start_point' => $lastPoint,
                    'current_point' => $lastPoint,
                    'active' => true,
                    'joined_at' => now(),
                ]);
            });
        } catch (Exception $e) {
            if ($e->getMessage() === 'already joined') {
                return response()->json(['error' => true, 'message' => 'already joined'], 409);
            }
            return response()->json(['error' => true, 'message' => $e->getMessage()], 500);
        }

        return response()->json($this->buildState($event));
    }

    public function removePlayer(Request $request): JsonResponse
    {
        $userId = trim((string)$request->input('user_id', ''));
        if ($userId === '') {
            return response()->json(['error' => true, 'message' => 'user_id is required'], 422);
        }

        $event = $this->currentEvent();

        try {
            DB::transaction(function () use ($event, $userId) {
                $player = ArenaPlayer::where('event_id', $event->id)
                    ->where('user_id', $userId)
                    ->lockForUpdate()
                    ->first();

                if (!$player || !$player->active) {
                    throw new Exception('not joined');
                }

                $player->fill([
                    'active' => false,
                    'position' => 0,
                    'left_at' => now(),
                ])->save();

                $this->normalizePositions($event);
            });
        } catch (Exception $e) {
            if ($e->getMessage() === 'not joined') {
                return response()->json(['error' => true, 'message' => 'not joined'], 404);
            }
            return response()->json(['error' => true, 'message' => $e->getMessage()], 500);
        }

        return response()->json($this->buildState($event));
    }

    public function shufflePlayers(): JsonResponse
    {
        $event = $this->currentEvent();
        if ($this->latestMatchNo($event) > 0) {
            return response()->json(['error' => true, 'message' => 'matches already started'], 409);
        }

        DB::transaction(function () use ($event) {
            $players = ArenaPlayer::where('event_id', $event->id)
                ->where('active', true)
                ->lockForUpdate()
                ->get()
                ->shuffle()
                ->values();

            foreach ($players as $index => $player) {
                $player->position = $index + 1;
                $player->save();
            }
        });

        return response()->json($this->buildState($event));
    }

    public function submitResult(Request $request): JsonResponse
    {
        $event = $this->currentEvent();
        $stageId = $request->input('stage_id');
        $holderUserId = trim((string)$request->input('user_id_1p', ''));
        $challengerUserId = trim((string)$request->input('user_id_2p', ''));
        $score1p = (string)$request->input('score_1p', '');
        $score2p = (string)$request->input('score_2p', '');
        $result = (int)$request->input('result', 0);

        if (!in_array($result, [1, -1, 0], true)) {
            return response()->json(['error' => true, 'message' => 'invalid result'], 422);
        }
        if ($holderUserId === '' || $challengerUserId === '') {
            return response()->json(['error' => true, 'message' => 'players are required'], 422);
        }

        try {
            DB::transaction(function () use ($event, $stageId, $holderUserId, $challengerUserId, $score1p, $score2p, $result) {
                $players = ArenaPlayer::where('event_id', $event->id)
                    ->where('active', true)
                    ->orderBy('position')
                    ->lockForUpdate()
                    ->get();

                if ($players->count() < 2) {
                    throw new Exception('not enough players');
                }

                $holder = $players->firstWhere('user_id', $holderUserId);
                $challenger = $players->firstWhere('user_id', $challengerUserId);
                if (!$holder || !$challenger || $holderUserId === $challengerUserId) {
                    throw new Exception('invalid players');
                }

                $receiverIds = $players
                    ->filter(static fn ($player) => !in_array($player->user_id, [$holderUserId, $challengerUserId], true))
                    ->sortBy('position')
                    ->pluck('user_id')
                    ->values()
                    ->all();

                $matchNo = $this->latestMatchNo($event) + 1;
                $stats = $this->calculateStats($event);
                $holderStreakBefore = (int)($stats[$holderUserId]['current_streak'] ?? 0);

                $holderPayment = $this->paymentFromRating((int)$holder->current_point);
                $challengerPayment = $this->paymentFromRating((int)$challenger->current_point);
                $receiverFeeEach = $holderStreakBefore > 0 ? $this->receiverFeeFromHolderPayment($holderPayment) : 0;
                $receiverFeeTotal = $receiverFeeEach * count($receiverIds);
                $pot = $holderPayment + $challengerPayment + $receiverFeeTotal;

                $points = [];
                $payments = [];
                $gains = [];
                foreach ($players as $player) {
                    $points[$player->user_id] = (int)$player->current_point;
                    $payments[$player->user_id] = 0;
                    $gains[$player->user_id] = 0;
                }

                if ($result !== 0) {
                    $isHolderWin = $result === 1;
                    $winnerPayment = $isHolderWin ? $holderPayment : $challengerPayment;
                    $baseShare = $isHolderWin
                        ? $this->holderWinShare($holderStreakBefore)
                        : $this->challengerWinShare($holderStreakBefore);
                    $winnerShare = $this->applyWinnerShareFloor($baseShare, $winnerPayment, $pot);
                    $winnerGain = (int)round($pot * $winnerShare);
                    $loserGain = $pot - $winnerGain;

                    $payments[$holderUserId] = $holderPayment;
                    $payments[$challengerUserId] = $challengerPayment;
                    foreach ($receiverIds as $receiverId) {
                        $payments[$receiverId] = $receiverFeeEach;
                    }

                    if ($isHolderWin) {
                        $gains[$holderUserId] = $winnerGain;
                        $gains[$challengerUserId] = $loserGain;
                    } else {
                        $gains[$challengerUserId] = $winnerGain;
                        $gains[$holderUserId] = $loserGain;
                    }
                }

                $match = ArenaMatch::create([
                    'event_id' => $event->id,
                    'match_no' => $matchNo,
                    'stage_id' => $stageId !== null && $stageId !== '' ? (int)$stageId : null,
                    'holder_user_id' => $holderUserId,
                    'challenger_user_id' => $challengerUserId,
                    'receiver_user_ids' => $receiverIds,
                    'result' => $result,
                    'holder_streak_before' => $holderStreakBefore,
                ]);

                $rows = [];
                $now = now();
                foreach ($players as $player) {
                    $userId = $player->user_id;
                    $score = '-1';
                    $rowResult = 0;
                    if ($userId === $holderUserId) {
                        $score = $score1p;
                        $rowResult = $result;
                    } elseif ($userId === $challengerUserId) {
                        $score = $score2p;
                        $rowResult = $result === 0 ? 0 : -$result;
                    }

                    $pointResult = $points[$userId] - $payments[$userId] + $gains[$userId];
                    $rows[] = [
                        'event_id' => $event->id,
                        'match_id' => $match->id,
                        'match_no' => $matchNo,
                        'stage_id' => $stageId !== null && $stageId !== '' ? (int)$stageId : null,
                        'user_id' => $userId,
                        'position' => (int)$player->position,
                        'score' => $score,
                        'point' => $points[$userId],
                        'point_result' => $pointResult,
                        'payment' => $payments[$userId],
                        'gain' => $gains[$userId],
                        'result' => $rowResult,
                        'flg' => 0,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];

                    $player->current_point = $pointResult;
                    $player->save();
                }

                ArenaResult::insert($rows);
                $this->updatePositionsAfterMatch($event, $players, $holderUserId, $challengerUserId, $result);
            });
        } catch (Exception $e) {
            return response()->json(['error' => true, 'message' => $e->getMessage()], 422);
        }

        return response()->json($this->buildState($event));
    }

    private function currentEvent(): ArenaEvent
    {
        $eventId = (int)now()->format('Ymd');

        return ArenaEvent::firstOrCreate(
            ['event_id' => $eventId],
            [
                'title' => 'ピクチャレアリーナ対戦',
                'match_limit' => self::MATCH_LIMIT,
                'status' => 'active',
            ]
        );
    }

    private function buildState(ArenaEvent $event): array
    {
        $stats = $this->calculateStats($event);
        $players = ArenaPlayer::where('event_id', $event->id)
            ->where('active', true)
            ->orderBy('position')
            ->get()
            ->map(function ($player) use ($stats) {
                $userStats = $stats[$player->user_id] ?? $this->emptyStats();
                return [
                    'user_id' => $player->user_id,
                    'position' => (int)$player->position,
                    'start_point' => (int)$player->start_point,
                    'current_point' => (int)$player->current_point,
                    'wins' => $userStats['wins'],
                    'losses' => $userStats['losses'],
                    'highest_streak' => $userStats['highest_streak'],
                    'current_streak' => $userStats['current_streak'],
                ];
            })
            ->values();

        $historyMatches = ArenaMatch::where('event_id', $event->id)
            ->orderByDesc('match_no')
            ->limit(20)
            ->get();
        $historyMatchIds = $historyMatches->pluck('id')->all();
        $historyResults = ArenaResult::whereIn('match_id', $historyMatchIds)
            ->where('flg', 0)
            ->get()
            ->keyBy(static fn ($result) => $result->match_id . '-' . $result->user_id);
        $history = $historyMatches->map(static function ($match) use ($historyResults) {
            $holderResult = $historyResults->get($match->id . '-' . $match->holder_user_id);
            $challengerResult = $historyResults->get($match->id . '-' . $match->challenger_user_id);

            return [
                'id' => $match->id,
                'event_id' => $match->event_id,
                'match_no' => (int)$match->match_no,
                'stage_id' => $match->stage_id !== null ? (int)$match->stage_id : null,
                'holder_user_id' => $match->holder_user_id,
                'challenger_user_id' => $match->challenger_user_id,
                'receiver_user_ids' => $match->receiver_user_ids,
                'result' => (int)$match->result,
                'holder_result' => $holderResult ? [
                    'point' => (int)$holderResult->point,
                    'point_result' => (int)$holderResult->point_result,
                    'score' => $holderResult->score,
                ] : null,
                'challenger_result' => $challengerResult ? [
                    'point' => (int)$challengerResult->point,
                    'point_result' => (int)$challengerResult->point_result,
                    'score' => $challengerResult->score,
                ] : null,
            ];
        })->values();

        return [
            'event' => [
                'id' => $event->id,
                'event_id' => $event->event_id,
                'title' => $event->title,
                'match_limit' => (int)$event->match_limit,
                'status' => $event->status,
            ],
            'latest_match_no' => $this->latestMatchNo($event),
            'players' => $players,
            'history' => $history,
        ];
    }

    private function latestPointBeforeEvent(ArenaEvent $event, string $userId): int
    {
        $latest = ArenaResult::where('user_id', $userId)
            ->where('event_id', '<>', $event->id)
            ->where('flg', 0)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();

        return $latest ? (int)$latest->point_result : self::DEFAULT_POINT;
    }

    private function latestMatchNo(ArenaEvent $event): int
    {
        return (int)ArenaMatch::where('event_id', $event->id)->max('match_no');
    }

    private function normalizePositions(ArenaEvent $event): void
    {
        $players = ArenaPlayer::where('event_id', $event->id)
            ->where('active', true)
            ->orderBy('position')
            ->get();

        foreach ($players as $index => $player) {
            $player->position = $index + 1;
            $player->save();
        }
    }

    private function updatePositionsAfterMatch($event, $players, string $holderUserId, string $challengerUserId, int $result): void
    {
        $ordered = $players->sortBy('position')->values();
        $others = $ordered->filter(static fn ($player) => !in_array($player->user_id, [$holderUserId, $challengerUserId], true))->values();

        if ($result === -1) {
            $nextOrder = collect([$challengerUserId])
                ->merge($others->pluck('user_id'))
                ->push($holderUserId)
                ->values();
        } else {
            $nextOrder = collect([$holderUserId])
                ->merge($others->pluck('user_id'))
                ->push($challengerUserId)
                ->values();
        }

        foreach ($nextOrder as $index => $userId) {
            ArenaPlayer::where('event_id', $event->id)
                ->where('user_id', $userId)
                ->update(['position' => $index + 1]);
        }
    }

    private function calculateStats(ArenaEvent $event): array
    {
        $stats = [];
        $matches = ArenaMatch::where('event_id', $event->id)
            ->orderBy('match_no')
            ->get();

        foreach ($matches as $match) {
            foreach ([$match->holder_user_id, $match->challenger_user_id] as $userId) {
                if (!isset($stats[$userId])) {
                    $stats[$userId] = $this->emptyStats();
                }
            }

            if ((int)$match->result === 1) {
                $this->applyWin($stats, $match->holder_user_id);
                $this->applyLoss($stats, $match->challenger_user_id);
            } elseif ((int)$match->result === -1) {
                $this->applyLoss($stats, $match->holder_user_id);
                $this->applyWin($stats, $match->challenger_user_id);
            }
        }

        return $stats;
    }

    private function emptyStats(): array
    {
        return [
            'wins' => 0,
            'losses' => 0,
            'highest_streak' => 0,
            'current_streak' => 0,
        ];
    }

    private function applyWin(array &$stats, string $userId): void
    {
        $stats[$userId]['wins']++;
        $stats[$userId]['current_streak']++;
        $stats[$userId]['highest_streak'] = max($stats[$userId]['highest_streak'], $stats[$userId]['current_streak']);
    }

    private function applyLoss(array &$stats, string $userId): void
    {
        $stats[$userId]['losses']++;
        $stats[$userId]['current_streak'] = 0;
    }

    private function paymentFromRating(int $rating): int
    {
        $extra = max(0, $rating - 1000);
        $payment = (int)round($rating * self::PAYMENT_RATE + ($extra * $extra) / self::PAYMENT_EXTRA_DIVISOR);
        return $this->clamp($payment, self::MIN_PAYMENT, self::MAX_PAYMENT);
    }

    private function receiverFeeFromHolderPayment(int $holderPayment): int
    {
        $fee = (int)round($holderPayment * self::RECEIVER_FEE_RATE);
        return $this->clamp($fee, self::MIN_RECEIVER_FEE, self::MAX_RECEIVER_FEE);
    }

    private function holderWinShare(int $streak): float
    {
        return self::HOLDER_WIN_SHARE_BY_STREAK[$streak] ?? 0.75;
    }

    private function challengerWinShare(int $streak): float
    {
        return self::CHALLENGER_WIN_SHARE_BY_STREAK[$streak] ?? 0.80;
    }

    private function applyWinnerShareFloor(float $baseShare, int $winnerPayment, int $pot): float
    {
        if ($pot <= 0) {
            return $baseShare;
        }

        $minShare = ($winnerPayment + self::MIN_WIN_PROFIT) / $pot;
        return min(max($baseShare, $minShare), self::MAX_WINNER_SHARE);
    }

    private function clamp(int $value, int $min, int $max): int
    {
        return max($min, min($value, $max));
    }
}
