# テストと検証の方針

## 基本

- 実装の変更範囲に合わせて、入力・出力・拒否条件・保存不変条件を検証する。構文やlint成功を業務動作の成功とみなさない。
- DBなしの単体 / モック → 分離DBの統合 → 必要な実経路・ブラウザの順に選ぶ。文書だけの変更ではリンク・参照先・コマンドの整合を確認し、UI buildを無条件に要求しない。
- 実在ユーザーの認証情報・DBダンプ由来の秘密情報は使用しない。専用ユーザー、合成データ、Git管理外の環境変数を使う。秘密値をコマンド・出力・画像・ログへ残さない。
- 成功 / 失敗 / スキップ / 未実施を区別し、実行場所・コマンド・失敗理由を記録する。既知失敗があっても全体greenと報告しない。

## Next / Node

`next/package.json` に `test` scriptはないが、`next/tests/` にNodeテストがある。ホストの `next/` から、専用DB変数を外して実行できる。

```bash
env -u LIMITED_IDEAS_TEST_DATABASE_URL node --import tsx --test --test-concurrency=1 tests/limitedIdeas.test.js tests/legacyLimitedIdeas.test.js tests/pickupVideo.test.js tests/serverFetchJson.test.mjs tests/security-and-dandori.test.cjs
yarn lint
```

- `serverFetchJson` は127.0.0.1に一時HTTPサーバーを立てる。sandboxでlisten EPERMなら環境制約として切り分け、必要な実行権限で再試行する。
- `tsx` / esbuildのネイティブ依存はOSごとに異なる。共有node_modulesを使うときはインストールした環境に揃える。
- 型・生成・SSR / buildに影響する変更では `yarn build` も行う。devと同じ `.next` に並行buildしない。別出力を使う場合もポート・型生成物・依存まで競合を確認する。
- APIモックでは実DB接続・認証・署名・プロセス設定を検証できない。投稿や管理の経路を変えた場合は専用データで実疎通も行う。

## Laravel

リポジトリ直下から実行する。実行中コンテナのPHP拡張と依存が必要。ホストPHPを前提にしない。

```bash
docker compose exec -T laravel php artisan test
docker compose exec -T laravel php artisan test --filter=DandoriManagementTest
docker compose exec -T laravel php artisan test --filter=SecurityEventTest
docker compose exec -T laravel php artisan test --filter=Trick
```

- `phpunit.xml` はSQLite `:memory:` をforce指定し、`tests/CreatesApplication.php` が既定接続と名前付きmysql接続もSQLiteへ置換する。この二重保護を維持する。pdo_sqliteが必要で、Dockerfileだけから実行環境に導入済みと断定しない。
- `RefreshDatabase` はその分離環境でmigrationを実行する。通常の開発DBへ `migrate:fresh` を実行してテスト準備をしない。追加の名前付き接続・生PDO・外部キュー等を使うテストは別途分離を確認する。
- 旧説明にあった「drop columnで全体テストが止まる」は現在の状況ではない。当該migrationにSQLite分岐があり、現在は旧認証系7件が失敗する。
- 変更PHPはコンテナで `php -l <対象>`。ルート変更は `php artisan route:list --path=<対象>` でmiddlewareも確認する。登録成功は認可動作や署名の保証ではない。

## 専用MySQLで確認すること

- SQLiteではMySQLの行ロック、デッドロック、同時更新、照合順序、実migrationの完全な互換性は検証できない。採番・裁定・公開・同時編集を変更した場合は専用MySQLで確認する。
- 募集のDBテストは `LIMITED_IDEAS_TEST_DATABASE_URL` がある場合だけ有効。コードは127.0.0.1かつDB名 `limited_ideas_test` を要求する。既存DBではなく破棄可能な専用インスタンスと専用資格情報を用意する。
- 募集テスト2ファイルはUser / LimitedIdeaを削除するため、同じ専用DBでは `--test-concurrency=1` で直列実行する。テストURLを付け替えるだけで開発DBを流用しない。
- seed再実行では対象外行・既存編集・論理削除・全列保持と、途中失敗時のrollbackを確認する。

## ブラウザ・実API

