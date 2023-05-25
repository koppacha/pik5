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
        Schema::create('records', static function (Blueprint $table) {
            $table->id('post_id');
            $table->string('user_id');
            $table->bigInteger('score');
            $table->bigInteger('stage_id');
            $table->bigInteger('rule');
            $table->smallInteger('console');
            $table->bigInteger('unique_id');
            $table->bigInteger('post_rank');
            $table->bigInteger('rps');
            $table->string('hash');
            $table->string('post_comment');
            $table->string('user_ip');
            $table->string('user_host');
            $table->string('user_agent');
            $table->string('img_url');
            $table->string('video_url', 512);
            $table->string('post_memo', 1024);
            $table->string('flg');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('records');
    }
};
