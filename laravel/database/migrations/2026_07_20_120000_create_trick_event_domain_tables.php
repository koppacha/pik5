<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trick_events', static function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('event_id')->unique();
            $table->string('title');
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->string('state', 32)->default('scheduled')->index();
            $table->boolean('debug')->default(false);
            $table->boolean('test_mode')->default(false);
            $table->dateTime('debug_now')->nullable();
            $table->unsignedBigInteger('random_seed')->nullable();
            $table->dateTime('initialized_at')->nullable();
            $table->dateTime('ended_at')->nullable();
            $table->timestamps();
        });

        Schema::table('players', static function (Blueprint $table) {
            $table->unsignedInteger('event_id')->default(251227)->after('id')->index();
            $table->boolean('subsidy_flag')->default(false)->after('card_count');
            $table->dateTime('subsidy_flag_slot_at')->nullable()->after('subsidy_flag');
            $table->dateTime('last_subsidy_paid_slot_at')->nullable()->after('subsidy_flag_slot_at');
            $table->dateTime('last_take_at')->nullable()->after('last_subsidy_paid_slot_at');
            $table->unique(['event_id', 'name']);
        });

        Schema::create('trick_event_cards', static function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('event_id')->index();
            $table->foreignId('deck_id')->constrained('decks')->cascadeOnDelete();
            $table->string('state')->default('_deck')->index();
            $table->unsignedTinyInteger('difficulty');
            $table->unsignedTinyInteger('rarity')->nullable();
            $table->unsignedInteger('stack_count')->default(0);
            $table->string('taker')->nullable()->index();
            $table->string('top_player')->nullable();
            $table->unsignedInteger('post_count')->default(0);
            $table->integer('paid_points_total')->default(0);
            $table->dateTime('limit_at')->nullable()->index();
            $table->dateTime('taken_at')->nullable();
            $table->dateTime('collected_at')->nullable();
            $table->unsignedBigInteger('stack_parent_id')->nullable()->index();
            $table->unsignedInteger('drawn_order')->nullable();
            $table->timestamps();
            $table->unique(['event_id', 'deck_id']);
            $table->foreign('event_id')->references('event_id')->on('trick_events')->cascadeOnDelete();
            $table->foreign('stack_parent_id')->references('id')->on('trick_event_cards')->nullOnDelete();
        });

        Schema::create('trick_card_payments', static function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('event_id')->index();
            $table->foreignId('event_card_id')->constrained('trick_event_cards')->cascadeOnDelete();
            $table->foreignId('deck_id')->constrained('decks')->cascadeOnDelete();
            $table->unsignedInteger('stage_id')->index();
            $table->string('player_name')->index();
            $table->integer('points_paid');
            $table->unsignedBigInteger('record_id')->nullable()->index();
            $table->timestamps();
            $table->unique(['event_id', 'deck_id', 'player_name']);
            $table->foreign('event_id')->references('event_id')->on('trick_events')->cascadeOnDelete();
            $table->foreign('record_id')->references('post_id')->on('records')->nullOnDelete();
        });

        Schema::create('trick_collection_rewards', static function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('event_id')->index();
            $table->foreignId('event_card_id')->constrained('trick_event_cards')->cascadeOnDelete();
            $table->foreignId('deck_id')->constrained('decks')->cascadeOnDelete();
            $table->string('player_name')->index();
            $table->integer('points_delta');
            $table->string('reward_type', 32);
            $table->timestamps();
            $table->unique(['event_id', 'deck_id', 'player_name', 'reward_type'], 'trick_rewards_unique');
            $table->foreign('event_id')->references('event_id')->on('trick_events')->cascadeOnDelete();
        });

        Schema::create('trick_event_records', static function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('record_id')->unique();
            $table->unsignedInteger('event_id')->index();
            $table->foreignId('event_card_id')->constrained('trick_event_cards')->cascadeOnDelete();
            $table->foreignId('deck_id')->constrained('decks')->cascadeOnDelete();
            $table->timestamps();
            $table->foreign('record_id')->references('post_id')->on('records')->cascadeOnDelete();
            $table->foreign('event_id')->references('event_id')->on('trick_events')->cascadeOnDelete();
        });

        Schema::create('trick_card_holders', static function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('event_id')->index();
            $table->foreignId('event_card_id')->constrained('trick_event_cards')->cascadeOnDelete();
            $table->foreignId('deck_id')->constrained('decks')->cascadeOnDelete();
            $table->string('player_name')->index();
            $table->timestamps();
            $table->unique(['event_id', 'deck_id', 'player_name']);
            $table->foreign('event_id')->references('event_id')->on('trick_events')->cascadeOnDelete();
        });

        Schema::table('limit_logs', static function (Blueprint $table) {
            $table->unsignedInteger('event_id')->nullable()->after('event')->index();
            $table->unsignedBigInteger('event_card_id')->nullable()->after('card_id')->index();
            $table->integer('points_delta')->nullable()->after('rank_points_delta');
        });
    }

    public function down(): void
    {
        Schema::table('limit_logs', static function (Blueprint $table) {
            $table->dropColumn(['event_id', 'event_card_id', 'points_delta']);
        });
        Schema::dropIfExists('trick_card_holders');
        Schema::dropIfExists('trick_event_records');
        Schema::dropIfExists('trick_collection_rewards');
        Schema::dropIfExists('trick_card_payments');
        Schema::dropIfExists('trick_event_cards');
        Schema::table('players', static function (Blueprint $table) {
            $table->dropUnique('players_event_id_name_unique');
            $table->dropColumn([
                'event_id',
                'subsidy_flag',
                'subsidy_flag_slot_at',
                'last_subsidy_paid_slot_at',
                'last_take_at',
            ]);
        });
        Schema::dropIfExists('trick_events');
    }
};
