<?php

namespace Tests\Feature;

use App\Models\SwissGame;
use App\Models\SwissMatch;
use App\Models\SwissPlayer;
use App\Models\SwissRound;
use App\Models\SwissTournament;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class SwissTransferTest extends TestCase
{
    private function createTables(): void
    {
        foreach (glob(database_path('migrations/2026_09_22_*.php')) as $file) {
            (require $file)->up();
        }
        (require database_path('migrations/2026_09_26_000001_add_display_name_to_swiss_players.php'))->up();
        (require database_path('migrations/2026_09_27_000003_add_result_sequence_to_swiss_games.php'))->up();
    }

    public function test_export_and_import_preserve_records_and_remap_ids(): void
    {
        $this->createTables();

        $tournament = SwissTournament::create(['title' => 'Synthetic first tournament', 'stage_pool' => range(351, 362)]);
        $player = SwissPlayer::create([
            'tournament_id' => $tournament->id, 'user_id' => 'synthetic_player',
            'display_name' => 'Test Player', 'registration_order' => 1,
        ]);
        $round = SwissRound::create(['tournament_id' => $tournament->id, 'round_no' => 1]);
        $match = SwissMatch::create([
            'tournament_id' => $tournament->id, 'round_id' => $round->id, 'match_no' => 1,
            'player1_user_id' => $player->user_id, 'player2_user_id' => 'synthetic_opponent',
        ]);
        SwissGame::create([
            'tournament_id' => $tournament->id, 'match_id' => $match->id,
            'game_no' => 1, 'match_game_no' => 1, 'stage_id' => 351,
            'result' => 'player1', 'winner_user_id' => $player->user_id, 'result_sequence' => 1,
        ]);

        $file = tempnam(sys_get_temp_dir(), 'swiss-transfer-');
        unlink($file);
        try {
            $this->assertSame(0, Artisan::call('swiss:transfer', ['mode' => 'export', 'file' => $file, '--id' => $tournament->id]));
            $this->assertSame(1, Artisan::call('swiss:transfer', ['mode' => 'import', 'file' => $file]));
            $tournament->update(['title' => 'Renamed synthetic source']);
            $this->assertSame(0, Artisan::call('swiss:transfer', ['mode' => 'import', 'file' => $file]));

            $imported = SwissTournament::where('title', 'Synthetic first tournament')->firstOrFail();
            $this->assertNotSame($tournament->id, $imported->id);
            $this->assertSame($player->user_id, SwissPlayer::where('tournament_id', $imported->id)->value('user_id'));
            $this->assertSame('Test Player', SwissPlayer::where('tournament_id', $imported->id)->value('display_name'));
            $importedRound = SwissRound::where('tournament_id', $imported->id)->firstOrFail();
            $importedMatch = SwissMatch::where('tournament_id', $imported->id)->firstOrFail();
            $importedGame = SwissGame::where('tournament_id', $imported->id)->firstOrFail();
            $this->assertSame($importedRound->id, $importedMatch->round_id);
            $this->assertSame($importedMatch->id, $importedGame->match_id);
            $this->assertSame(1, $importedGame->result_sequence);
            $this->assertSame('player1', $importedGame->result);
        } finally {
            if (is_file($file)) unlink($file);
        }
    }

    public function test_first_tournament_seeder_is_repeatable_and_preserves_all_related_rows(): void
    {
        $this->createTables();
        $file = database_path('seeders/data/swiss_first_tournament.json');
        $source = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);

        foreach ([1, 2] as $run) {
            $this->assertSame(0, Artisan::call('db:seed', ['--class' => 'SwissFirstTournamentSeeder', '--force' => true]));
            $this->assertSame(1, SwissTournament::count());
            $tournament = SwissTournament::firstOrFail();
            foreach (['title', 'status', 'standard_rounds', 'created_at', 'updated_at'] as $field) {
                $this->assertSame((string) $source['tournament'][$field], (string) $tournament->{$field});
            }
            foreach (['swiss_players' => SwissPlayer::class, 'swiss_rounds' => SwissRound::class,
                'swiss_matches' => SwissMatch::class, 'swiss_games' => SwissGame::class] as $table => $model) {
                $this->assertSame(count($source[$table]), $model::where('tournament_id', $tournament->id)->count());
            }
            $this->assertSame(
                collect($source['swiss_players'])->pluck('user_id')->sort()->values()->all(),
                SwissPlayer::where('tournament_id', $tournament->id)->pluck('user_id')->sort()->values()->all()
            );
        }
    }
}
