<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('decks', function (Blueprint $table) {
            $table->enum('score_type', ['points', 'time'])->default('points');
        });
    }

    public function down(): void
    {
        Schema::table('decks', fn (Blueprint $table) => $table->dropColumn('score_type'));
    }
};
