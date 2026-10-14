<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trick_events', static function (Blueprint $table) {
            $table->unsignedInteger('pot_points')->default(0)->after('last_subsidy_slot_at');
        });
    }

    public function down(): void
    {
        Schema::table('trick_events', static function (Blueprint $table) {
            $table->dropColumn('pot_points');
        });
    }
};
