<?php

namespace Database\Seeders;

use App\Services\YearRecords;
use Carbon\CarbonImmutable;
use DateTimeImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/** Restore missing public records without replacing existing records or identities. */
class RestoreRecordCsvSeeder extends Seeder
{
    public function run(?string $path = null): void
    {
        if (app()->environment('production')) throw new RuntimeException('This restoration seeder is for local development only.');
        $path ??= __DIR__.'/data/records.csv';
        $file = fopen($path, 'r');
        if (! $file) throw new RuntimeException('Record CSV could not be opened.');
        $inserted = 0;
        $skipped = 0;
        $repaired = 0;
        try {
            $headers = fgetcsv($file);
            $required = ['user_id', 'score', 'stage_id', 'rule', 'console', 'unique_id', 'flg', 'created_at', 'updated_at'];
            if (! is_array($headers) || array_diff($required, $headers)) throw new RuntimeException('Record CSV headers are invalid.');
            DB::transaction(function () use ($file, $headers, &$inserted, &$skipped, &$repaired) {
                // Keep this set fixed: several historical rows can share one public ID.
                $existing = array_fill_keys(DB::table('records')->pluck('unique_id')->map(fn ($id) => (string) $id)->all(), true);
                $batch = [];
                $missingDifficulty = [];
                $line = 1;
                while (($fields = fgetcsv($file)) !== false) {
                    $line++;
                    if ($fields === [null]) continue;
                    if (count($headers) !== count($fields)) throw new RuntimeException('Invalid record CSV row '.$line.'.');
                    $source = array_combine($headers, $fields);
                    foreach (['score', 'stage_id', 'rule', 'console', 'unique_id', 'flg'] as $column) {
                        if (! preg_match('/\A-?[0-9]+\z/', $source[$column])) throw new RuntimeException('Invalid numeric field at record CSV row '.$line.'.');
                    }
                    if (isset($existing[$source['unique_id']])) {
                        $missingDifficulty[$source['unique_id']] = true;
                        $skipped++;
                        continue;
                    }
                    // Do not import access metadata, private memo fields, or unknown CSV columns.
                    // The database allocates post_id to avoid collisions with local event links.
                    $row = array_intersect_key($source, array_flip(['user_id', 'score', 'stage_id', 'rule', 'console', 'region', 'unique_id', 'post_comment', 'img_url', 'video_url', 'flg', 'team']));
                    $row += ['region' => '', 'post_comment' => '', 'img_url' => '', 'video_url' => '', 'team' => 0];
                    $row['difficulty'] = isset($source['difficulty']) ? (int) $source['difficulty'] : ((int) $source['console'] === 3 ? 3 : 2);
                    $row += ['user_ip' => '', 'user_host' => '', 'user_agent' => '', 'post_memo' => ''];
                    $row['created_at'] = $this->timestamp($source['created_at'], $line);
                    $row['updated_at'] = $this->timestamp($source['updated_at'], $line);
                    $batch[] = $row;
                    $inserted++;
                    if (count($batch) >= 500) { DB::table('records')->insert($batch); $batch = []; }
                }
                if ($batch) DB::table('records')->insert($batch);
                foreach (array_chunk(array_keys($missingDifficulty), 500) as $ids) {
                    $repaired += DB::table('records')->whereIn('unique_id', $ids)->whereNull('difficulty')
                        ->update(['difficulty' => DB::raw('CASE WHEN console = 3 THEN 3 ELSE 2 END')]);
                }
            });
        } catch (\Illuminate\Database\QueryException) {
            // Never include a failed SQL statement or imported values in console output.
            throw new RuntimeException('Record restoration failed; the transaction was rolled back.');
        } finally {
            fclose($file);
        }
        foreach (range(2014, CarbonImmutable::now('Asia/Tokyo')->year) as $year) app(YearRecords::class)->forget($year);
        $this->command?->info('Restored records: '.$inserted.'; preserved existing records: '.$skipped.'; filled missing difficulty: '.$repaired.'.');
    }

    private function timestamp(string $value, int $line): string
    {
        $format = str_contains($value, '/') ? '!Y/m/d G:i:s' : '!Y-m-d H:i:s';
        $date = DateTimeImmutable::createFromFormat($format, $value);
        $errors = DateTimeImmutable::getLastErrors();
        if (! $date || ($errors && ($errors['warning_count'] || $errors['error_count']))) throw new RuntimeException('Invalid timestamp at record CSV row '.$line.'.');
        return $date->format('Y-m-d H:i:s');
    }
}
