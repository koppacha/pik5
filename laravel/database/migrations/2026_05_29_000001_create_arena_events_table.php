<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('arena_events', static function (Blueprint $table) {
            $table->id();
            $table->integer('event_id')->unique()->comment('イベント日 yyyymmdd');
            $table->string('title')->default('ピクチャレアリーナ対戦');
            $table->integer('match_limit')->default(20);
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('arena_events');
    }
};
