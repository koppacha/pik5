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
        Schema::create('decks', static function (Blueprint $table) {
            $table->id();

            // 大会ID（6桁の数値）
            $table->unsignedInteger('eventId');

            // ステージID
            $table->unsignedInteger('stageId');

            // ステージ名
            $table->string('title');

            // 縛りルール名
            $table->string('ruleName');

            // 現在の場所（山札、手札、場札、捨て札など）
            $table->string('state')->default('_deck');

            // ミニゲームのルール本文
            $table->text('text');

            // 難易度（1〜5）
            $table->tinyInteger('difficulty')->unsigned()->default(1);

            // レア度（1: Common, 2: Uncommon, 3: Rare, 4: Epic, 5: Legendary）
            $table->tinyInteger('rarity')->unsigned()->default(1);

            // リワード値（使用ドローポイント）
            $table->unsignedInteger('rewards');

            // クリエイター（考案者ユーザー名）
            $table->string('creator')->nullable();

            // テイカー（場に出したユーザー名）
            $table->string('taker')->nullable();

            // トップ投稿者（ミニゲームでトップスコアを出したユーザー名）
            $table->string('topPlayer')->nullable();

            // 参加者数
            $table->unsignedInteger('count')->default(0);

            // リミットオーバー日時
            $table->dateTime('limit')->nullable();

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
        Schema::dropIfExists('decks');
    }
};
