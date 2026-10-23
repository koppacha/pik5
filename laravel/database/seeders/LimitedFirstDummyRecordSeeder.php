<?php

namespace Database\Seeders;

use App\Services\LimitedEventResultService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class LimitedFirstDummyRecordSeeder extends Seeder
{
    public function run(LimitedEventResultService $service): void
    {
        DB::transaction(static function () use ($service) {
            if (!DB::table('stages')->where('stage_id', 1001)->where('parent', 151101)->exists()) {
                throw new RuntimeException('The first limited event stage is missing.');
            }

            $record = [
                'user_id' => 'koppacha', 'stage_id' => 1001, 'rule' => 151101,
                'score' => 4700, 'console' => 0, 'region' => '0', 'team' => 0,
                'unique_id' => 151101001,
                'post_comment' => '第1回表示確認用ダミーデータ',
                'user_ip' => '', 'user_host' => '', 'user_agent' => '',
                'img_url' => '', 'video_url' => '', 'post_memo' => '', 'flg' => '0',
                'created_at' => '2015-11-04 12:00:00', 'updated_at' => '2015-11-04 12:00:00',
            ];
            $existing = DB::table('records')->where('unique_id', $record['unique_id'])->lockForUpdate()->get();
            if ($existing->isEmpty()) {
                if (DB::table('records')->where('rule', 151101)->exists()
                    || DB::table('event_results')->where('event_id', 151101)->exists()) {
                    throw new RuntimeException('Existing first-event data must be reviewed before adding dummy data.');
                }
                DB::table('records')->insert($record);
                // Recalculate this event only; later tournaments and holders stay intact.
                $service->recalculateEvent(151101);
            } elseif ($existing->count() !== 1 || collect($record)->contains(
                static fn ($value, $key) => (string) $existing->first()->{$key} !== (string) $value
            )) {
                throw new RuntimeException('Dummy record identifier conflicts with existing data.');
            }
        });

        Cache::forget('event-stamp-total:koppacha');
    }
}
