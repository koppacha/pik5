<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $pairs = ['rule_name' => 'ruleName', 'top_player' => 'topPlayer', 'origin_stage_id' => 'stageId'];
        $rows = DB::table('decks')->orderBy('id')->get();
        // データ競合や旧大会の未移行を先に検査し、値を捨てて統合しない。
        foreach ($rows as $row) {
            foreach ($pairs as $current => $legacy) {
                $a = $this->normalize($current, $row->{$current});
                $b = $this->normalize($current, $row->{$legacy});
                if ($a !== null && $b !== null && $a !== $b) {
                    throw new RuntimeException("decks.id={$row->id}: {$current}/{$legacy}が競合しています");
                }
            }
            if (in_array($row->state, ['_eligible', '_deck', '_excluded'], true)) {
                continue;
            }
            $cards = DB::table('trick_event_cards')->where('deck_id', $row->id);
            // 新方式はdecksの状態・レア度を更新しない。未開封のNULLも正規データ。
            if ($row->state === '_in_event' && $cards->exists()) {
                continue;
            }
            $eventId = (int) ($row->event_id ?: $row->eventId);
            $savedRarity = $cards->where('event_id', $eventId)->value('rarity');
            if ($savedRarity === null || (int) $savedRarity < 1 || (int) $savedRarity > 5
                || (int) $savedRarity !== (int) $row->rarity) {
                throw new RuntimeException("decks.id={$row->id}: 旧大会カードの確定レア度を同じ大会へ移行してからレア度列を削除してください");
            }
        }
        DB::transaction(function () use ($rows, $pairs): void {
            foreach ($rows as $row) {
                $values = [];
                foreach ($pairs as $current => $legacy) {
                    $values[$current] = $this->normalize($current, $row->{$current})
                        ?? $this->normalize($current, $row->{$legacy});
                }
                DB::table('decks')->where('id', $row->id)->update($values);
            }
        });
        Schema::table('decks', function (Blueprint $table): void {
            $table->dropColumn(['ruleName', 'topPlayer', 'stageId', 'rarity']);
        });
    }

    public function down(): void
    {
        Schema::table('decks', function (Blueprint $table): void {
            $table->string('ruleName')->default('');
            $table->string('topPlayer')->nullable();
            $table->unsignedInteger('stageId')->default(0);
            $table->unsignedTinyInteger('rarity')->default(1);
        });
        foreach (DB::table('decks')->orderBy('id')->get() as $row) {
            // 旧キャッシュは現在の正規データから再構築する。元の値の厳密復元には退避を使用。
            $rarity = DB::table('trick_event_cards')->where('deck_id', $row->id)
                ->whereNotNull('rarity')->orderByDesc('id')->value('rarity');
            DB::table('decks')->where('id', $row->id)->update([
                'ruleName' => $row->rule_name ?? '',
                'topPlayer' => $row->top_player,
                'stageId' => $row->origin_stage_id ?? 0,
                'rarity' => $rarity ?? 1,
            ]);
        }
    }

    private function normalize(string $column, mixed $value): mixed
    {
        if ($column === 'origin_stage_id') {
            return (int) $value > 0 ? (int) $value : null;
        }

        return $value === null || $value === '' ? null : (string) $value;
    }
};