- Playwrightは常時許可済み。UI改修はPC / 390px程度のスマートフォン・必要なテーマを確認し、hydration / console例外・入力・横スクロール・表示名・権限別導線を見る。
- 大会の設定は `next/pages/limited/tricks/playwright.config.cjs` が現行入口。`next/tests/limited-tricks/` に旧テストも残るので混同しない。
- `TRICKS_E2E_BASE_URL` は既定localhost:3000、ホストからなら3005等を指定する。`TRICKS_E2E_START_SERVER=1` はサーバー起動を伴うため既存開発プロセスと競合させない。
- `.spec.cjs` の一部はdebug/fixtures APIで実DBへ書く。専用大会・専用環境・署名設定・finallyでのcleanupを確認してから実行する。公開本番へ向けない。
- 観戦の合成API検証は機能ディレクトリで `python3 tests/run-tricks-spectator-smoke.py`、末尾 `extra` / `access`。ラッパーはユーザー環境のPlaywright CLI配置に依存する。
- canvas改修は待機時の描画停止・loop sleep、polling頻度、SPA離脱後canvas / observer / listener / timer / fetch解放を確認する。CSS animation負荷はPhaserのsleepとは別に確認する。
- 投稿実疎通は [専用ユーザー手順](../testing-post-api.md)。NextAuth → multipart → Laravelを確認し、他者操作・期限・未公開・重複送信の拒否も変更範囲に応じて検証する。
- curlの疎通は `--max-time`、Compose execは `-T`。ホスト3005 / コンテナ3000 / 内部Laravel8000を区別する。

## シミュレーター

リポジトリ直下から各ファイルを直接実行する。ファイル名にハイフンがあるためunittest discoverでは検出0件になる。

```bash
python3 next/pages/limited/tricks/tests/tricks-v20-test.py
python3 next/pages/limited/tricks/tests/tricks-personalities-test.py
```

v19 / v20、通常15人 / 第19回再現、途中補充と仮定を区別し、seed・パラメーター・会計不変条件を記録する。シミュレーター成功を本番APIの検証とみなさない。

## 対象別の既存カバレッジと不足

| 対象 | 既存の確認先 | 追加で必要となる観点 |
| --- | --- | --- |
| スコア・総合 | ScoreOrder / TopRecord / UserTotalControllerテスト | ルール間分離、0・同点、公開年と分母 |
| 成績CSV・スタンプ | EventResultCsvSeeder / EventStampService / TrickEventResultService | 対象外保持、再実行、凍結結果との一致 |
| スイス式 | SwissPairing / SwissUndo / SwissTransfer | 画面の順位区画、複数運営者の同時操作 |
| 大会 | `tests/Feature/Tricks`、Node、Playwright、Python | 実MySQLのロック、DB分離、canvas負荷、v19/v20分離 |
| ルール48・認証履歴 | DandoriManagement / SecurityEvent、Node5件 | 月次公開の実経路、英数字導線、権限取消、認証・OTP・reset競合 |
| ルール応募 | Nodeの単体・APIモック、専用MySQL2件 | MySQL未設定のskipを埋め、履歴・同時更新を確認 |
| アリーナ・お宝・キーワード | 専用名の自動テストは今回の一覧で見当たらない | 関連改修時に計算・認可・入力・データ保持の必要な回帰を追加 |

テストを一律増やすのでなく、変更した契約を守る検証を優先する。旧Laravel認証テストの修正だけでは現行NextAuth / OTP / リセットAPIを検証したことにならない。

## 2026-10-15の確認結果と残課題

- Laravel全体：209成功・旧Auth7失敗。6件はUserFactoryの `users.name` 等と業務schemaの不一致、登録1件は `RedirectIfAuthenticated::handle()` の戻り値型とRedirectResponseの不一致。実ユーザーDBへ向けて回避しない。旧認証を保守するか廃止するか、独立タスクで決定する。
- Node：18成功・専用MySQL2スキップ。初回のHTTPテストlisten EPERMは実行権限を揃えて再実行し解消した。
- Python：v20 8件、人格10件成功。誤ったdiscoverでの0件検出は成功扱いにしない。
- 専用MySQLの競合・募集統合、実ログイン / 投稿 / 管理API、Playwright、本番build・本番状態は今回未検証。過去の成功件数で補わない。
- 認証制限・OTP・リセット消費の並行処理、追加migrationのMySQL互換、英数字コードの画面横断は今後の変更時に優先する。現在のテストが全ての経路を保証すると解釈しない。
