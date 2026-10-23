# プロジェクトの確認コマンド

実行場所は、特記しない限りリポジトリ直下。DB変更・停止・本番操作は対象と依頼範囲を確認する。秘密値を含むenv / Docker inspect / ログ全文を出力しない。旧汎用コマンド集は履歴資料として退避した。

## 状態と参照

```bash
git status --short
git diff --stat
rg --files docs -g '!docs/codex-logs/**' -g '!docs/archive/**'
docker compose ps
```

通常は [ドキュメント索引](README.md)から必要な資料だけ読む。Git差分も秘密情報が混入していない対象に限定する。

## ローカル起動

```bash
docker compose up -d
docker compose exec next yarn dev
```

base ComposeのNextは別途dev起動が必要。LaravelはDockerfileのCMDで起動する。既存.envは上書きしない。Next公開はlocalhost:3005、内部は3000。Laravel8000は内部exposeのみ。

## 検証

ホスト `next/` で、専用DB変数を外してNodeテストを実行する。

```bash
cd next
env -u LIMITED_IDEAS_TEST_DATABASE_URL node --import tsx --test --test-concurrency=1 tests/limitedIdeas.test.js tests/legacyLimitedIdeas.test.js tests/pickupVideo.test.js tests/serverFetchJson.test.mjs tests/security-and-dandori.test.cjs
yarn lint
```

LaravelはコンテナのSQLiteインメモリで実行する。

```bash
docker compose exec -T laravel php artisan test
docker compose exec -T laravel php artisan test --filter=DandoriManagementTest
docker compose exec -T laravel php artisan test --filter=SecurityEventTest
```

既知の失敗・MySQL分離・ブラウザ・シミュレーターの条件は [テスト方針](codex-summary/testing-and-verification.md)、実投稿は [専用ユーザー手順](testing-post-api.md)を参照する。通常seedや開発DBへのmigrate:freshをテスト準備に使わない。

## 疎通・ルート

```bash
curl --max-time 5 -sS -o /dev/null -w '%{http_code}\n' http://localhost:3005/
docker compose exec -T laravel php artisan route:list --path=dandori
```

HTTP成功だけでUI表示や認可を保証しない。レスポンスヘッダ全表示はCookieを含み得るため行わない。

## build・配備

```bash
docker compose exec -T next yarn build
```

上記はdev停止済み、依存導入・生成・API到達性を確認した環境でのみ実行する。本番の起動時buildと重ねない。手順全体は [配備と環境](codex-summary/deployment-and-environment.md)。

- 本番overrideは `docker compose -f docker-compose.yml -f docker-compose.prod.yml ...`。
- build / up対象のサービス名は `laravel scheduler next`。`laravel-scheduler` はコンテナ名。
- 設定cache、追加migration、署名設定、停止時間、バックアップと切戻しを先に確認する。
- 稼働コンテナ再作成やDB migrationのコマンドを一括でコピー実行しない。

## バックアップ・統計・ログ

- バックアップ / PITRは [database-recovery.md](database-recovery.md)。既存データを初期化して試さない。
- 統計更新の依頼時だけ `node docs/scripts/update-stats.mjs`。
- transcript書出しは `node docs/scripts/export-codex-log.mjs <JSONLファイル>`。秘密情報と既存ログの上書き範囲を確認する。
