<?php

namespace App\Http\Controllers;

use App\Models\SwissGame;
use App\Models\SwissMatch;
use App\Models\SwissPlayer;
use App\Models\SwissRound;
use App\Models\SwissTournament;
use App\Services\SwissPairingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SwissTournamentController extends Controller
{
    private const STAGES = [351, 352, 353, 354, 355, 356, 357, 358, 359, 360, 361, 362];

    public function index(): JsonResponse
    {
        return response()->json(SwissTournament::orderByDesc('id')->get()->map(fn ($t) => $this->summary($t)));
    }

    public function show(SwissTournament $tournament): JsonResponse
    {
        return response()->json($this->state($tournament));
    }

    public function create(Request $request): JsonResponse
    {
        $title = trim((string)$request->input('title'));
        if ($title === '') return response()->json(['message' => 'title is required'], 422);
        $tournament = SwissTournament::create(['title' => $title, 'stage_pool' => self::STAGES]);
        return response()->json($this->state($tournament), 201);
    }

    public function addPlayer(Request $request, SwissTournament $tournament): JsonResponse
    {
        $request->validate(['name' => 'required|string|max:255']);
        $displayName = trim($request->input('name'));
        if ($displayName === '') return response()->json(['message' => '名前を入力してください。'], 422);
        $userId = (string)\Illuminate\Support\Str::uuid();
        $this->registrationOnly($tournament);
        DB::transaction(function () use ($tournament, $request, $userId, $displayName) {
            $lockedTournament = SwissTournament::lockForUpdate()->findOrFail($tournament->id);
            $this->registrationOnly($lockedTournament);
            $order = (int)SwissPlayer::where('tournament_id', $tournament->id)->max('registration_order') + 1;
            SwissPlayer::create([
                'tournament_id' => $tournament->id,
                'user_id' => $userId,
                'display_name' => $displayName,
                'provisional_rank' => $request->filled('provisional_rank') ? (int)$request->input('provisional_rank') : null,
                'registration_order' => $order,
            ]);
        });
        return response()->json($this->state($tournament));
    }

    public function removePlayer(SwissTournament $tournament, string $userId): JsonResponse
    {
        $this->registrationOnly($tournament);
        $deleted = SwissPlayer::where('tournament_id', $tournament->id)->where('user_id', $userId)->delete();
        if (!$deleted) return response()->json(['message' => 'player not found'], 404);
        return response()->json($this->state($tournament));
    }

    public function draw(SwissTournament $tournament): JsonResponse
    {
        DB::transaction(function () use ($tournament) {
            $tournament = SwissTournament::lockForUpdate()->findOrFail($tournament->id);
            $active = SwissRound::where('tournament_id', $tournament->id)->orderByDesc('round_no')->lockForUpdate()->first();
            if ($active && $active->status !== 'completed') abort(422, 'all matches must be completed');

            $players = SwissPlayer::where('tournament_id', $tournament->id)->lockForUpdate()->get();
            if ($players->count() < 2) abort(422, 'at least two players are required');
            $history = $this->previousPairs($tournament->id);
            $nextNo = (int)SwissRound::where('tournament_id', $tournament->id)->max('round_no') + 1;
            $service = new SwissPairingService();

            $swissCount = SwissRound::where('tournament_id', $tournament->id)->where('phase', 'swiss')->count();
            if ($swissCount < $tournament->standard_rounds) {
                $pairs = $service->swiss($players->map(fn ($p) => $p->toArray())->all(), $history, $swissCount === 0);
                $phase = 'swiss';
                $tournament->status = 'active';
            } elseif ($active && $active->phase === 'final') {
                $ids = SwissMatch::where('round_id', $active->id)->pluck('winner_user_id')->filter()->all();
                if (count($ids) <= 1) { $tournament->status = 'completed'; $tournament->save(); return; }
                $pairs = $service->elimination($players->whereIn('user_id', $ids)->map(fn ($p) => $p->toArray())->all(), $history);
                $phase = 'final';
            } else {
                $topWins = $players->max('wins');
                $finalists = $players->where('wins', $topWins);
                if ($finalists->count() <= 1) { $tournament->status = 'completed'; $tournament->save(); return; }
                $pairs = $service->elimination($finalists->map(fn ($p) => $p->toArray())->all(), $history);
                $phase = 'final';
            }

            $round = SwissRound::create(['tournament_id' => $tournament->id, 'round_no' => $nextNo, 'phase' => $phase]);
            $matchNo = (int)SwissMatch::where('tournament_id', $tournament->id)->max('match_no');
            foreach ($pairs as $pair) {
                $matchNo++;
                SwissMatch::create([
                    'tournament_id' => $tournament->id, 'round_id' => $round->id, 'match_no' => $matchNo,
                    'player1_user_id' => $pair['player1'], 'player2_user_id' => $pair['player2'],
                    'winner_user_id' => $pair['bye'] ? $pair['player1'] : null, 'is_bye' => $pair['bye'],
                    'status' => $pair['bye'] ? 'completed' : 'pending',
                ]);
                if ($pair['bye']) {
                    $player = $players->firstWhere('user_id', $pair['player1']);
                    $player->increment('bye_count');
                    if ($phase === 'swiss') $player->increment('wins');
                }
            }
            if (!SwissMatch::where('round_id', $round->id)->where('status', '!=', 'completed')->exists()) $round->update(['status' => 'completed']);
            $tournament->save();
        });
        return response()->json($this->state($tournament->fresh()));
    }

    public function startGame(SwissTournament $tournament, SwissMatch $match): JsonResponse
    {
        $game = DB::transaction(function () use ($tournament, $match) {
            SwissTournament::lockForUpdate()->findOrFail($tournament->id);
            $match = SwissMatch::lockForUpdate()->findOrFail($match->id);
            if ($match->tournament_id !== $tournament->id || $match->status === 'completed' || $match->is_bye) abort(422, 'match is not playable');
            if (SwissGame::where('match_id', $match->id)->whereNull('result')->exists()) abort(422, 'a game is already awaiting a result');
            $recent = SwissGame::where('tournament_id', $tournament->id)->orderByDesc('game_no')->lockForUpdate()->limit(6)->pluck('stage_id')->all();
            $pool = array_values(array_diff($tournament->stage_pool, $recent));
            if (!$pool) $pool = $tournament->stage_pool;
            $gameNo = (int)SwissGame::where('tournament_id', $tournament->id)->max('game_no') + 1;
            $matchGameNo = (int)SwissGame::where('match_id', $match->id)->max('match_game_no') + 1;
            $match->update(['status' => 'active']);
            return SwissGame::create(['tournament_id' => $tournament->id, 'match_id' => $match->id, 'game_no' => $gameNo, 'match_game_no' => $matchGameNo, 'stage_id' => $pool[array_rand($pool)]]);
        });
        return response()->json(['game' => $game, 'state' => $this->state($tournament)]);
    }

    public function submitGame(Request $request, SwissTournament $tournament, SwissMatch $match, SwissGame $game): JsonResponse
    {
        $result = (string)$request->input('result');
        if (!in_array($result, ['player1', 'player2', 'draw'], true)) return response()->json(['message' => 'invalid result'], 422);
        DB::transaction(function () use ($tournament, $match, $game, $result) {
            SwissTournament::lockForUpdate()->findOrFail($tournament->id);
            if ($match->tournament_id !== $tournament->id || $game->match_id !== $match->id) abort(404);
            $game = SwissGame::lockForUpdate()->findOrFail($game->id);
            $match = SwissMatch::lockForUpdate()->findOrFail($match->id);
            if ($game->result !== null || $match->status === 'completed') abort(422, 'game already completed');
            $resultSequence = (int) SwissGame::where('tournament_id', $tournament->id)->max('result_sequence') + 1;
            $winner = $result === 'player1' ? $match->player1_user_id : ($result === 'player2' ? $match->player2_user_id : null);
            $game->update(['result' => $result, 'winner_user_id' => $winner, 'result_sequence' => $resultSequence]);
            if ($result === 'player1') $match->increment('player1_wins');
            if ($result === 'player2') $match->increment('player2_wins');
            $match->refresh();
            if ($match->player1_wins < 2 && $match->player2_wins < 2) return;
            $matchWinner = $match->player1_wins === 2 ? $match->player1_user_id : $match->player2_user_id;
            $match->update(['winner_user_id' => $matchWinner, 'status' => 'completed']);
            $round = SwissRound::lockForUpdate()->findOrFail($match->round_id);
            if ($round->phase === 'swiss') {
                SwissPlayer::where('tournament_id', $tournament->id)->where('user_id', $matchWinner)->increment('wins');
                $loser = $matchWinner === $match->player1_user_id ? $match->player2_user_id : $match->player1_user_id;
                SwissPlayer::where('tournament_id', $tournament->id)->where('user_id', $loser)->increment('losses');
            }
            if (!SwissMatch::where('round_id', $round->id)->where('status', '!=', 'completed')->exists()) $round->update(['status' => 'completed']);
        });
        return response()->json($this->state($tournament->fresh()));
    }

    public function undoResult(Request $request, SwissTournament $tournament): JsonResponse
    {
        DB::transaction(function () use ($request, $tournament) {
            $tournament = SwissTournament::lockForUpdate()->findOrFail($tournament->id);
            $game = SwissGame::where('tournament_id', $tournament->id)->whereNotNull('result')
                ->orderByDesc('result_sequence')->orderByDesc('updated_at')->orderByDesc('id')->lockForUpdate()->first();
            if (!$game || (int)$request->input('game_id') !== $game->id) abort(409, '取り消し対象が更新されました。画面を更新してください。');
            $match = SwissMatch::lockForUpdate()->findOrFail($game->match_id);
            $round = SwissRound::findOrFail($match->round_id);
            if (SwissRound::where('tournament_id', $tournament->id)->where('round_no', '>', $round->round_no)->exists()) {
                abort(409, '次ラウンド抽選後は前ラウンドの結果を取り消せません。');
            }
            if (SwissGame::where('match_id', $match->id)->where('match_game_no', '>', $game->match_game_no)->exists()) {
                abort(409, 'このマッチの次ゲームが抽選済みのため取り消せません。');
            }
            if ($match->status === 'completed' && $round->phase === 'swiss') {
                SwissPlayer::where('tournament_id', $tournament->id)->where('user_id', $match->winner_user_id)->decrement('wins');
                $loser = $match->winner_user_id === $match->player1_user_id ? $match->player2_user_id : $match->player1_user_id;
                SwissPlayer::where('tournament_id', $tournament->id)->where('user_id', $loser)->decrement('losses');
            }
            if ($game->result === 'player1') $match->player1_wins--;
            if ($game->result === 'player2') $match->player2_wins--;
            $match->fill(['status' => 'active', 'winner_user_id' => null])->save();
            $game->update(['result' => null, 'winner_user_id' => null, 'result_sequence' => null]);
            $round->update(['status' => 'active']);
            $tournament->update(['status' => 'active']);
        });
        return response()->json($this->state($tournament->fresh()));
    }

    private function registrationOnly(SwissTournament $tournament): void
    {
        if ($tournament->status !== 'registration') abort(422, 'registration is closed');
    }

    private function previousPairs(int $id): array
    {
        $pairs = [];
        foreach (SwissMatch::where('tournament_id', $id)->whereNotNull('player2_user_id')->get() as $match) {
            $pairs[(new SwissPairingService())->key($match->player1_user_id, $match->player2_user_id)] = true;
        }
        return $pairs;
    }

    private function summary(SwissTournament $tournament): array
    {
        return ['id' => $tournament->id, 'title' => $tournament->title, 'status' => $tournament->status, 'player_count' => SwissPlayer::where('tournament_id', $tournament->id)->count(), 'created_at' => $tournament->created_at];
    }

    private function state(SwissTournament $tournament): array
    {
        $players = SwissPlayer::where('tournament_id', $tournament->id)->orderByDesc('wins')->orderBy('losses')->orderBy('provisional_rank')->get();
        $rounds = SwissRound::where('tournament_id', $tournament->id)->orderBy('round_no')->get()->map(function ($round) {
            $matches = SwissMatch::where('round_id', $round->id)->orderBy('match_no')->get()->map(function ($match) {
                $match->games = SwissGame::where('match_id', $match->id)->orderBy('match_game_no')->get();
                return $match;
            });
            return ['id' => $round->id, 'round_no' => $round->round_no, 'phase' => $round->phase, 'status' => $round->status, 'matches' => $matches];
        });
        return ['tournament' => $tournament, 'players' => $players, 'rounds' => $rounds, 'can_draw' => !$rounds->last() || $rounds->last()['status'] === 'completed'];
    }
}
