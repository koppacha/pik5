# Testing And Verification

## Frontend

- フロントの基本チェックは `next/` で `yarn lint`。
- 必要に応じて `yarn build`。
- `next lint` が通っても、モバイル表示や Hydration mismatch は別途ブラウザ確認が必要。
- 動的ルートファイルはシェルで必ず引用する。

## Backend

- 変更した PHP ファイルは `php -l path/to/file.php` で構文確認する。
- Laravel API ルートは `php artisan route:list --path=...` で確認する。
- Laravel テストは `laravel/tests/` にあり、コンテナ内で `php artisan test` または `vendor/bin/phpunit`。
- DB 関連テストは idempotent にし、既存ローカルボリュームへ依存しない。
- seed 依存テストでは `php artisan migrate:fresh` と対象 Seeder でリセットする。

## 投稿 API 再現

- `/api/server/post` は NextAuth cookie を取得して multipart POST する。
- 実行場所はホストではなく `next` コンテナ内に揃える。
- 専用テストユーザー `codex_post_api_test` でログインする。実在ユーザーの認証情報は使わない。
- パスワードは Git に記録せず、`PIK5_POST_TEST_PASSWORD` 環境変数で指定する。
- 専用テストユーザーが未投入の場合は、`next` コンテナ内で `PIK5_POST_TEST_PASSWORD='<ローカル専用の任意パスワード>' npx prisma db seed` を実行する。
- `stage_id` は `399` を使う。
- 正常系は `postStatus 200` と `["OK",200]`。
- テスト投稿は DB に残るため、必要なら削除する。

## API 疎通

- `localhost:3005` で接続拒否なら、Next 開発サーバーが動いていない可能性がある。
- コンテナ内確認は `docker compose exec -T next curl --max-time 5 http://localhost:3000/...`。
- Laravel コンテナ内確認は `docker compose exec -T laravel curl --max-time 5 http://localhost:8000/api/...`。
- 長時間待機しないよう `--max-time` を必ず付ける。
- ユーザーが短時間タイムアウトと中止条件を指定した場合は、それに従って追加試行しない。

## Browser / Mobile

- モバイル応答チェックは HTTP ステータスだけでは不十分。可能なら実ブラウザで viewport 幅、横スクロール、テキスト折り返し、Hydration warning を見る。
- 横スクロール UI は `overflowX: auto` と `minWidth` で成立しているか確認する。
- MUI Grid のカラム比率は、モバイル `xs` と desktop `md/lg` で合計が崩れないか確認する。

## 本番確認

- Prisma migration 後は、`_prisma_migrations` と対象カラムの存在を確認する。
- NextAuth 401 は、画面文言よりログを優先して確認する。
- `/api/server/*` 403 は `Origin` / `Referer` / `Host` / `X-Forwarded-Proto` / `Sec-Fetch-Site` を見る。
- 本番 nginx 設定変更後は `nginx reload` とコンテナ/プロセス再起動が必要。
