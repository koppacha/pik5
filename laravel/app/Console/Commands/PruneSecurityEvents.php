<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PruneSecurityEvents extends Command
{
    protected $signature = 'security:prune';
    protected $description = 'Remove expired authentication audit and limit records';

    public function handle(): int
    {
        if (Schema::hasTable('login_events')) {
            DB::table('login_events')->where('created_at', '<', now()->subDays(90))->delete();
            DB::table('login_events')->where('outcome', '!=', 'success')->where('created_at', '<', now()->subDays(30))->delete();
            DB::table('security_rate_limits')->where('expires_at', '<', now())->delete();
        }
        return self::SUCCESS;
    }
}
