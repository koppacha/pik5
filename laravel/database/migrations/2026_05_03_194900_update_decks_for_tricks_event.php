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
            if (!Schema::hasColumn('decks', 'event_id')) {
                $table->unsignedInteger('event_id')->nullable()->after('id')->index();
            }
            if (!Schema::hasColumn('decks', 'stage_id')) {
                $table->unsignedInteger('stage_id')->nullable()->after('event_id')->index();
            }
            if (!Schema::hasColumn('decks', 'rule_name')) {
                $table->string('rule_name')->nullable()->after('title');
            }
            if (!Schema::hasColumn('decks', 'stack_count')) {
                $table->unsignedInteger('stack_count')->default(0)->after('rarity');
            }
            if (!Schema::hasColumn('decks', 'post_count')) {
                $table->unsignedInteger('post_count')->default(0)->after('topPlayer');
            }
            if (!Schema::hasColumn('decks', 'top_player')) {
                $table->string('top_player')->nullable()->after('topPlayer');
            }
            if (!Schema::hasColumn('decks', 'limit_at')) {
                $table->dateTime('limit_at')->nullable()->after('limit');
            }
            if (!Schema::hasColumn('decks', 'taken_at')) {
                $table->dateTime('taken_at')->nullable()->after('limit_at');
            }
            if (!Schema::hasColumn('decks', 'collected_at')) {
                $table->dateTime('collected_at')->nullable()->after('taken_at');
            }
            if (!Schema::hasColumn('decks', 'stack_parent_id')) {
                $table->unsignedBigInteger('stack_parent_id')->nullable()->after('collected_at')->index();
            }
            if (!Schema::hasColumn('decks', 'drawn_order')) {
                $table->unsignedInteger('drawn_order')->nullable()->after('stack_parent_id');
            }
        });

        if (Schema::hasColumn('decks', 'eventId') && Schema::hasColumn('decks', 'event_id')) {
            DB::statement('UPDATE decks SET event_id = eventId WHERE event_id IS NULL');
        }
        if (Schema::hasColumn('decks', 'stageId') && Schema::hasColumn('decks', 'stage_id')) {
            DB::statement('UPDATE decks SET stage_id = stageId WHERE stage_id IS NULL');
        }
        if (Schema::hasColumn('decks', 'ruleName') && Schema::hasColumn('decks', 'rule_name')) {
            DB::statement('UPDATE decks SET rule_name = ruleName WHERE rule_name IS NULL');
        }
        if (Schema::hasColumn('decks', 'rewards') && Schema::hasColumn('decks', 'stack_count')) {
            DB::statement('UPDATE decks SET stack_count = rewards WHERE stack_count = 0 AND rewards IS NOT NULL');
        }
        if (Schema::hasColumn('decks', 'count') && Schema::hasColumn('decks', 'post_count')) {
            DB::statement('UPDATE decks SET post_count = count WHERE post_count = 0 AND count IS NOT NULL');
        }
        if (Schema::hasColumn('decks', 'topPlayer') && Schema::hasColumn('decks', 'top_player')) {
            DB::statement('UPDATE decks SET top_player = topPlayer WHERE top_player IS NULL');
        }
        if (Schema::hasColumn('decks', 'limit') && Schema::hasColumn('decks', 'limit_at')) {
            DB::statement('UPDATE decks SET limit_at = `limit` WHERE limit_at IS NULL');
        }
    }

    public function down(): void
    {
        Schema::table('decks', static function (Blueprint $table) {
            foreach ([
                'drawn_order',
                'stack_parent_id',
                'collected_at',
                'taken_at',
                'limit_at',
                'top_player',
                'post_count',
                'stack_count',
                'rule_name',
                'stage_id',
                'event_id',
            ] as $column) {
                if (Schema::hasColumn('decks', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
