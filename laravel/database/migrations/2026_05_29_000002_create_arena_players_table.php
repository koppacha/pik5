<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arena_players', static function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('event_id')->index();
            $table->string('user_id')->index();
            $table->integer('position')->default(0);
            $table->integer('start_point')->default(1000);
            $table->integer('current_point')->default(1000);
            $table->boolean('active')->default(true)->index();
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->timestamps();

            $table->unique(['event_id', 'user_id']);
            $table->index(['event_id', 'active', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arena_players');
    }
};
