<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('players', static function (Blueprint $table) {
            $table->dateTime('take_cooldown_released_for')->nullable()->after('last_take_at');
        });
    }

    public function down(): void
    {
        Schema::table('players', static function (Blueprint $table) {
            $table->dropColumn('take_cooldown_released_for');
        });
    }
};
