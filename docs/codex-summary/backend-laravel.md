# Laravel APIと業務処理

- 入口は `laravel/routes/api.php`、middlewareは `app/Http/Kernel.php`。既存グループと署名・公開条件を確認してルートを追加する。
- `RecordController` は投稿・編集・公開取得。新規 `unique_id` はバージョン由来3桁＋ランダム6桁、編集では維持する。内部 `post_id` と公開 `unique_id` を取り違えない。
- `NewRecordController` は新着。通常新着とイベント投稿の公開・通知条件を確認し、拡張ステージの内部IDを単純に1000以上という理由で分類しない。
- `UserTotalController` はユーザー総合・dashboard。`/api/user/rank/{id}` は `totals` を参照する。`user:fetch-totals --latest` は日次の最新値、引数なしは月次snapshot。
- `EventResultController` と `EventStampService` はイベント総合とスタンプの入口。[イベント仕様](events-and-rankings.md)を参照する。
- `DandoriController` / `DandoriCatalog` / `StageCodes` はルール48・拡張コードの入口。[ルール48](security-and-rule48-planning.md)を参照する。
- `app/Console/Kernel.php` は大会保守を毎分、Telescope整理を毎時、認証履歴整理と最新総合更新を日次、snapshotを月次実行する。バックアップは設定で有効化する。

## データ投入

- CSVの空欄はnullable列ならnull、数値は型を揃える。対象ID・競合・再実行時の保持を検証する。
- `EventResultCsvSeeder` はID衝突検査付きtransaction / upsert。CSV外の成績は削除しない。全件truncateという旧説明は使わない。
- `RecordCsvSeeder` は全件truncateする。既存を保持する開発記録の復旧には `RestoreRecordCsvSeeder` を使い、公開IDで既存を保持し不足だけ追加する。CSV日時を保持し、NULLのdifficultyのみ `console=3` なら3、それ以外2で補完する。既存の非NULL値・削除状態・日時を保持し、認証データやアクセス元を投入しない。詳細は [年別記録ページ](../yearly-record-page.md)。
- `DatabaseSeeder` 全体は本番初回投入やテスト準備として無条件に実行しない。各Seederの削除・初期化範囲を確認して対象を限定する。
- テストでの初期化はSQLiteインメモリまたは明示した専用DB内に限る。[テスト方針](testing-and-verification.md)を参照する。
