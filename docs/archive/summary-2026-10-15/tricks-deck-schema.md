> 2026-10-15 整理前のサマリー。過去時点の記録であり、現行方針には使わない。パス表記はリポジトリ直下基準。現行の入口は [docs/README.md](../../README.md)。

# トリックカードDB設計の確認事項（2026-10-04）

- 現行カード本体はdecks、大会内レア度とトップ投稿者はtrick_event_cardsを正規データとする。decks.rarity/top_player/topPlayerは現行大会状態の判定に使わない。
- rule_name/ruleName、origin_stage_id/stageIdは旧処理とSeederの書き込み移行後に統合可能。origin_stage_idのNULLと旧stageIdの0は未設定値。投稿用stage_idは元ステージ番号とは別用途。
- 旧TrickLegacyMigrationServiceはdecks.rarityをコピーするため、旧移行カードのレア度が初回ドローで決まったことは履歴照合なしには保証できない。
- 2026-10-04のローカル大会251227のテストカード200枚は通常ステージ101〜422から名称と元番号を無作為選択し、本文を64〜256文字条件で更新済み。更新前の対象列だけをLaravelコンテナ/tmp/tricks-deck-refresh-20261004-134651-8b8f8d16.jsonへ退避。
- 投稿用stages行の名称・系列更新は自動承認レビューで共有ステージへの影響が指摘され、更新対象から除外した。
- 詳細: next/pages/limited/tricks/docs/tricks-deck-db-review-2026-10-04.md。

## 同日追加指示の適用

- 2026_10_04_000000でdecks.ruleName/topPlayer/stageId/rarityを削除。正規列rule_name/top_player/origin_stage_idへ不足値を補完し、競合または旧大会カード未移行は削除前に中止する。
- 2026_10_04_000001でtrick_event_cards.draw_countを追加。初回ドローは1、2回目以降はwas_opened=true。既存ドローログから補完し、欠損履歴のある確定済みカードは下限1とする。
- ローカルMySQLへ適用済み。大会カード200件の既存列は完全保持。削除前データはコンテナ/tmpとホスト/private/tmp/tricks-before-column-removal-20261004.jsonへ退避。downは正規データから旧列を再構築し、削除前キャッシュの厳密復元には退避を使う。
- カード本文の短縮を除去。140文字以下14px、141〜200文字12px、201文字以上10px。手札・切り札・ドロー演出すべてに適用。本文内スクロールを許容して改行が多い本文も切り捨てない。
- 手札フッターの「手札」と重複レア度を削除。再ドローだけ灰色のsquare-checkと「開封済み」を表示する。
- Seeder・DTO・旧Controllerの削除列参照を移行。旧CardControllerは投稿用stage_idだけを照合する。旧DBインポート互換経路では旧レア度を条件付きで読むが、現行スキーマでレア度不明の確定済み旧カードを新規作成しない。

- 2026-10-05横断レビュー：legacy移行はdraw_count列未追加の旧schemaにも対応。旧確定レア度の削除ガードは同大会・同値の保存まで確認する（別大会／NULL／異値は拒否、新方式_in_event未開封NULLは許容）。旧schemaからmigration順序を含めて回帰テスト済み。

## タイム基準カード（2026-10-09）

- 判定は `decks.score_type=points|time`。本文推測は禁止。timeは経過時間の整数秒（1〜999999）、短い記録が上位、個人最良も最短。同タイムは同順位。
- `TrickStageAllocator::ensure` が `stages.display=time|int` に同期。カードDTO・ランキング・回収スナップショットもscore_typeを保持。投稿フォームはmm:ss/h:mm:ssを秒に変換し、一般記録画面はステージmetadataを参照する。
- 追加migration `2026_10_09_120000_add_score_type_to_trick_decks.php` は分離SQLiteのテストのみ適用。ローカルMySQL／本番は未適用。反映にはmigration、対象カードの明示設定、既にstage_idがあるカードのAllocator再同期が必要。既存投稿の単位を確認する。
- 分離DBで保存83秒・昇順83,83,120・同率1,1,3・回収後種別、ブラウザで時間入力と整数秒送信を確認。小数秒は非対応。


## 2026-10-09 特殊元ステージIDのカード名

下二桁00（例200）の元ステージIDでカード固有名を使いたいという運営要件を確認。現行カードUI・state API・投稿用ステージ生成はDeck.titleを使い、元ステージ翻訳名に置換しない。下二桁00だけの専用分岐は現状ない。既存TrickStaging261001SeederのCSV取込は全origin_stage_idのstages実在を要求するため、未登録の特殊IDを使う場合は取込検証の例外対応が必要。今回コード・データ変更なし、ソース確認のみ。


