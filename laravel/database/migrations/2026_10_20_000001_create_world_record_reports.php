<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('world_record_reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('stage_id');
            $table->unsignedInteger('rule');
            $table->string('reporter_user_id', 191);
            $table->string('holder_name', 100);
            $table->unsignedInteger('score');
            $table->string('img_url')->default('');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['stage_id', 'rule', 'is_active', 'score']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('world_record_reports');
    }
};
