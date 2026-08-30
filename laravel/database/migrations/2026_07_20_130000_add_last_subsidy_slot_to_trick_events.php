<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trick_events', static function (Blueprint $table) {
            $table->dateTime('last_subsidy_slot_at')->nullable()->after('debug_now');
        });
    }

    public function down(): void
    {
        Schema::table('trick_events', static function (Blueprint $table) {
            $table->dropColumn('last_subsidy_slot_at');
        });
    }
};
