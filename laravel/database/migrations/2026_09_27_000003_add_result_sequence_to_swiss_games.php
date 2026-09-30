<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swiss_games', static function (Blueprint $table) {
            $table->unsignedBigInteger('result_sequence')->nullable();
            $table->unique(['tournament_id', 'result_sequence']);
        });
    }

    public function down(): void
    {
        Schema::table('swiss_games', static function (Blueprint $table) {
            $table->dropUnique(['tournament_id', 'result_sequence']);
            $table->dropColumn('result_sequence');
        });
    }
};
