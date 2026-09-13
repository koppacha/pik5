# Events And Rankings

## 期間限定 / イベント総合

- `event_results` は各プレイヤーのイベントごとの成績を保存するテーブル。
- `event_results` は既存 `/limited/{limitedId}` ではなく、主に `/total/4` 系のイベント総合で参照する。
- 既存 `/limited/{limitedId}` の合計スコア/RPS は簡易計算の可能性があり、過去イベント再計算仕様の方を正とする。
- 既存画面の API を無理に差し替えると重いチーム戦・陣地計算が表示時に走る可能性があるため、保存済み総合成績を正にする方針。

## event_results テーブル

- 主な列: `id`, `event_id`, `event_title`, `sub_title`, `category`, `user_id`, `team`, `score`, `rps`, `rps_adjust`, `result`。
- CSVにないため timestamps は付けない。
- `sub_title` など空欄が多い列は nullable が無難。
- `category="期間限定ランキング"` かつ対象 event_id のみ差し替えることで、CSV由来の他イベント結果を壊さない。
- CSV Seeder は `truncate()` 後に投入する。

## stages 拡張

- `stages` には `creator`, `taker`, `holder`, `origin` を nullable で追加する。
- `holder` は過去期間限定再計算でステージトップ保持者として更新する。
- `creator/taker/origin` は将来の期間限定ステージ所持情報・由来管理用。

## 過去期間限定の再計算

- 再計算対象は 2022年以前の期間限定イベント。
- 対象 event_id の例: `151101` から `221008` までの18イベント。
- 除外 rule: `190209`, `190321`, `161022`, `250726`, `260704`。
- `210829` など仕様外のユーザー企画が混ざる可能性があるため、6桁 rule 抽出時は明示除外する。
- 第13回は35ステージ扱いになることを重点確認する。
- 第13回 `180901` の協力制は `team=999` として扱う補正がある。
- `m` は `w` より優先する。
- エリア踏破チーム戦の陣地計算では、ステージ上の record 行の `team` ではなく、ユーザー単位で確定した所属チームを使う。

## `/total/4` イベント総合

- `/total/4` は全カテゴリのイベント総合。
- `/total/4/{categoryId}` はカテゴリ別イベント総合。
- `categoryId` は3桁。未定義カテゴリでも空ランキングを許容する設計。
- フロントのカテゴリ表示は `locale.limited.category` を使う。
- Laravel 側にもカテゴリ対応の定数マップを持つ。PHP から JS locale を直接読むのは避ける。
- 将来二重管理が問題になる場合はカテゴリ定義を JSON 化して Next/Laravel 双方から読む案がある。
- 241（ダンドリバトル大会）は、`battles` から算出した最新 `result_point` に差し替える仕様がある。
- 161/191/211 は CSV 未投入の時期があり、空ランキングを許容する。

## スタンプ/結果表示

- イベント総合では `stampItems` を `Record` へ渡し、イベントごとの結果を小セルで表示する。
- インスタント研究会は `w=達成`, `p=未達成`, `e=参加`, `m=MVP` のように文言が通常イベントと異なる。
- 通常イベントは `w=優勝`, `p/e=参加`, `m=MVP`。
- カテゴリ `151` では表示上 `score=rps_adjust`, `rps=score` のように入れ替える方針がある。
- スタンプ順位は、期間限定ランキングでは `rps`、それ以外では `score` の降順でイベントごとに算出する。同値は同順位とする。
- 基礎ポイントは参加者数 `n <= 7` なら全員1点。`n > 7` なら上位 `ceil(n/4)` 位までを `ceil(n/4)+2-r` 点、それ以下を1点とする。
- チーム対抗戦（`team != 0`）かつ `n > 7` の基礎ポイントは、順位を使わず一律 `ceil(n/4)` 点とする。
- `p` は基礎ポイント、`e` は基礎ポイントを置き換えて2点、`m` は基礎ポイントに `7+ceil(n/8)` 点を加える。
- `w` は基礎ポイントに勝利ポイントを加える。チャレンジリレーはチーム2点・個人4点、RTA並走会と期間限定ランキングはチーム4点・個人6点、それ以外は常に2点。

## ピクチャレアリーナ対戦 検討事項

- `docs/idea/event-arena.md` は新規 `next/pages/limited/arena.js` と新規 Laravel API/テーブルを想定する。
- 旧 `old-arena.js`、既存 `arenas` テーブル、既存 `ArenaController` は関与させない方針。
- イベントは基本20戦。支払い下限/上限、観戦料下限/上限、勝者赤字防止補正、丸め方は `lab/sim_arena.py` 基準。ただし観戦料は仕様書を正とし、観戦料をポットに含めて勝者・敗者への配分対象にする。
- 最新状態は `final` フラグではなく、`arena_players.current_point/position/active` と `arena_matches.max(match_no)` で取得する設計案。
- DB案は `arena_events`、`arena_players`、`arena_matches`、`arena_results`。テーブル名は仮置きだが、旧 `arenas` は使わない。
- 管理領域はセッションユーザー `role=10` のみ表示。表示更新は SWR polling。
- ルーレット履歴はDB保存せず、暗号化Cookieに30日保存して同一ステージ3回以上抽選を抑止する。
- `lab/sim_arena.py` は仕様書に合わせ、基本20戦、観戦料は連勝数1以上のときだけ発生、観戦料をポットに含めて勝者・敗者へ配分する形に更新済み。
- 初期実装として `next/pages/limited/arena.js`、`next/pages/api/arena/[...path].js`、Laravel `NewArenaController`、`ArenaEvent/ArenaPlayer/ArenaMatch/ArenaResult` モデル、4つの arena 系 migration を追加済み。
- 管理操作は Next API 側でも `role=10` を要求し、GET state は公開取得できる。
