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
    public function up()
    {
        Schema::create('limit_logs', function (Blueprint $table) {
            $table->bigIncrements('id');

            // --- イベント共通メタ ---
            // 例: draw / take / limit_over / limit_over_update / update_stage_on_record
            $table->string('event', 64)->index();

            // 実行者（あなたの環境では Player.name が実質ID）
            $table->string('actor_name')->nullable()->index();

            // 対象カード/ステージ
            $table->unsignedBigInteger('card_id')->nullable()->index();
            $table->unsignedBigInteger('stage_id')->nullable()->index();

            // --- 状態遷移や計数 ---
            $table->string('from_state', 32)->nullable();
            $table->string('to_state', 32)->nullable();

            // draw: 残りドローポイント、残り山札数（未配布）
            $table->integer('remaining_draw_points')->nullable();
            $table->integer('remaining_deck_count')->nullable();

            // take: テイク時点の手札枚数（= rewards と同義）
            $table->integer('hand_count')->nullable();
            $table->integer('rewards')->nullable();

            // limit の前後（take / updateStageOnRecord で使用）
            $table->timestamp('previous_limit')->nullable();
            $table->timestamp('new_limit')->nullable();

            // limitOver: 各プレイヤーへの加点（1プレイヤー1行）
            $table->string('affected_player_name')->nullable()->index();
            $table->string('affected_player_id')->nullable()->index();
            $table->integer('rank_points_delta')->nullable();
            $table->integer('draw_points_delta')->nullable();

            // updateStageOnRecord: トップ情報・記録総数
            $table->string('top_user_id')->nullable()->index();
            $table->string('top_user_name')->nullable()->index();
            $table->integer('top_score')->nullable();
            $table->integer('records_count')->nullable();

            // take: スタックへ動かしたカードIDの配列
            $table->json('stacked_card_ids')->nullable();

            // スナップショット（当時の状態を残す）
            $table->json('card_snapshot')->nullable();
            $table->json('player_snapshot')->nullable();

            // 付帯情報（監査・デバッグ）
            $table->string('route', 128)->nullable()->index();
            $table->string('ip', 64)->nullable();
            $table->text('user_agent')->nullable();
            $table->uuid('request_id')->nullable()->index();

            // 拡張用
            $table->json('context')->nullable();

            $table->timestamps();

            // 必要に応じて外部キーを追加（運用が固まってから）
            // $table->foreign('card_id')->references('id')->on('deck')->nullOnDelete();
            // $table->foreign('stage_id')->references('id')->on('stages')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('limit_logs');
    }
};
