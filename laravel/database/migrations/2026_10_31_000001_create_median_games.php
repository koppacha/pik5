<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('median_games', function (Blueprint $table) {
            $table->string('id', 14)->primary();
            $table->json('state');
            $table->timestamp('ended_at')->nullable()->index();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });
        Schema::create('median_rooms', function (Blueprint $table) {
            $table->unsignedInteger('id')->primary();
            $table->string('game_id', 14)->nullable();
        });
        DB::table('median_rooms')->insert(['id' => 1, 'game_id' => null]);
    }

    public function down(): void
    {
        Schema::dropIfExists('median_rooms');
        Schema::dropIfExists('median_games');
    }
};
