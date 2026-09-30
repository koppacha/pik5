<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swiss_tournaments', static function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('status', 20)->default('registration')->index();
            $table->unsignedTinyInteger('standard_rounds')->default(3);
            $table->json('stage_pool');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swiss_tournaments');
    }
};
