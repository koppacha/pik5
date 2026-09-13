# Deployment And Environment

## 本番障害切り分け

- 本番だけサインアップ 500 / ログイン 401 が出る場合、まず DB migration 未適用を疑う。
- Prisma migration 適用後、`/api/user/create` が `200 OK` になれば、サインアップ 500 の原因は DB migration 未適用でほぼ確定。
- ログイン 401 が残る場合は、DB/Prisma ではなく NextAuth 環境変数、Cookie、プロセス再起動へ切り分ける。
- `NODE_ENV=production` は本番起動時に明示設定しておく。
- `.env` や migration 適用後は Next プロセス再起動を行う。

## nginx / Proxy

- 本番 nginx は Next へ `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` を渡す。
- `X-Forwarded-Proto` が無いと Next 側 same-origin 判定が `http` 扱いになり、`/api/server/*` が403になることがある。
- TLS 終端が nginx 側にある場合、Node の `req.socket.encrypted` は通常 `false`。
- Laravel は外部に直接公開せず、Docker 内部ネットワークで Next/nginx 経由にする。

## Docker

- `docker compose ps` でコンテナ起動状態を確認する。
- Laravelイメージは公式 `php:8.2-fpm-bookworm` を使用する。旧BullseyeでDebian Securityの索引と配布ファイルがずれ、`apt-get install` が404になる事象を回避するため2026-09-12に更新した。APTには `Acquire::Retries=5` を設定する。
- ルートの `.dockerignore` で `.env`、秘密鍵、ローカルDB、バックアップ、ログ、`node_modules`、`.next`、`next/prisma/data` などをビルドコンテキストから除外する。Next Dockerfileは `next/` 全体をCOPYするため、この設定を削除しない。
- アプリバージョンは `laravel/project.json` で管理する。Git checkout による inode 置換で単一ファイル bind mount が切れるのを避けるため、ルートの `project.json` を個別 mount しない。
- `next` コンテナが起動していても `yarn dev` が起動していなければ `localhost:3005` は接続拒否になる。
- ホスト公開 `localhost:3005` とコンテナ内 `localhost:3000` を混同しない。
- `next` サービスの `5555:5555` は通常運用では不要。Prisma Studio をホストから使う用途がなければ閉じてよい。
- `docker compose exec -T` と `curl --max-time` を使うと、TTY や長時間待機を避けられる。
- Docker ソケット権限で失敗することがある。権限付き実行が必要な場合は、ユーザー承認を得る。

## Config Cache

- Laravel で `config:cache` を使っている環境では `.env`、`project.json`、config 変更後に `config:clear` または再 `config:cache` が必要。
- `route:list` 実行時の vendor Deprecated は PHP バージョン由来のことがある。

## Database Protection And Recovery

- 本番Laravelでは `docker-compose.prod.yml` が `DB_PROTECT_DESTRUCTIVE_COMMANDS=true` を強制する。`APP_ENV` に依存せず、`db:wipe`、`migrate:fresh`、`migrate:refresh`、`migrate:reset` は `--force` 付きでも拒否される。
- MySQLは `docker/mysql/conf.d/pik5.cnf` でROW形式binlogを30日保持し、`sync_binlog=1` と `innodb_flush_log_at_trx_commit=1` を明示する。
- PITRにはbinlogだけでなく、それ以前のフルバックアップが必要。本番composeは `DB_BACKUP_ENABLED=true` を強制し、専用の `laravel-scheduler` サービスで `schedule:work` を常駐させて `db:backup` を日次実行する。`backups/mysql` は外部・別ホストのストレージへマウントする。
- LaravelのガードはArtisan経由の破壊的コマンドだけを防ぐ。SQLクライアント、Prisma、アプリケーションコードによる削除にはDB権限分離とバックアップ監視が必要。
- 現行composeのアプリDBユーザーは `bowsprit.*` に `ALL PRIVILEGES` を持つ。既存migration運用を壊さず権限を縮小するには、ランタイム用ユーザーとmigration用ユーザーを分離して段階的に切り替える。
- 復旧時は本番DBへ直接binlogを流さず、隔離DBでフルバックアップとbinlogを適用して内容を検証する。詳細は `docs/database-recovery.md` を参照する。

## Build / Runtime

