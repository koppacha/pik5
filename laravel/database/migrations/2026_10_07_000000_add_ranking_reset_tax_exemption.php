<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('players', function (Blueprint $table): void {
            $table->boolean('ranking_reset_tax_exempt')->default(false);
        });
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE records MODIFY post_memo TEXT NOT NULL');
        }
    }

    public function down(): void
    {
        Schema::table('players', function (Blueprint $table): void {
            $table->dropColumn('ranking_reset_tax_exempt');
        });
        // Retain memo capacity so rollback cannot truncate existing audit notes.
    }
};
