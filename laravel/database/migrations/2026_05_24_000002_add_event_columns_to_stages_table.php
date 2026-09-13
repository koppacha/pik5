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
    public function up(): void
    {
        Schema::table('stages', static function (Blueprint $table) {
            $table->string('creator')->nullable()->after('border4');
            $table->string('taker')->nullable()->after('creator');
            $table->string('holder')->nullable()->after('taker');
            $table->integer('origin')->nullable()->after('holder');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::table('stages', static function (Blueprint $table) {
            $table->dropColumn(['creator', 'taker', 'holder', 'origin']);
        });
    }
};
