<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swiss_players', static function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained('swiss_tournaments')->cascadeOnDelete();
            $table->string('user_id');
            $table->integer('provisional_rank')->nullable();
            $table->unsignedInteger('wins')->default(0);
            $table->unsignedInteger('losses')->default(0);
            $table->unsignedInteger('bye_count')->default(0);
            $table->unsignedInteger('registration_order');
            $table->timestamps();
            $table->unique(['tournament_id', 'user_id']);
            $table->index(['tournament_id', 'wins', 'losses']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swiss_players');
    }
};
