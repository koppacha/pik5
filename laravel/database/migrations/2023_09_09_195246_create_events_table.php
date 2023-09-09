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
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->integer("stage");
            $table->string("host");
            $table->string("support");
            $table->string("name");
            $table->string("eng");
            $table->string("type");
            $table->string("rule");
            $table->integer("first");
            $table->integer("count");
            $table->dateTime("start");
            $table->dateTime("end");
            $table->integer("team1");
            $table->integer("team2");
            $table->integer("team3");
            $table->integer("team4");
            $table->string("winner");
            $table->string("mvp");
            $table->string("idea");
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
        Schema::dropIfExists('events');
    }
};
