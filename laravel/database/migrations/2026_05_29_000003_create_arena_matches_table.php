<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arena_matches', static function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('event_id')->index();
            $table->integer('match_no');
            $table->integer('stage_id')->nullable();
            $table->string('holder_user_id')->index();
            $table->string('challenger_user_id')->index();
            $table->json('receiver_user_ids')->nullable();
            $table->integer('result')->default(0);
            $table->integer('holder_streak_before')->default(0);
            $table->timestamps();

            $table->unique(['event_id', 'match_no']);
            $table->index(['event_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arena_matches');
    }
};
