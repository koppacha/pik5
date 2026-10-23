<?php

namespace Tests\Feature;

use Database\Seeders\RestoreRecordCsvSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RestoreRecordCsvSeederTest extends TestCase
{
    use RefreshDatabase;

    private function csv(array $rows): string
    {
        $file = tempnam(sys_get_temp_dir(), 'synthetic-record-restore-');
        $handle = fopen($file, 'w');
        fputcsv($handle, array_keys($rows[0]));
        foreach ($rows as $row) fputcsv($handle, array_values($row));
        fclose($handle);
        return $file;
    }

    private function row(int $id, int $publicId): array
    {
        return ['post_id' => $id, 'user_id' => 'synthetic-restore-user', 'score' => 100, 'stage_id' => 101,
            'rule' => 10, 'console' => 3, 'region' => '1', 'unique_id' => $publicId,
            'post_comment' => 'Synthetic public comment', 'img_url' => '', 'video_url' => '',
            'flg' => '0', 'team' => 0, 'created_at' => '2014/01/01 1:02:03', 'updated_at' => '2014/01/02 12:03:04',
            'user_ip' => '192.0.2.1', 'user_host' => 'synthetic.invalid', 'user_agent' => 'synthetic-agent', 'post_memo' => 'Synthetic private memo'];
    }

    public function test_restoration_preserves_existing_rows_dates_flags_and_duplicate_public_id_history(): void
    {
        $file = $this->csv([$this->row(1, 800000001), $this->row(2, 800000002), array_replace($this->row(3, 800000002), ['score' => 200, 'flg' => '2'])]);
        try {
            app(RestoreRecordCsvSeeder::class)->run($file);
            self::assertSame(3, DB::table('records')->count());
            $first = DB::table('records')->where('unique_id', 800000001)->first();
            self::assertSame('2014-01-01 01:02:03', $first->created_at);
            self::assertSame(3, $first->difficulty);
            self::assertSame('', $first->user_ip);
            self::assertSame('', $first->post_memo);
            self::assertSame(2, DB::table('records')->where('unique_id', 800000002)->count());
            DB::table('records')->where('post_id', $first->post_id)->update(['score' => 777, 'flg' => '2', 'difficulty' => null]);
            app(RestoreRecordCsvSeeder::class)->run($file);
            self::assertSame(3, DB::table('records')->count());
            self::assertSame(777, DB::table('records')->where('post_id', $first->post_id)->value('score'));
            self::assertSame(3, DB::table('records')->where('post_id', $first->post_id)->value('difficulty'));
            self::assertSame('2014-01-02 12:03:04', DB::table('records')->where('post_id', $first->post_id)->value('updated_at'));
            self::assertSame('2', DB::table('records')->where('post_id', $first->post_id)->value('flg'));
        } finally {
            unlink($file);
        }
    }

    public function test_source_primary_key_collision_does_not_overwrite_local_records(): void
    {
        $local = $this->row(1, 820000001);
        $local['difficulty'] = 2;
        $local['created_at'] = '2026-01-01 00:00:00';
        $local['updated_at'] = '2026-01-01 00:00:00';
        DB::table('records')->insert($local);
        $file = $this->csv([$this->row(1, 820000002)]);
        try {
            app(RestoreRecordCsvSeeder::class)->run($file);
            self::assertSame(2, DB::table('records')->count());
            self::assertSame(820000001, DB::table('records')->where('post_id', 1)->value('unique_id'));
            self::assertNotSame(1, DB::table('records')->where('unique_id', 820000002)->value('post_id'));
        } finally {
            unlink($file);
        }
    }

    public function test_invalid_timestamp_rolls_back_all_imported_rows(): void
    {
        $rows = array_map(fn ($i) => $this->row($i, 810000000 + $i), range(1, 500));
        $rows[] = array_replace($this->row(501, 810000501), ['created_at' => '2014/99/99 1:02:03']);
        $file = $this->csv($rows);
        try {
            try {
                app(RestoreRecordCsvSeeder::class)->run($file);
                self::fail('Expected timestamp validation failure');
            } catch (\RuntimeException $error) {
                self::assertSame('Invalid timestamp at record CSV row 502.', $error->getMessage());
                self::assertSame(0, DB::table('records')->count());
            }
        } finally {
            unlink($file);
        }
    }
}
