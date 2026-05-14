<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('decks', static function (Blueprint $table) {
            if (!Schema::hasColumn('decks', 'card_id')) {
                $table->unsignedBigInteger('card_id')->nullable()->after('id')->index();
            }
            if (!Schema::hasColumn('decks', 'origin_stage_id')) {
                $table->unsignedInteger('origin_stage_id')->nullable()->after('stage_id')->index();
            }
        });

        if (Schema::hasColumn('decks', 'card_id')) {
            DB::statement('UPDATE decks SET card_id = id WHERE card_id IS NULL');
        }
        if (Schema::hasColumn('decks', 'origin_stage_id') && Schema::hasColumn('decks', 'stageId')) {
            DB::statement('UPDATE decks SET origin_stage_id = stageId WHERE origin_stage_id IS NULL');
        }
        if (Schema::hasColumn('decks', 'origin_stage_id') && Schema::hasColumn('decks', 'stage_id')) {
            DB::statement('UPDATE decks SET origin_stage_id = stage_id WHERE origin_stage_id IS NULL AND stage_id IS NOT NULL');
        }
        if (Schema::hasColumn('decks', 'stage_id')) {
            $eventColumn = Schema::hasColumn('decks', 'event_id') ? 'event_id' : 'eventId';
            DB::table('decks')
                ->where($eventColumn, 251227)
                ->where('stage_id', '>=', 100000)
                ->update(['stage_id' => null]);
        }

        DB::table('stages')
            ->whereBetween('stage_id', [1313, 1342])
            ->delete();
    }

    public function down(): void
    {
        Schema::table('decks', static function (Blueprint $table) {
            if (Schema::hasColumn('decks', 'origin_stage_id')) {
                $table->dropColumn('origin_stage_id');
            }
            if (Schema::hasColumn('decks', 'card_id')) {
                $table->dropColumn('card_id');
            }
        });
    }
};
