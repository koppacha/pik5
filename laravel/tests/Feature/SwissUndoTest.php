<?php

namespace Tests\Feature;

use App\Models\SwissTournament;
use App\Models\SwissPlayer;
use App\Models\SwissRound;
use App\Models\SwissMatch;
use App\Models\SwissGame;
use Tests\TestCase;

class SwissUndoTest extends TestCase
{
    private function createTables(): void
    {
        foreach (glob(database_path('migrations/2026_09_22_*.php')) as $file) {
            (require $file)->up();
        }
        (require database_path('migrations/2026_09_26_000001_add_display_name_to_swiss_players.php'))->up();
        (require database_path('migrations/2026_09_27_000003_add_result_sequence_to_swiss_games.php'))->up();
    }

    public function test_players_can_register_by_name_without_a_user_account(): void
    {
        $this->createTables();
        $t = SwissTournament::create(['title' => 'Name test', 'stage_pool' => range(351, 362)]);
        $url = '/api/swiss-tournaments/'.$t->id.'/players';
        $this->postJson($url, ['name' => ' テスト参加者 ', 'provisional_rank' => 1])->assertOk();
        $this->postJson($url, ['name' => 'テスト参加者'])->assertOk();
        $players = SwissPlayer::all();
        $this->assertCount(2, $players);
        $this->assertSame('テスト参加者', $players[0]->display_name);
        $this->assertNotSame($players[0]->user_id, $players[1]->user_id);
        $this->postJson($url, ['name' => '   '])->assertStatus(422);
        $this->deleteJson($url.'/'.$players[0]->user_id)->assertOk();
        $this->assertEquals(1, SwissPlayer::count());
    }

    public function test_completed_match_can_be_reopened_without_losing_its_stage(): void
    {
        $this->createTables();
        $t = SwissTournament::create(['title' => 'Undo test', 'stage_pool' => range(351, 362), 'status' => 'completed']);
        foreach (['test_a', 'test_b'] as $i => $id) {
            SwissPlayer::create(['tournament_id' => $t->id, 'user_id' => $id, 'registration_order' => $i + 1, 'wins' => $i === 0 ? 1 : 0, 'losses' => $i]);
        }
        $r = SwissRound::create(['tournament_id' => $t->id, 'round_no' => 1, 'phase' => 'swiss', 'status' => 'completed']);
        $m = SwissMatch::create(['tournament_id' => $t->id, 'round_id' => $r->id, 'match_no' => 1, 'player1_user_id' => 'test_a', 'player2_user_id' => 'test_b', 'winner_user_id' => 'test_a', 'player1_wins' => 2, 'status' => 'completed']);
        $g = SwissGame::create(['tournament_id' => $t->id, 'match_id' => $m->id, 'game_no' => 2, 'match_game_no' => 2, 'stage_id' => 352, 'result' => 'player1', 'winner_user_id' => 'test_a']);
        $url = '/api/swiss-tournaments/'.$t->id.'/undo-result';
        $this->postJson($url, ['game_id' => $g->id])->assertOk();
        $this->assertNull($g->fresh()->result);
        $this->assertEquals(352, $g->fresh()->stage_id);
        $this->assertEquals(1, $m->fresh()->player1_wins);
        $this->assertSame('active', $r->fresh()->status);
        $this->assertSame('active', $t->fresh()->status);
        $this->assertEquals(0, SwissPlayer::sum('wins'));
        $this->assertEquals(0, SwissPlayer::sum('losses'));
        $this->postJson($url, ['game_id' => $g->id])->assertStatus(409);
        $g->update(['result' => 'draw']);
        SwissRound::create(['tournament_id' => $t->id, 'round_no' => 2]);
        $this->postJson($url, ['game_id' => $g->id])->assertStatus(409);
        $this->assertSame('draw', $g->fresh()->result);
    }

    public function test_completed_match_cannot_start_another_game(): void
    {
        $this->createTables();
        $tournament = SwissTournament::create(['title' => 'Completed match test', 'stage_pool' => range(351, 362)]);
        $round = SwissRound::create(['tournament_id' => $tournament->id, 'round_no' => 1]);
        $match = SwissMatch::create([
            'tournament_id' => $tournament->id, 'round_id' => $round->id, 'match_no' => 1,
            'player1_user_id' => 'test_a', 'player2_user_id' => 'test_b', 'status' => 'completed',
        ]);

        $this->postJson("/api/swiss-tournaments/{$tournament->id}/matches/{$match->id}/games")
            ->assertStatus(422);
        $this->assertSame(0, SwissGame::count());
    }

    public function test_undo_uses_result_submission_order_when_timestamps_tie(): void
    {
        $this->createTables();
        $tournament = SwissTournament::create(['title' => 'Result order test', 'stage_pool' => range(351, 362)]);
        $round = SwissRound::create(['tournament_id' => $tournament->id, 'round_no' => 1]);
        $games = [];
        foreach ([1, 2] as $matchNo) {
            $match = SwissMatch::create([
                'tournament_id' => $tournament->id, 'round_id' => $round->id, 'match_no' => $matchNo,
                'player1_user_id' => "test_{$matchNo}a", 'player2_user_id' => "test_{$matchNo}b", 'status' => 'active',
            ]);
            $games[] = SwissGame::create([
                'tournament_id' => $tournament->id, 'match_id' => $match->id,
                'game_no' => $matchNo, 'match_game_no' => 1, 'stage_id' => 350 + $matchNo,
            ]);
        }

        \Illuminate\Support\Carbon::setTestNow('2026-09-27 12:00:00');
        try {
            foreach (array_reverse($games) as $game) {
                $this->postJson("/api/swiss-tournaments/{$tournament->id}/matches/{$game->match_id}/games/{$game->id}", ['result' => 'draw'])->assertOk();
            }
        } finally {
            \Illuminate\Support\Carbon::setTestNow();
        }

        $this->assertSame(1, $games[1]->fresh()->result_sequence);
        $this->assertSame(2, $games[0]->fresh()->result_sequence);
        $this->assertSame($games[0]->id, SwissGame::orderByDesc('result_sequence')->first()->id);
        $this->postJson("/api/swiss-tournaments/{$tournament->id}/undo-result", ['game_id' => $games[1]->id])->assertStatus(409);
        $this->postJson("/api/swiss-tournaments/{$tournament->id}/undo-result", ['game_id' => $games[0]->id])->assertOk();
        $this->assertNull($games[0]->fresh()->result_sequence);
        $this->assertSame('draw', $games[1]->fresh()->result);
    }
}
