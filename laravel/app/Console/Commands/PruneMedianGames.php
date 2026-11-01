<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PruneMedianGames extends Command
{
    protected $signature = 'median:prune';
    protected $description = 'Remove Median games 24 hours after explicit completion';

    public function handle(): int
    {
        if (!Schema::hasTable('median_games')) return self::SUCCESS;
        DB::transaction(function () {
            $room = DB::table('median_rooms')->where('id', 1)->lockForUpdate()->first();
            $expired = DB::table('median_games')->whereNotNull('expires_at')->where('expires_at', '<=', now())->pluck('id')->all();
            if (in_array($room->game_id, $expired, true)) DB::table('median_rooms')->where('id', 1)->update(['game_id' => null]);
            DB::table('median_games')->whereIn('id', $expired)->delete();
        });
        return self::SUCCESS;
    }
}
