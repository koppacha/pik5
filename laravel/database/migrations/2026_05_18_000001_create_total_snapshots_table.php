<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('total_snapshots', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
            $table->unsignedSmallInteger('target_year');
            $table->unsignedTinyInteger('target_month');
            $table->dateTime('snapshot_at');
            $table->string('user');
            $table->integer('rule');
            $table->integer('score')->default(0);
            $table->integer('rps')->default(0);
            $table->integer('mark')->default(0);
            $table->integer('rank')->nullable();
            $table->integer('flg')->default(0);

            $table->unique(['target_year', 'target_month', 'user', 'rule'], 'total_snapshots_month_user_rule_unique');
            $table->index(['user', 'rule', 'target_year', 'target_month'], 'total_snapshots_user_rule_month_index');
            $table->index(['rule', 'target_year', 'target_month', 'rps'], 'total_snapshots_rank_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('total_snapshots');
    }
};
