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
- カード本文の短縮を除去。140文字以下14px、141〜200文字12px、201文字以上10px。手札・場札・ドロー演出すべてに適用。本文内スクロールを許容して改行が多い本文も切り捨てない。
- 手札フッターの「手札」と重複レア度を削除。再ドローだけ灰色のsquare-checkと「開封済み」を表示する。
- Seeder・DTO・旧Controllerの削除列参照を移行。旧CardControllerは投稿用stage_idだけを照合する。旧DBインポート互換経路では旧レア度を条件付きで読むが、現行スキーマでレア度不明の確定済み旧カードを新規作成しない。

- 2026-10-05横断レビュー：legacy移行はdraw_count列未追加の旧schemaにも対応。旧確定レア度の削除ガードは同大会・同値の保存まで確認する（別大会／NULL／異値は拒否、新方式_in_event未開封NULLは許容）。旧schemaからmigration順序を含めて回帰テスト済み。
