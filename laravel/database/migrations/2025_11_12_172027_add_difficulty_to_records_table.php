<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up(): void
    {
        Schema::table('records', static function (Blueprint $table) {
            // 数値型（0〜9を想定）だが、NULL許可
            $table->unsignedTinyInteger('difficulty')->nullable()->after('console');
        });

        // 既存レコードを条件に応じて更新
        DB::table('records')
            ->where('console', 3)
            ->update(['difficulty' => 3]);

        DB::table('records')
            ->where('console', '<>', 3)
            ->update(['difficulty' => 2]);
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::table('records', static function (Blueprint $table) {
            $table->dropColumn('difficulty');
        });
    }
};
