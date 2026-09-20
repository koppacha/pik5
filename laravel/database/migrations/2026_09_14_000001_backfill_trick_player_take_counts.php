<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('limit_logs')
            ->select('event_id', 'actor_name', DB::raw('COUNT(*) AS successful_takes'))
            ->where('event', 'take')
            ->whereNotNull('event_id')
            ->whereNotNull('actor_name')
            ->groupBy('event_id', 'actor_name')
            ->orderBy('event_id')
            ->orderBy('actor_name')
            ->each(static function ($row): void {
                DB::table('players')
                    ->where('event_id', $row->event_id)
                    ->where('name', $row->actor_name)
                    ->update(['take_count' => (int) $row->successful_takes]);
            });
    }

    public function down(): void
    {
        // The original take logs remain authoritative; no destructive rollback is required.
    }
};
