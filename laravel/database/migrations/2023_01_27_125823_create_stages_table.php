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
        Schema::create('stages', static function (Blueprint $table) {
            $table->id('stage_id');
            $table->string('stage_name');
            $table->string('eng_stage_name');
            $table->string('stage_sub');
            $table->string('type');
            $table->string('display');
            $table->bigInteger('series');
            $table->bigInteger('parent');
            $table->bigInteger('time');
            $table->bigInteger('treasure');
            $table->bigInteger('pikmin');
            $table->bigInteger('border1');
            $table->bigInteger('border2');
            $table->bigInteger('border3');
            $table->bigInteger('border4');
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
        Schema::dropIfExists('stages');
    }
};
