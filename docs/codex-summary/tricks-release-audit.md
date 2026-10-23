# 大会APIの回帰観点

- 予約名 / userId衝突、期限ちょうどの投稿、上限スコア、開催中削除、参加前課金、終了ポットは `TrickReleaseRegressionTest` 等で確認する。過去の「修正未実施」を現行の未解決一覧として使わない。
- 採番はsingleton→大会・札等のロック順を統一し、裁定・テイク並行時も確認する。実MySQLの競合検証をSQLite成功だけで代用しない。
- 投稿のstage-context / record-contextは署名付きLaravel APIから取得する。Prismaに業務records / decks / trick_*があると仮定したraw queryは使わない。
- モックだけではDB分離による502を検知できなかった経緯がある。変更対象によってNextAuth→multipart→Laravelの専用データ疎通も行う。
- 大会投稿ruleはevent_id、表示名は大会title。旧rule1互換と一般公開除外、本人・他者・匿名の境界を確認する。
- マニュアル / PDFの差異は [整合性](tricks-rule-consistency.md)、検証実行は [テスト方針](testing-and-verification.md)を参照する。
