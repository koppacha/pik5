<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('swiss_players', function (Blueprint $table) {
            $table->string('display_name')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('swiss_players', function (Blueprint $table) {
            $table->dropColumn('display_name');
        });
    }
};
