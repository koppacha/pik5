<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class SwissFirstTournamentSeeder extends Seeder
{
    public function run(): void
    {
        $file = __DIR__ . '/data/swiss_first_tournament.json';
        $data = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
        $source = $data['tournament'];
        $existingId = DB::table('swiss_tournaments')
            ->where('title', $source['title'])
            ->where('created_at', $source['created_at'])
            ->value('id');

        if ($existingId !== null) {
            foreach (['swiss_players', 'swiss_rounds', 'swiss_matches', 'swiss_games'] as $table) {
                $actual = DB::table($table)->where('tournament_id', $existingId)->count();
                if ($actual !== count($data[$table])) {
                    throw new \RuntimeException('Existing first tournament does not match the seed data.');
                }
            }
            return;
        }

        if (Artisan::call('swiss:transfer', ['mode' => 'import', 'file' => $file]) !== 0) {
            throw new \RuntimeException('Could not import the first tournament seed data.');
        }
    }
}
