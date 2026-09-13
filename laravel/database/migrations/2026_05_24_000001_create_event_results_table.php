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
        Schema::create('event_results', static function (Blueprint $table) {
            $table->id();
            $table->integer('event_id')->nullable()->index();
            $table->string('event_title')->nullable();
            $table->string('sub_title')->nullable();
            $table->string('category')->nullable()->index();
            $table->string('user_id')->nullable()->index();
            $table->integer('team')->nullable();
            $table->bigInteger('score')->nullable();
            $table->integer('rps')->nullable();
            $table->integer('rps_adjust')->nullable();
            $table->string('result', 1)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('event_results');
    }
};
