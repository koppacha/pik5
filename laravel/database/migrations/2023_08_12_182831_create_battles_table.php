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
            $table->string('unique_id');
            $table->string('stage_id');
            $table->integer('flag');
            $table->integer('rule');
            $table->integer('winner');
            $table->string('1p_user_id');
            $table->integer('1p_conf');
            $table->integer('1p_score');
            $table->integer('1p_rate');
            $table->string('2p_user_id');
            $table->integer('2p_conf');
            $table->integer('2p_score');
            $table->integer('2p_rate');
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
