<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swiss_rounds', static function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained('swiss_tournaments')->cascadeOnDelete();
            $table->unsignedInteger('round_no');
            $table->string('phase', 20)->default('swiss');
            $table->string('status', 20)->default('active');
            $table->timestamps();
            $table->unique(['tournament_id', 'round_no']);
        });
        Schema::create('swiss_matches', static function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained('swiss_tournaments')->cascadeOnDelete();
            $table->foreignId('round_id')->constrained('swiss_rounds')->cascadeOnDelete();
            $table->unsignedInteger('match_no');
            $table->string('player1_user_id');
            $table->string('player2_user_id')->nullable();
            $table->string('winner_user_id')->nullable();
            $table->unsignedTinyInteger('player1_wins')->default(0);
            $table->unsignedTinyInteger('player2_wins')->default(0);
            $table->boolean('is_bye')->default(false);
            $table->string('status', 20)->default('pending');
            $table->timestamps();
            $table->unique(['tournament_id', 'match_no']);
            $table->index(['round_id', 'status']);
        });
        Schema::create('swiss_games', static function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained('swiss_tournaments')->cascadeOnDelete();
            $table->foreignId('match_id')->constrained('swiss_matches')->cascadeOnDelete();
            $table->unsignedInteger('game_no');
            $table->unsignedInteger('match_game_no');
            $table->integer('stage_id');
            $table->string('winner_user_id')->nullable();
            $table->string('result', 20)->nullable();
            $table->timestamps();
            $table->unique(['tournament_id', 'game_no']);
            $table->unique(['match_id', 'match_game_no']);
            $table->index(['tournament_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swiss_games');
        Schema::dropIfExists('swiss_matches');
        Schema::dropIfExists('swiss_rounds');
    }
};
