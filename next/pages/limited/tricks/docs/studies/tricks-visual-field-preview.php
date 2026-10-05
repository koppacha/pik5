<?php

// Laravelコンテナで標準入力から実行。通常は検査のみ。
// TRICKS_VISUAL_FIELD_APPLY=1 でデバッグ大会251227に表示確認用の場札4枚を配置する。
require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Deck;
use App\Models\Player;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Services\Tricks\TrickClock;
use App\Services\Tricks\TrickStageAllocator;
use Illuminate\Support\Facades\DB;

$apply = getenv('TRICKS_VISUAL_FIELD_APPLY') === '1';
$result = DB::transaction(function () use ($apply): array {
    $event = TrickEvent::where('event_id', 251227)->lockForUpdate()->firstOrFail();
    if (! $event->debug || $event->state !== 'active') {
        throw new RuntimeException('対象の開催中デバッグ大会と一致しません');
    }
    $actor = 'codex_visual_preview';
    $field = TrickEventCard::where('event_id', $event->event_id)->where('state', '_field')->lockForUpdate()->get();
    if ($field->count() === 4 && $field->every(fn ($card) => $card->taker === $actor)) {
        return ['already_applied' => true, 'field_count' => 4];
    }
    if ($field->isNotEmpty() || Player::where('event_id', $event->event_id)->where('name', $actor)->exists()) {
        throw new RuntimeException('既存の場札または検証用プレイヤーがあるため更新しません');
    }
    $cards = TrickEventCard::with('deck')->where('event_id', $event->event_id)
        ->where('state', '_deck')->whereNull('rarity')->where('draw_count', 0)
        ->whereHas('deck', fn ($query) => $query->whereIn('creator', ['codex_dummy', 'recovery_placeholder']))
        ->orderBy('id')->limit(12)->lockForUpdate()->get();
    if ($cards->count() !== 12) {
        throw new RuntimeException('未開封のテストカード12枚がありません');
    }
    $now = app(TrickClock::class)->now($event);
    $limit = $now->addSeconds(99 * 3600 + 59 * 60 + 59);
    $inspection = ['event_id' => $event->event_id, 'rarities' => [2, 3, 4, 5], 'field_count' => 4, 'stack_cards_total' => 12, 'limit_at' => $limit->toIso8601String()];
    if (! $apply) {
        return ['applied' => false] + $inspection;
    }
    if ($limit->greaterThanOrEqualTo($event->end_at)) {
        throw new RuntimeException('表示用期限が大会終了以降になるため更新しません');
    }
    $backup = [
        'event_id' => $event->event_id,
        'actor' => $actor,
        'event_cards' => $cards->map(fn ($card) => $card->getAttributes())->all(),
        'decks' => $cards->map(fn ($card) => $card->deck->only(['id', 'stage_id', 'updated_at']))->all(),
    ];
    $backupPath = '/tmp/tricks-visual-field-before-'.date('Ymd-His').'.json';
    if (file_put_contents($backupPath, json_encode($backup, JSON_THROW_ON_ERROR)) === false) {
        throw new RuntimeException('変更前の退避に失敗しました');
    }
    chmod($backupPath, 0600);
    Player::create(['event_id' => $event->event_id, 'name' => $actor, 'draw_points' => 100, 'rank_points' => 0, 'card_count' => 0, 'take_count' => 4, 'last_take_at' => $now]);
    $order = (int) TrickEventCard::where('event_id', $event->event_id)->max('drawn_order');
    $output = [];
    foreach ($cards->chunk(3)->values() as $index => $group) {
        $selected = $group->first();
        $stageId = app(TrickStageAllocator::class)->ensure($event, $selected->deck);
        foreach ($group as $card) {
            $isField = $card->id === $selected->id;
            $card->fill([
                'state' => $isField ? '_field' : '_stack',
                'rarity' => $isField ? $index + 2 : 1,
                'draw_count' => 1,
                'drawn_order' => ++$order,
                'stack_parent_id' => $isField ? null : $selected->id,
                'taker' => $isField ? $actor : null,
                'stack_count' => $isField ? 3 : 0,
                'taken_at' => $isField ? $now : null,
                'limit_at' => $isField ? $limit : null,
                'paid_points_total' => 0,
                'post_count' => 0,
            ])->save();
        }
        $output[] = ['deck_id' => $selected->deck_id, 'stage_id' => $stageId, 'rarity' => $index + 2, 'limit_at' => $limit->toIso8601String()];
    }

    return ['applied' => true, 'backup' => $backupPath, 'cards' => $output] + $inspection;
});
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR).PHP_EOL;
