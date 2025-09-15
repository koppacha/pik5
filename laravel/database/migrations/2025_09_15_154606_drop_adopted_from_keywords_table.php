<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up(): void {
        if (Schema::hasColumn('keywords', 'adopted')) {
            Schema::table('keywords', function (Blueprint $table) {
                $table->dropColumn('adopted');
            });
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void {
        // もし戻す必要があれば型を明示（例）
        if (!Schema::hasColumn('keywords', 'adopted')) {
            Schema::table('keywords', function (Blueprint $table) {
                $table->unsignedTinyInteger('adopted')->default(0);
            });
        }
    }
};
