<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trick_event_cards', static function (Blueprint $table) {
            $table->unsignedInteger('returned_count')->default(0)->after('drawn_order');
        });
    }

    public function down(): void
    {
        Schema::table('trick_event_cards', static function (Blueprint $table) {
            $table->dropColumn('returned_count');
        });
    }
};
