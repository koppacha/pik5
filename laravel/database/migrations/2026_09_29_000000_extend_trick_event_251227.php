<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $event = DB::table('trick_events')->where('event_id', 251227)->lockForUpdate()->first();
            if ($event === null) {
                return;
            }

            $cards = DB::table('trick_event_cards')->where('event_id', 251227)->lockForUpdate();
            $excess = $cards->where('state', '!=', '_excluded')->count() - 160;
            if ($excess > 0) {
                $deckIds = DB::table('trick_event_cards')
                    ->where('event_id', 251227)
                    ->where('state', '_deck')
                    ->orderByDesc('id')
                    ->limit($excess)
                    ->pluck('id');
                if ($deckIds->count() !== $excess) {
                    throw new RuntimeException('イベント251227の未使用カードだけでは160枚に調整できません');
                }
                DB::table('trick_event_cards')->whereIn('id', $deckIds)->update(['state' => '_excluded']);
            }

            $reservedDeckIds = DB::table('trick_event_cards')
                ->where('event_id', 251227)
                ->where('state', '!=', '_excluded')
                ->pluck('deck_id');
            DB::table('decks')->whereIn('id', $reservedDeckIds)->where('state', '!=', '_held')
                ->update(['state' => '_in_event']);

            DB::table('trick_events')->where('event_id', 251227)->update([
                'end_at' => '2026-10-11 20:00:00',
                'state' => 'active',
                'ended_at' => null,
                'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        // Reversing a reopened event after players have acted would discard live state.
    }
};
