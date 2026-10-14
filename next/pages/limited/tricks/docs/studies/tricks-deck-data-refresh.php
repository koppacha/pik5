<?php

// Laravelコンテナ内で標準入力から実行。通常は検査のみ。
// TRICKS_DECK_REFRESH_APPLY=1 の場合のみ大会251227のテストカード200枚を更新。
require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$apply = getenv('TRICKS_DECK_REFRESH_APPLY') === '1';
$result = DB::transaction(function () use ($apply): array {
    $decks = DB::table('decks')->where('eventId', 251227)
        ->whereIn('creator', ['codex_dummy', 'recovery_placeholder'])
        ->orderBy('id')->lockForUpdate()->get();
    if ($decks->count() !== 200 || DB::table('decks')->count() !== 200) {
        throw new RuntimeException('想定したテストカード200枚と一致しないため処理を中止しました');
    }
    $stages = DB::table('stages')->whereBetween('stage_id', [101, 422])
        ->where('type', 'stage')->get(['stage_id', 'stage_name'])
        ->filter(fn ($stage) => ! preg_match('/[()（）]/u', $stage->stage_name))->values();
    if ($stages->isEmpty()) {
        throw new RuntimeException('通常ステージ名がありません');
    }
    $beforeCards = DB::table('trick_event_cards')->orderBy('id')->get()->toJson();
    if ($apply) {
        // 認証情報を含まない、変更対象のカラムだけを退避する。
        $backup = $decks->map(fn ($deck) => array_intersect_key(
            (array) $deck, array_flip(['id', 'title', 'origin_stage_id', 'text', 'updated_at'])
        ));
        $path = '/tmp/tricks-deck-refresh-'.date('Ymd-His').'-'.bin2hex(random_bytes(4)).'.json';
        if (file_put_contents($path, $backup->toJson(JSON_UNESCAPED_UNICODE)) === false) {
            throw new RuntimeException('退避に失敗しました');
        }
        chmod($path, 0600);
        $sentence = 'これは表示と投稿の整合性を確認するためのテストルールです。指定された通常ステージでプレイし、終了画面に表示されたスコアを入力してください。プレイ条件と記録を確認し、同じ条件で挑戦した結果を投稿してください。';
        foreach ($decks as $deck) {
            $stage = $stages->random();
            $length = random_int(64, 256);
            DB::table('decks')->where('id', $deck->id)->update([
                'title' => $stage->stage_name,
                'origin_stage_id' => $stage->stage_id,
                'text' => mb_substr(str_repeat($sentence, 4), 0, $length - 1).'。',
                'updated_at' => now(),
            ]);
        }
        if ($beforeCards !== DB::table('trick_event_cards')->orderBy('id')->get()->toJson()) {
            throw new RuntimeException('大会カード状態が変化したためロールバックします');
        }
    }
    $summary = DB::table('decks as d')->leftJoin('stages as s', 's.stage_id', '=', 'd.origin_stage_id')
        ->selectRaw('COUNT(*) AS cards, MIN(CHAR_LENGTH(d.text)) AS min_text, MAX(CHAR_LENGTH(d.text)) AS max_text, COUNT(DISTINCT CHAR_LENGTH(d.text)) AS distinct_lengths, SUM(s.stage_id IS NULL OR s.stage_id NOT BETWEEN 101 AND 422 OR s.type <> "stage" OR NOT(d.title <=> s.stage_name)) AS invalid_titles')->first();
    if ($apply && ((int) $summary->invalid_titles !== 0 || $summary->min_text < 64 || $summary->max_text > 256)) {
        throw new RuntimeException('更新後の整合性検査に失敗しました');
    }
    return ['applied' => $apply, 'stage_candidates' => $stages->count(), 'summary' => $summary, 'event_cards_unchanged' => $beforeCards === DB::table('trick_event_cards')->orderBy('id')->get()->toJson(), 'backup' => $path ?? null];
});
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR).PHP_EOL;
