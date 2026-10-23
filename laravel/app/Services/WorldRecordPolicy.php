<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class WorldRecordPolicy
{
    public static function platforms(int $stage, int $rule): array
    {
        if ($rule === 48 || ($stage >= 331 && $stage <= 344)) return [4];
        if (($stage >= 301 && $stage <= 330) || ($stage >= 345 && $stage <= 350)) return [3, 4];
        return [];
    }

    public static function canReport(string $user): bool
    {
        return DB::table('world_record_reports')->where('reporter_user_id', $user)
            ->whereNotNull('deleted_at')->whereNotNull('deleted_by')->count() < 3;
    }

    public static function lockReporter(string $user): void
    {
        DB::table('world_record_reporter_locks')->insertOrIgnore(['user_id' => $user]);
        DB::table('world_record_reporter_locks')->where('user_id', $user)->lockForUpdate()->first();
    }
}
