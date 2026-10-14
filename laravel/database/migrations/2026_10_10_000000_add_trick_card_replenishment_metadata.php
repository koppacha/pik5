<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void
    {
        Schema::table('decks', function (Blueprint $table): void {
            $table->string('card_key', 32)->nullable()->unique();
            $table->unsignedBigInteger('clone_source_deck_id')->nullable();
            $table->string('score_order', 4)->nullable();
            $table->unique(['eventId', 'clone_source_deck_id'], 'decks_event_clone_source_unique');
        });
    }
    public function down(): void
    {
        Schema::table('decks', function (Blueprint $table): void {
            $table->dropUnique('decks_event_clone_source_unique');
            $table->dropUnique('decks_card_key_unique');
            $table->dropColumn(['card_key', 'clone_source_deck_id', 'score_order']);
        });
    }
};
