<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stage_treasures', static function (Blueprint $table) {
            $table->unsignedInteger('value_na')->nullable();
            $table->unsignedInteger('value_eu')->nullable();
            $table->unsignedSmallInteger('weight_jp')->nullable();
            $table->unsignedSmallInteger('weight_na')->nullable();
            $table->unsignedSmallInteger('weight_eu')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('stage_treasures', static function (Blueprint $table) {
            $table->dropColumn(['value_na', 'value_eu', 'weight_jp', 'weight_na', 'weight_eu']);
        });
    }
};
