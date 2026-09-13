<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('records')
            ->where('rule', 180901)
            ->where('team', 0)
            ->update(['team' => 999]);
    }

    public function down(): void
    {
        DB::table('records')
            ->where('rule', 180901)
            ->where('team', 999)
            ->update(['team' => 0]);
    }
};
