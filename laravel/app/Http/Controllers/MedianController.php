<?php

namespace App\Http\Controllers;

use App\Services\Median\MedianIdentity;
use App\Services\Median\MedianNumbers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MedianController extends Controller
{
    public function handle(Request $request, MedianIdentity $identity)
    {
        $who = $identity->resolve($request);
        // Restore signed raw text after Laravel's global trim/null middleware, for this endpoint only.
        if ($request->isMethod('POST')) $request->replace(json_decode($request->getContent(), true) ?? []);
        return DB::transaction(function () use ($request, $who) {
            $room = DB::table('median_rooms')->where('id', 1)->lockForUpdate()->first();
            $row = $room->game_id ? DB::table('median_games')->where('id', $room->game_id)->lockForUpdate()->first() : null;
            if ($row && $row->expires_at && now()->greaterThanOrEqualTo($row->expires_at)) {
                DB::table('median_games')->where('id', $row->id)->delete();
                DB::table('median_rooms')->where('id', 1)->update(['game_id' => null]);
                $row = null;
            }
            $game = $row ? json_decode($row->state, true) : null;
            if ($game && $game['phase'] === 'closing' && now()->valueOf() >= $game['round']['closeDeadline']) {
                $this->finishClose($game);
                $game['version']++;
                $this->save($game);
            }
            if ($request->isMethod('GET')) return $this->view($game, $who['key']);
            $data = $request->validate(['action' => 'required|string|in:join,answer,queue,suggest,receive,show,close,reveal,next,leave,remove,end,restart']);
            $action = $data['action'];
            abort_unless($who['key'], 401);
            if ($action === 'join') {
                $request->validate(['host' => 'required|boolean']);
                if (!$game || ($game['ended'] && $request->boolean('host'))) {
                    $game = $this->newGame();
                }
                abort_if($game['ended'], 409, 'ゲームは終了しています');
                $key = $who['key'];
                if ($request->boolean('host')) {
                    abort_if($game['host'] && $game['host'] !== $key, 409, '主催は既に参加しています');
                    $game['host'] = $key;
                }
                if (!isset($game['players'][$key])) {
                    abort_if(count($game['players']) >= 100, 422, '参加人数の上限は100人です');
                    $game['players'][$key] = ['id' => $key, 'name' => $who['name'], 'score' => 0, 'active' => true, 'order' => count($game['players'])];
                } else {
                    $game['players'][$key]['active'] = true;
                    $game['players'][$key]['name'] = $who['name'];
                }
                if ($game['phase'] === 'answering' && !in_array($key, $game['round']['players'], true)) {
                    $game['round']['players'][] = $key;
                }
            } else {
                abort_unless($game && $request->input('gameId') === $game['id'], 409, 'ゲームが切り替わりました');
                abort_unless($game['players'][$who['key']]['active'] ?? false, 403, '参加してから操作してください');
                abort_if($game['ended'] && $action !== 'restart', 409, 'ゲームは終了しています');
                $host = $game['host'] === $who['key'];
                if (!in_array($action, ['answer', 'suggest', 'leave'], true)) abort_unless($host, 403, '主催のみ操作できます');
                if ($action === 'answer') {
                    $final = $game['phase'] === 'closing' && $request->input('closeToken') === $game['round']['closeToken']
                        && in_array($who['key'], $game['round']['pendingFinal'], true);
                    abort_unless(($game['phase'] === 'answering' || $final) && $request->input('roundId') === $game['round']['id']
                        && in_array($who['key'], $game['round']['players'], true), 409, '回答は締め切られています');
                    $request->validate(['answer' => 'required|array', 'answer.raw' => 'present|nullable|string|max:512', 'answer.value' => ['required', 'string', 'regex:/\A-?[0-9](?:\.[0-9]{1,29})?e[+-]?[0-9]{1,6}\z/'],
                        'answer.display' => 'required|string|max:128', 'answer.valid' => 'required|boolean', 'answer.error' => 'nullable|string|max:200']);
                    $answer = $request->input('answer');
                    MedianNumbers::compare($answer['value'], '0e+0');
                    $game['round']['drafts'][$who['key']] = array_intersect_key($answer, array_flip(['raw', 'value', 'display', 'valid', 'error']));
                    if ($final) {
                        $game['round']['pendingFinal'] = array_values(array_diff($game['round']['pendingFinal'], [$who['key']]));
                        if (!$game['round']['pendingFinal']) $this->finishClose($game);
                    }
                } elseif ($action === 'queue') {
                    $request->validate(['text' => 'present|nullable|string|max:20000', 'queueVersion' => 'required|integer']);
                    abort_unless($request->integer('queueVersion') === $game['queueVersion'], 409, 'お題が更新されました。再読み込みして編集してください');
                    $lines = preg_split('/\R/u', $request->input('text') ?? '');
                    $game['queue'] = array_values(array_filter(array_map('trim', $lines), fn ($line) => $line !== ''));
                    abort_if(count($game['queue']) > 200 || collect($game['queue'])->contains(fn ($line) => mb_strlen($line) > 400), 422, 'お題は1行400文字・200件以内にしてください');
                    $game['queueVersion']++;
                } elseif ($action === 'suggest') {
                    $request->validate(['text' => 'required|string|max:250']);
                    abort_if(preg_match('/\R/u', $request->input('text')), 422, 'お題は1行で投稿してください');
                    abort_if(count($game['inbox']) >= 200, 422, '受信箱がいっぱいです');
                    $game['inbox'][] = ['text' => $request->input('text'), 'name' => $game['players'][$who['key']]['name']];
                } elseif ($action === 'receive') {
                    abort_if(count($game['queue']) + count($game['inbox']) > 200, 422, 'お題を減らしてから受け取ってください');
                    $received = array_map(fn ($idea) => $idea['text'].'（出題: '.$idea['name'].'）', $game['inbox']);
                    abort_if(mb_strlen(implode("\n", [...$game['queue'], ...$received])) > 20000, 422, 'お題を減らしてから受け取ってください');
                    $game['queue'] = [...$game['queue'], ...$received];
                    $game['inbox'] = [];
                    $game['queueVersion']++;
                } elseif ($action === 'show') {
                    abort_unless($game['phase'] === 'waiting' && count($game['queue']), 409, '次のお題を登録してください');
                    $game['round'] = ['id' => count($game['history']) + 1, 'prompt' => array_shift($game['queue']),
                        'players' => array_column(array_filter($this->orderedPlayers($game), fn ($p) => $p['active']), 'id'), 'drafts' => []];
                    $game['queueVersion']++;
                    $game['phase'] = 'answering';
                } elseif ($action === 'close') {
                    abort_unless($game['phase'] === 'answering', 409, '回答受付中ではありません');
                    abort_if($request->has('roundId') && $request->input('roundId') !== $game['round']['id'], 409, '問題が切り替わりました');
                    $game['phase'] = 'closing';
                    $game['round']['closeToken'] = bin2hex(random_bytes(16));
                    $game['round']['closeDeadline'] = now()->addSeconds(8)->valueOf();
                    $game['round']['pendingFinal'] = array_values(array_filter($game['round']['players'], fn ($key) => $key !== $who['key'] && ($game['players'][$key]['active'] ?? false)));
                    if (!$game['round']['pendingFinal']) $this->finishClose($game);
                } elseif ($action === 'reveal') {
                    abort_unless($game['phase'] === 'closed', 409, '締切後に開示してください');
                    $game['phase'] = 'revealed';
                    unset($game['pendingPoints']);
                    $game['history'][] = ['id' => $game['round']['id'], 'prompt' => $game['round']['prompt'], 'answers' => $game['round']['answers']];
                } elseif ($action === 'next') {
                    abort_unless($game['phase'] === 'revealed', 409, '回答を開示してから進んでください');
                    $game['phase'] = 'waiting';
                    $game['round'] = null;
                } elseif ($action === 'leave' || $action === 'remove') {
                    $key = $action === 'leave' ? $who['key'] : $request->input('playerId');
                    abort_if($key === $game['host'], 422, '主催は終了ボタンを使用してください');
                    abort_unless(isset($game['players'][$key]), 404);
                    $game['players'][$key]['active'] = false;
                    if ($game['phase'] === 'closing') {
                        $game['round']['pendingFinal'] = array_values(array_diff($game['round']['pendingFinal'], [$key]));
                        if (!$game['round']['pendingFinal']) $this->finishClose($game);
                    }
                } elseif ($action === 'end') {
                    $game['ended'] = true;
                    $game['endedAt'] = now()->toIso8601String();
                    $game['expiresAt'] = now()->addDay()->toIso8601String();
                } elseif ($action === 'restart') {
                    $old = $game;
                    $old['ended'] = true;
                    $old['endedAt'] = now()->toIso8601String();
                    $old['expiresAt'] = now()->addDay()->toIso8601String();
                    $this->save($old);
                    $game = $this->newGame();
                    foreach (['host', 'players', 'queue', 'inbox'] as $field) $game[$field] = $old[$field];
                    foreach ($game['players'] as &$player) $player['score'] = 0;
                    unset($player);
                }
            }
            $game['version']++;
            $this->save($game);
            return $this->view($game, $who['key']);
        });
    }

    private function newGame(): array
    {
        $id = now()->setTimezone('Asia/Tokyo')->format('YmdHis');
        abort_if(DB::table('median_games')->where('id', $id)->exists(), 409, '1秒待ってから開始してください');
        return ['id' => $id, 'host' => null, 'players' => [], 'queue' => [], 'inbox' => [], 'history' => [], 'round' => null,
            'phase' => 'waiting', 'ended' => false, 'endedAt' => null, 'expiresAt' => null, 'version' => 0, 'queueVersion' => 0];
    }

    private function save(array $game): void
    {
        DB::table('median_games')->insertOrIgnore(['id' => $game['id'], 'state' => '{}', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('median_games')->where('id', $game['id'])->update(['state' => json_encode($game, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'ended_at' => $game['endedAt'] ? \Carbon\Carbon::parse($game['endedAt']) : null,
            'expires_at' => $game['expiresAt'] ? \Carbon\Carbon::parse($game['expiresAt']) : null, 'updated_at' => now()]);
        DB::table('median_rooms')->where('id', 1)->update(['game_id' => $game['id']]);
    }

    private function view(?array $game, ?string $key)
    {
        if (!$game) return response()->json(['game' => null])->header('Cache-Control', 'no-store, private');
        $host = $key && $game['host'] === $key;
        $member = $key && ($game['players'][$key]['active'] ?? false);
        $round = $game['round'];
        $answers = $round['answers'] ?? [];
        if ($round) {
            $round = ['id' => $round['id'], 'prompt' => $round['prompt'], 'own' => $member ? ($round['drafts'][$key] ?? null) : null,
                'submitted' => count($round['drafts']), 'eligible' => $member && in_array($key, $round['players'], true)];
            if ($game['phase'] === 'closing') {
                $round += ['closeToken' => $game['round']['closeToken'], 'closeDeadline' => $game['round']['closeDeadline'],
                    'awaitingFinal' => $member && in_array($key, $game['round']['pendingFinal'], true)];
            }
            if ($game['phase'] === 'revealed') {
                $round['answers'] = $answers;
                $sorted = $answers;
                usort($sorted, fn ($a, $b) => MedianNumbers::compare($a['value'], $b['value']));
                $round['sorted'] = $sorted;
            }
        }
        $players = $this->orderedPlayers($game);
        // Persist scores at close, but do not disclose the answer-dependent delta until reveal.
        foreach ($players as &$player) $player['score'] -= $game['pendingPoints'][$player['id']] ?? 0;
        unset($player);
        $result = ['id' => $game['id'], 'phase' => $game['phase'], 'ended' => $game['ended'], 'endedAt' => $game['endedAt'], 'expiresAt' => $game['expiresAt'],
            'version' => $game['version'], 'host' => $game['host'], 'me' => $member ? $key : null, 'isHost' => (bool) $host,
            'players' => $players, 'round' => $round, 'history' => $game['history']];
        if ($host) $result += ['queue' => $game['queue'], 'queueVersion' => $game['queueVersion'], 'inboxCount' => count($game['inbox'])];
        return response()->json(['game' => $result])->header('Cache-Control', 'no-store, private');
    }

    private function orderedPlayers(array $game): array
    {
        $players = array_values($game['players']);
        // MySQL JSON object keys have no insertion-order guarantee.
        usort($players, fn ($a, $b) => ($a['order'] ?? 0) <=> ($b['order'] ?? 0));
        return $players;
    }

    private function finishClose(array &$game): void
    {
        $answers = [];
        foreach ($this->orderedPlayers($game) as $player) {
            $key = $player['id'];
            if (!in_array($key, $game['round']['players'], true)) continue;
            $draft = $game['round']['drafts'][$key] ?? ['raw' => '', 'value' => '0e+0', 'display' => '0', 'valid' => true, 'error' => null];
            $answers[] = ['playerId' => $key, 'name' => $game['players'][$key]['name'], ...$draft];
        }
        $game['round']['answers'] = MedianNumbers::score($answers);
        $game['pendingPoints'] = [];
        foreach ($game['round']['answers'] as $answer) {
            $game['players'][$answer['playerId']]['score'] += $answer['points'];
            $game['pendingPoints'][$answer['playerId']] = $answer['points'];
        }
        $game['phase'] = 'closed';
        unset($game['round']['pendingFinal'], $game['round']['closeToken'], $game['round']['closeDeadline']);
    }
}
