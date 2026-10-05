<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trick_event_cards', function (Blueprint $table): void {
            $table->unsignedInteger('draw_count')->default(0);
        });
        $counts = DB::table('limit_logs')->where('event', 'draw')->whereNotNull('event_card_id')
            ->select('event_card_id')->selectRaw('COUNT(*) AS total')->groupBy('event_card_id')->pluck('total', 'event_card_id');
        foreach (DB::table('trick_event_cards')->orderBy('id')->get(['id', 'rarity', 'returned_count']) as $card) {
            DB::table('trick_event_cards')->where('id', $card->id)->update([
                'draw_count' => max((int) ($counts[$card->id] ?? 0), (int) ($card->rarity !== null)),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('trick_event_cards', function (Blueprint $table): void {
            $table->dropColumn('draw_count');
        });
    }
};