- `c4e3a83b` は Next Dockerfile のベースイメージ変更のみだったが、直前の Prisma/Next 更新が実質リスクになった。
- 本番で `migrate deploy` は成功しても、Next の実行プロセスが古いままだと症状が残ることがある。
- `node_modules` の `esbuild` が別プラットフォーム向けでローカル build が失敗することがある。Next build の結果と切り分ける。
- `next/package.json` の `prebuild` で `prisma generate` を常時実行する。`next/generated/prisma` が Git 追跡対象外でも、`yarn build` / `npm run build` 前に generated client を再生成するため。
- dev 起動では `prebuild` が実行されないため、`yarn dev` の `predev` で `prisma generate` を実行する。ブランチ切り替え後に generated client が欠落・陳腐化していても、開発サーバー起動時に再生成される。生成物の欠落時は `../generated/prisma/client` の module not found で 500 になる。
- webpack cache の `*.pack.gz_` rename に関する ENOENT は、Prisma Client 欠落によるコンパイル失敗時にも出る二次的なキャッシュ警告であり、Prisma の module not found とは切り分ける。

## Release After Pull

- 本番で `git pull` 後は `git status` と `git log --oneline -5` で反映差分を確認する。
- 常に `docker compose build`、`docker compose up -d`、`docker compose exec next yarn install --ignore-engines`、`docker compose exec next yarn build`、`docker compose ps`、`docker compose logs --tail=100 next/laravel` を確認する。
- `next` コンテナは compose 上では常駐のみのため、本番運用中の方法に合わせて `yarn start` または既存プロセス管理で起動・再起動する。
- Laravel migration がある場合は `docker compose exec laravel php artisan migrate --force` を実行する。
- Prisma schema/migration 変更がある場合は `docker compose exec next npx prisma migrate deploy` を実行する。generated client は `next/package.json` の `prebuild` で `prisma generate` が自動実行される。
- DB migration、Seeder、データ修正、Prisma migration を伴う場合は、実行前に DB フルバックアップを取得する。
- `.env`、`project.json`、compose、Dockerfile、nginx 設定、依存関係に変更がある場合は、設定反映、依存再インストール、コンテナ再ビルド、nginx test/reload を確認する。
- 反映後はトップページ、ログイン、投稿、主要ランキングを最低限スモークチェックする。
# Telescope / Artisan

- `laravel/telescope` は `require-dev` のため、本番の `composer install --no-dev` では存在しない。
- `App\Providers\TelescopeServiceProvider` を `config/app.php` へ常時登録すると、本番の Artisan ブート時に `TelescopeApplicationServiceProvider not found` で停止する。
- Telescope は `AppServiceProvider::register()` から、`Laravel\Telescope\TelescopeApplicationServiceProvider` が存在する場合だけ登録する。
- 修正前の設定キャッシュが本番に残って Artisan が起動できない場合は、先に `bootstrap/cache/config.php`、`services.php`、`packages.php` を削除してから `composer install --no-dev --optimize-autoloader` と `php artisan package:discover` を実行する。

## DB バックアップ用 MySQL クライアント

- `db:backup` は Laravel コンテナ内の `mysqldump` または `mariadb-dump` を使用する。
- `laravel/Dockerfile` は `default-mysql-client` を導入済み。`mysqldump or mariadb-dump is not installed` は、通常、本番が Dockerfile 更新前の古い Laravel イメージを使用していることを示す。
- `git pull` だけでは Dockerfile のパッケージは導入されない。本番 Compose で `laravel` と `laravel-scheduler` を build し、`--force-recreate` で再作成する。
- 再構築後は `command -v mysqldump || command -v mariadb-dump`、`php artisan db:backup`、生成された `.sql.gz` の `gzip -t` を確認する。

## Next 本番ビルドと Prisma Seed

- `next/prisma/data/` は既存ユーザー投入用のローカルデータを含むため Git 管理外。
- `next/prisma/seed.ts` はこのローカルデータを静的 import するため、Next の本番ビルド型検査へ含めない。`next/tsconfig.json` の `exclude` に `prisma/seed.ts` を指定する。
- `docker-compose.prod.yml` の Next は `yarn build && exec yarn start` と `restart: unless-stopped` を使用する。ビルド失敗時はコンテナが再起動され、同じエラーがループする。
- ローカルで `next dev` と `next build` を同時実行すると共有 `.next` が競合し、存在するページに対して `PageNotFoundError` が出ることがある。ビルド検証時は dev サーバーを停止する。

## Discord イベント API

- Laravel の `/api/discord/events` は `DISCORD_BOT_TOKEN` と `DISCORD_GUILD_ID` が未設定の場合だけ 503 `Discord events are not available.` を返す。Discord 側の認証・通信失敗は 502。
- Discord 設定は Git 管理外の `laravel/.env` に設定する。再構築後の 503 は、同ファイルの欠落または古い設定キャッシュを優先して確認する。
- 値を変更した後は `php artisan config:clear` を実行し、長時間稼働する `laravel` / `laravel-scheduler` コンテナを再起動する。
- トークン自体をログ、Git 管理ファイル、確認コマンドの出力へ表示しない。設定確認は `filled(config('services.discord.bot_token'))` で行う。
