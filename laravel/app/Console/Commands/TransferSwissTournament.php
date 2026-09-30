<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class TransferSwissTournament extends Command
{
    protected $signature = 'swiss:transfer {mode : export or import} {file} {--id= : Source tournament ID for export}';
    protected $description = 'Export or import one Swiss tournament with its related records';

    public function handle(): int
    {
        $mode = $this->argument('mode');
        if ($mode === 'export') return $this->exportTournament();
        if ($mode === 'import') return $this->importTournament();
        $this->error('Mode must be export or import.');
        return self::FAILURE;
    }

    private function exportTournament(): int
    {
        $id = filter_var($this->option('id'), FILTER_VALIDATE_INT);
        if (!$id || $id < 1) {
            $this->error('A positive --id is required.');
            return self::FAILURE;
        }
        $file = $this->argument('file');
        if (file_exists($file)) {
            $this->error('The export file already exists.');
            return self::FAILURE;
        }
        $data = DB::transaction(static function () use ($id) {
            $tournament = DB::table('swiss_tournaments')->where('id', $id)->first();
            if (!$tournament) return null;
            $data = ['version' => 1, 'tournament' => (array) $tournament];
            foreach (['swiss_players', 'swiss_rounds', 'swiss_matches', 'swiss_games'] as $table) {
                $data[$table] = DB::table($table)->where('tournament_id', $id)
                    ->orderBy('id')->get()->map(static fn ($row) => (array) $row)->all();
            }
            return $data;
        });
        if (!$data) {
            $this->error('Tournament not found.');
            return self::FAILURE;
        }
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
        if (file_put_contents($file, $json, LOCK_EX) === false) {
            $this->error('Could not write the export file.');
            return self::FAILURE;
        }
        chmod($file, 0600);
        $this->info('Exported one tournament and related records.');
        return self::SUCCESS;
    }

    private function importTournament(): int
    {
        $file = $this->argument('file');
        if (!is_file($file)) {
            $this->error('Import file not found.');
            return self::FAILURE;
        }
        try {
            $data = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
            $tables = ['swiss_players', 'swiss_rounds', 'swiss_matches', 'swiss_games'];
            if (($data['version'] ?? null) !== 1 || !is_array($data['tournament'] ?? null)
                || !isset($data['tournament']['id'], $data['tournament']['title'], $data['tournament']['created_at'])
                || collect($tables)->contains(static fn ($table) => !is_array($data[$table] ?? null))) {
                throw new \RuntimeException('Invalid export format');
            }
            $sourceId = (int) $data['tournament']['id'];
            foreach ($tables as $table) {
                foreach ($data[$table] as $row) {
                    if (!is_array($row) || (int) ($row['tournament_id'] ?? 0) !== $sourceId || !isset($row['id'])) {
                        throw new \RuntimeException('Invalid related record');
                    }
                }
            }

            DB::transaction(static function () use ($data) {
                $tournament = $data['tournament'];
                if (DB::table('swiss_tournaments')->where('title', $tournament['title'])
                    ->where('created_at', $tournament['created_at'])->exists()) {
                    throw new \RuntimeException('Tournament was already imported');
                }
                unset($tournament['id']);
                $newTournamentId = DB::table('swiss_tournaments')->insertGetId($tournament);
                foreach ($data['swiss_players'] as $player) {
                    unset($player['id']);
                    $player['tournament_id'] = $newTournamentId;
                    DB::table('swiss_players')->insert($player);
                }
                $roundIds = [];
                foreach ($data['swiss_rounds'] as $round) {
                    $oldId = $round['id'];
                    unset($round['id']);
                    $round['tournament_id'] = $newTournamentId;
                    $roundIds[$oldId] = DB::table('swiss_rounds')->insertGetId($round);
                }
                $matchIds = [];
                foreach ($data['swiss_matches'] as $match) {
                    $oldId = $match['id'];
                    unset($match['id']);
                    $match['tournament_id'] = $newTournamentId;
                    $match['round_id'] = $roundIds[$match['round_id']];
                    $matchIds[$oldId] = DB::table('swiss_matches')->insertGetId($match);
                }
                foreach ($data['swiss_games'] as $game) {
                    unset($game['id']);
                    $game['tournament_id'] = $newTournamentId;
                    $game['match_id'] = $matchIds[$game['match_id']];
                    DB::table('swiss_games')->insert($game);
                }
            });
        } catch (\Throwable $error) {
            $this->error('Import failed; no records were committed.');
            return self::FAILURE;
        }
        $this->info('Imported one tournament and related records.');
        return self::SUCCESS;
    }
}