## 2026-10-09 本番相当カードCSV

ユーザーが用意するCSVの推奨列をcard_key,origin_stage_id,title,rule_name,text,difficulty,creator,score_typeと定義。creatorのみ空欄可（ユーザーID指定）。DB採番・進行状態はCSV外。1大会160枚が基本。既存261001専用Seederへそのまま渡せないため、投入前に新形式・考案者・time・末尾00特殊元ステージID検証を対応する。準備仕様：next/pages/limited/tricks/docs/tricks-production-card-csv.md。今回はデータ削除・投入なし。


## 2026-10-09 creator仕様の訂正（直前のCSV案内より優先）

ユーザー指定によりcreatorはユーザーIDではなく表示用文字列に統一。CSV記載名をそのまま表示し共同案を許可する。既存ユーザーIDと同じ文字列でもスクリーンネームへ変換しない。手札・切り札・ミニカード・管理者カード一覧・デッキ内訳を対応し、長いカード表示は従来どおり省略、titleは全文。テイカー・ホルダーは従来どおりID変換。CSV準備仕様とシステム設計を更新。Playwright共同名・ID衝突・canvas静止/破棄、lint、Laravel10件成功。データの削除・投入は未実施。


## 2026-10-09 大会261009投入

ユーザー提供decks261009.csv（列順不問・UTF-8 BOM許容）を専用TrickProduction261009Seederでローカル投入。通常大会261009「第19回期間限定ランキング」、開始2026-10-09 18:00 JST、終了10-11 19:59 JST、debug/test_mode false。160枚：CSVscoreをpointsへ正規化147枚、time13枚。creatorは記載名、元ステージ末尾00（200/300）は実在検査例外、他は実在要求。限定条件に一致した旧テスト大会251227/261001と360カード・関連データ削除。通常アカウント・認証情報・他の通常記録は操作なし。再実行は同じ設定・CSVで進行状態維持、差異は拒否。日程変更時は別途明示更新。実時刻のドローprobe成功後rollback、山札160・参加者0。実ページ両URL確認、Laravel119件成功。詳細：next/pages/limited/tricks/docs/tricks-261009-import.md。本番サーバー操作なし。


## 2026-10-10 残り時間順位の例外

元ステージID419〜428のscore_type=timeカードは残り時間申告のため最大自己ベスト・降順順位。それ以外のtimeカードは最短自己ベスト・昇順。単位は整数秒、入力／表示time、同点同順位を維持。pointsカードは元IDに関わらず最大・降順。本番f13406b2をPHPファイル原子的置換で無停止反映、107件テスト成功。本番event261009のdecks.eventIdが大会ID、event_idはNULLであることに注意。


## 2026-10-10 投稿ステージ1356の追加例外

元401のカードでも独自ルールのため投稿ステージ1356だけはtime最大自己ベスト／DESC順位。その他の元401 timeは最短／ASCを維持。元419〜428のtime降順例外と併存し、整数秒・time入力表示・同率を維持。新規カードで同様の異例ルールが増える場合はscore_type（表示単位）と順位方向を独立定義する設計を検討するが、今回schemaやCSV形式は変更していない。

### 2026-10-10 同内容カードの途中補充案
別deck/card/stage IDなら同内容カードは独立して動く（SQLite320枚テスト）。既存本番Seederは160枚一致を検査し追加不可。1356のDESC例外は新番号へ引き継がれない。途中補充は未承認・未実装で、詳細はnext/pages/limited/tricks/docs/tricks-duplicate-deck-review-2026-10-10.md参照。

### 2026-10-10 補充方針の採用とローカル実装
- 同一プレイ成果を同内容札の複数投稿へ流用することは禁止。別プレイ同スコアは可能で、同一性は運営確認。Webマニュアルとルールへ追記。
- TrickReplenish261009SeederがCSV001〜160の順に公開card_key161〜320を追加。内部数値IDを維持、clone_source_deck_idで対応・二重投入防止、score_orderで1356の複製DESCを保持。追加migrationが必要。元の初期化Seederは再実行不可。
- 本番・ローカル永続DBへの投入は未実施。SQLiteテストとブラウザ・build成功。実行順と復旧制約はtricks-next-downtime-2026-10-10.md参照。


### 2026-10-10 追加カード表示ID（3ac061be）

TrickStateServiceのカードDTOは、DBのcard_keyが `261009-161` 形式の場合、表示用card_keyとcard_idを文字列 `161` として返す。全体キーはcard_reference_keyに保持。DBのcard_key/card_id、操作用id/event_card_idは変更しない。古いクライアントのcard_id表示も互換維持する。本番へコンテナ再起動なしで反映・追加160枚と既存160枚を確認済み。
