<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stage_treasures', static function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('legacy_object_id')->unique();
            $table->unsignedBigInteger('stage_id');
            $table->unsignedSmallInteger('floor');
            $table->string('object_name');
            $table->unsignedSmallInteger('quantity');
            $table->unsignedInteger('value');
            $table->index(['stage_id', 'floor']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stage_treasures');
    }
};
