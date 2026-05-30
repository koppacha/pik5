<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arena_results', static function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('event_id')->index();
            $table->unsignedBigInteger('match_id')->index();
            $table->integer('match_no')->index();
            $table->integer('stage_id')->nullable();
            $table->string('user_id')->index();
            $table->integer('position');
            $table->string('score')->nullable();
            $table->integer('point');
            $table->integer('point_result');
            $table->integer('payment')->default(0);
            $table->integer('gain')->default(0);
            $table->integer('result')->default(0);
            $table->integer('flg')->default(0)->index();
            $table->timestamps();

            $table->index(['event_id', 'user_id', 'match_no']);
            $table->index(['event_id', 'match_no']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arena_results');
    }
};
