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
        Schema::create('battles', static function (Blueprint $table) {
            $table->id();
            $table->string('session_id');
            $table->integer('battle_id');
            $table->integer('player');
            $table->integer('rule');
            $table->float('point');
            $table->float('result_point');
            $table->integer('rank');
            $table->integer('stage_id');
            $table->integer('pikmin');
            $table->string('user_id');
            $table->integer('dandori_pts');
            $table->integer('com_dandori_pts');
            $table->integer('flg');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('battles');
    }
};
