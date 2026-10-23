> 2026-10-15 整理前のサマリー。過去時点の記録であり、現行方針には使わない。パス表記はリポジトリ直下基準。現行の入口は [docs/README.md](../../README.md)。



## 2026-10-09 リリース検査

大会規模に合わせ、通常参加者による公平性侵害を優先。予約stateとuserIdの衝突、limit_at後投稿を隔離SQLiteで再現。修正未実施。投稿上限、開催中削除、参加前徴収、終了時ポット、表示PDFと練習記録規定にも問題。正式報告: next/pages/limited/tricks/docs/tricks-release-audit-2026-10-09.md。実在認証情報・実DBは使わず、旧セッションログは読まない。


## 2026-10-09 修正完了

ユーザー指示に基づき、文書不整合以外のR1〜R6と低優先コード問題を修正。Laravel117件、API26ケース、Next lint、Playwright、隔離MySQLの大会間採番と裁定・テイク並行処理が成功。予約名はASCII識別子制約と全予約名拒否、投稿期限は保存transaction内で同時刻以降拒否。採番は専用singletonロックをテイク・裁定の最初に取得して順序を統一する。追加migration score_typeとstage_allocation_locksはローカル適用済み、本番未適用。

詳細：next/pages/limited/tricks/docs/tricks-release-fixes-2026-10-09.md。不整合：同docs/tricks-manual-inconsistencies-2026-10-09.md。PDF6の最下位0はRPではなく還元DPの説明であり、旧検査の単独投稿2Rの例を訂正。原PDF・仕様書・ユーザーマニュアルはユーザー指定により変更していない。


## 2026-10-09 投稿502：DB境界の訂正

前回のrecordContextでPrisma raw queryを使用したが、Next Prismaは認証用DBでrecords/decks/trick_*が存在しない。実接続P2010/MySQL1146から502を特定。モック回帰では未検出だったため、署名付きLaravel stage-context/record-contextへ移行し、本人/正規権限の最小メタデータのみ取得、匿名・他人と公開非公開境界のテスト追加。実NextAuth→multipart投稿・編集・削除200を専用新規ユーザーと専用大会で確認後全撤去。秘密値の出力・再利用なし。Laravel120件、API26ケース、lint、Playwrightのカテゴリ名・rule=event_id送信成功。

投稿ruleは大会event_id、表示名は大会title。events.stage/nameを登録、stage.parentもevent_id。旧rule1を互換受理。現在大会261009カテゴリと既存stage1343をローカル同期。既存記録0でスコア付替えなし。前回の修正レポートのPrisma lookup案はこの訂正を優先する。詳細next/pages/limited/tricks/docs/tricks-post-category-fix-2026-10-09.md。本番サーバー未操作。
