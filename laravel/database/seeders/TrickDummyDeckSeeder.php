<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TrickDummyDeckSeeder extends Seeder
{
    public function run(): void
    {
        $eventId = 251227;
        $now = Carbon::now()->toDateTimeString();

        $query = DB::table('decks');
        $query->where('eventId', $eventId);
        $query->where('creator', 'codex_dummy')->delete();

        $rows = [];
        for ($i = 1; $i <= 200; $i++) {
            $originStageId = 200 + (($i - 1) % 30) + 1;
            $difficulty = (($i - 1) % 5) + 1;
            $row = [
                'eventId' => $eventId,
                'origin_stage_id' => $originStageId,
                'title' => "ダミートリック{$i}",
                'rule_name' => "チャレンジルール{$i}",
                'state' => '_eligible',
                'text' => "制限時間内に指定ステージでできるだけ高いスコアを投稿するダミールールです。カード番号{$i}。",
                'difficulty' => $difficulty,
                'rewards' => 0,
                'creator' => 'codex_dummy',
                'taker' => null,
                'top_player' => null,
                'count' => 0,
                'limit' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            if (Schema::hasColumn('decks', 'event_id')) {
                $row['event_id'] = null;
            }
            if (Schema::hasColumn('decks', 'card_id')) {
                $row['card_id'] = null;
            }
            if (Schema::hasColumn('decks', 'stage_id')) {
                $row['stage_id'] = null;
            }
            if (Schema::hasColumn('decks', 'origin_stage_id')) {
                $row['origin_stage_id'] = $originStageId;
            }
            if (Schema::hasColumn('decks', 'stack_count')) {
                $row['stack_count'] = 0;
            }
            if (Schema::hasColumn('decks', 'post_count')) {
                $row['post_count'] = 0;
            }
            if (Schema::hasColumn('decks', 'top_player')) {
                $row['top_player'] = null;
            }
            if (Schema::hasColumn('decks', 'limit_at')) {
                $row['limit_at'] = null;
            }
            if (Schema::hasColumn('decks', 'taken_at')) {
                $row['taken_at'] = null;
            }
            if (Schema::hasColumn('decks', 'collected_at')) {
                $row['collected_at'] = null;
            }
            if (Schema::hasColumn('decks', 'stack_parent_id')) {
                $row['stack_parent_id'] = null;
            }
            if (Schema::hasColumn('decks', 'drawn_order')) {
                $row['drawn_order'] = null;
            }

            $rows[] = $row;
        }

        DB::table('decks')->insert($rows);
    }
}
