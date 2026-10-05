# decks DB設計・データ検査（2026-10-04）

## 指示と対象

重複カラム3組の統合可否、初回ドロー時のレア度抽選を調査し、titleを通常ステージ名、textをランダムな64〜256文字へ更新する指示に基づく。
対象はローカルDBの大会251227に紐づくテストカード200枚（codex_dummy / recovery_placeholder）。

## 統合可否

| カラム | 更新前の照合結果 | 結論 |
| --- | --- | --- |
| rule_name / ruleName | 200件一致 | rule_nameへ統合可能。旧参照と書き込みを先に移行する |
| top_player / topPlayer | 200件一致（NULLも一致扱い） | 旧互換データとして統合可能。現行の正規トップ投稿者はtrick_event_cards.top_player。decksから大会順位は判断しない |
| origin_stage_id / stageId | 153件一致、47件はNULL / 0 | 未設定値をNULLへ正規化すれば統合可能。投稿用stage_idとは別用途であり統合しない |

今回、列削除は実施していない。旧TrickControllerのcardValue/deckColumn互換分岐、TrickLegacyMigrationService、TrickStateServiceのruleNameフォールバック、DeckSeeder、TrickDummyDeckSeeder、TrickStaging261001Seeder、TrickTestFixtureService、既存テストに旧参照・旧書き込みが残る。既存migrationのロールバック順序も考慮した新規migrationが必要。

## レア度

- decks.rarityは旧互換データ。初期migrationのNOT NULL DEFAULT 1やダミーSeederの1〜5の固定値が残るため全行に値が存在する。現行大会のレア度として参照しない。
- TrickEventInitializerはtrick_event_cards.rarityを設定せずNULLで初期化する。
- TrickGameService::drawは同カラムがNULLの場合だけ抽選し、返却・再ドローで保存値を保持する。TrickStateService::normalizeCardも同カラムを返す。
- 実DBの未抽選山札33枚は全件NULL。ドロー履歴があるのにNULLのカードは0枚。
- 一方、確定済みレア度があるがドローログがないカードは53枚（捨て札42、回収済み11）。履歴だけでは初回抽選を確認できない。旧移行処理はdecks.rarityを無条件でコピーするため、その経路でも値が設定される。今回の53枚がその経路に由来するかは未確定であり、全履歴が仕様準拠とは断定しない。保存済みレア度は変更していない。

## データ更新・検証

- 通常ステージはstagesのstage_id 101〜422かつtype=stage、カッコなしの名称144候補からカードごとに無作為抽出。
- title、origin_stage_id、stageIdをセットで更新。元番号未設定47枚、元番号が総合ランキングを指す31枚も通常ステージへ整合。
- textの目標文字数はrandom_int(64,256)。日本語文字数で検査し、実測は64〜255文字、117種類。本文は表示・投稿確認用のテスト文であり、本番用の個別ルール内容を確定するものではない。
- 200枚全件で通常ステージ名との一致、元番号2列一致を検証。
- 更新はDBトランザクション。変更対象列の復元用JSONはLaravelコンテナの/tmp/tricks-deck-refresh-20261004-134651-8b8f8d16.jsonへ退避。コンテナ再作成で失われる可能性がある。
- trick_event_cards全行を更新前後で比較し完全一致。投稿用stage_id、投稿記録、レア度は維持。
- 関連stages行の名称・系列更新は自動承認レビューが共有ステージへの副作用を理由に却下したため除外。既存投稿用ステージの名称と新しいカード名が異なる場合がある。
- 再実行用スクリプト: docs/studies/tricks-deck-data-refresh.php。既定は検査のみ、TRICKS_DECK_REFRESH_APPLY=1で再ランダム化する。
- LaravelのSQLiteインメモリDBを使うTrickPhaseTwoTest / TrickStaging261001SeederTestは9件成功（初期化・参加・ドロー・テイク・返却後レア度維持・捨て札再利用）。
- Playwrightで未ログインの大会画面を表示し、canvas 1200×998 / 2400×1996が可視であることを検査しスクリーンショットも目視確認。場札は空のため、更新した本文のログイン後カード詳細表示は未検証。

