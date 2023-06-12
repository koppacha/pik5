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
        Schema::create('keywords', static function (Blueprint $table) {
            $table->id();
            $table->string('unique_id');
            $table->integer('flag');
            $table->string('category');
            $table->string('keyword');
            $table->string('tag');
            $table->string('yomi');
            $table->text('content');
            $table->string('first_editor');
            $table->string('last_editor');
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
        Schema::dropIfExists('keywords');
    }
};
