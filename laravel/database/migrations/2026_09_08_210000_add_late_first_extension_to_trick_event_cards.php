<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trick_event_cards', function (Blueprint $table) {
            $table->boolean('late_first_extension')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('trick_event_cards', function (Blueprint $table) {
            $table->dropColumn('late_first_extension');
        });
    }
};