## 同日追加指示に基づく実装・列削除

ユーザーの追加指示（統合可能列の削除、旧レア度列削除、本文全文表示と14px/10px、手札フッター整理、再ドロー時のsquare-check＋開封済み表示）に基づき実装した。

- `2026_10_04_000000_consolidate_trick_deck_columns`で正規列への不足値の補完後、`decks.ruleName/topPlayer/stageId/rarity`を削除。実データの競合や旧大会の未移行があれば削除前に中止する。
- `2026_10_04_000001_add_draw_count_to_trick_event_cards`で大会カードにドロー回数を追加。ドローログを集計し、レア度確定済みカードの下限を1とした。初回ドローは1、再ドローは2以上。既存履歴の欠損分を勝手に推定して2以上へ補完しない。
- ローカルMySQLで2本とも適用済み。decks200件、trick_event_cards200件を維持し、大会カードの既存列は退避との比較で完全一致。
- 旧列を使うSeeder・現行DTO・旧Controllerの参照を移行。旧CardControllerの投稿更新は元ステージ番号ではなく投稿用stage_idだけで照合する。
- 旧データのインポート互換性のためTrickLegacyMigrationServiceには旧DBのレア度列を読み取る経路を残した。ただし現行スキーマでは新規に確定済み旧カードを作らず明示的に中止する。既に移行された大会カードは保存済みレア度を保持する。未抽選の旧山札はNULLで移行する。
- カード本文の74/120文字短縮を削除。140文字以下14px、141文字以上10px。手札・場札・ドロー演出に適用。場札のpadding/gapと本文行間を調整し、通常の140/141/256文字がカード内へ収まることを検証。極端な改行などで領域を超える場合も全文を保持し、本文内でスクロール可能。
- 手札とドロー演出のフッターから「手札」とレア度を削除。was_opened=true（draw_count>1）だけ灰色#808080のFont Awesome square-checkと「開封済み」を表示。
- Laravel関連65件のテスト成功。その後、旧CardController検証を追加した専用4件も成功。移行テストは不足値補完・大会レア度保持・競合中止・ロールバック・ドロー回数補完をカバー。UI lint成功。
- Playwrightの専用モック状態で手札／場札それぞれ140/141/256文字のDOM全文、font-size、scrollHeight=clientHeightを確認。初回フッター空欄、再ドローのsquare-check・灰色文字を確認。スクリーンショットを目視確認。
- 3.5秒のポーリング・時刻更新をまたぐ負荷検査: Phaser描画回数1→1、GameObject1→1、DOMカード6→6、canvas2→2、activeRaf=0、activeTimers=0、phaserLoopSleeping=true。
- 削除前データの厳密な退避はLaravelコンテナとホストの`/tmp/tricks-before-column-removal-20261004.json`に保存（ホスト上は/private/tmp）。削除前ソースは/private/tmp/tricks-column-ui-backupへ退避。migration downは正規列と大会カードから旧キャッシュを再構築し、元の旧キャッシュ値そのものの復元には退避ファイルを使う。
- 編集の一括操作は自動承認レビューで互換性・破損リスクを理由に却下されたため、一時コピーで検証してからハッシュ照合・退避付きで適用する手順へ変更し、適用は承認された。未解消の承認待ちはない。

## フォントサイズの追加訂正

最新指示により本文サイズを140文字以下14px、141〜200文字12px、201文字以上10pxへ変更。手札・場札・ドロー演出で共通関数を使う。場札本文のline-heightは1.2へ調整し、140/141/200/201文字の境界値で指定サイズと全文の収まりをPlaywrightで確認。UI lint成功。DB変更なし。
