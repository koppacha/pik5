> 2026-10-15 整理前のサマリー。過去時点の記録であり、現行方針には使わない。パス表記はリポジトリ直下基準。現行の入口は [docs/README.md](../../README.md)。

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
- 本番DBユーザーに`RELOAD`/`FLUSH_TABLES`権限がない場合、`--master-data=2`を使う通常のバックアップは失敗する。移行前の全量退避には`php artisan db:backup --without-binlog-position`を使えるが、binlog位置を記録しないため厳密な時点復旧には使えない。テーブルがすべてInnoDBであることと、圧縮ファイルの整合性を確認する。定期バックアップの権限不足は別途解消する。

## Redis永続化

- Redisの`/data`が実行ユーザーに書き込めないと、RDB保存失敗から`MISCONF`となりLaravel APIも500を返す。ホスト側のRedisデータディレクトリの所有者をコンテナ内Redisユーザーに合わせ、`BGSAVE`後に`rdb_last_bgsave_status:ok`を確認する。既存RDBを削除しない。

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


### 2026-10-09 第19回大会の本番反映

ユーザーの明示承認によりmasterへmergeせずlimited-trickで本番運用。大会261009は10/9 20:00〜10/11 19:59 JST、通常モード、カード160枚（points147/time13）、投稿カテゴリ261009。migration5件とTrickProduction261009Seederを適用。バックアップ取得とgzip検証、rollback付き開始境界・ドロー検証、公開URLの表示/API検証成功。詳細はnext/pages/limited/tricks/docs/tricks-production-deployment-2026-10-09.md。

Next pages配下の検証用スクリプトは.cjsにして誤ルート登録を防ぐ。Laravel大会APIの60回/分枠は通常APIから分離し、署名検証済みユーザー単位、未認証はIP単位で集計。上限は引き上げていない。


### 2026-10-09 無停止反映の調査条件

現在のNextコンテナ停止→ビルド→起動方式は停止を伴う。フロント修正を無停止反映するには別のビルド出力・別ポート起動・Nginxのgraceful切替・旧アセットと接続の保持が必要。現SSHユーザーではsudo -n nginx -tがパスワード要求で失敗し、切替権限は未確保。サーバーは約2GB RAMで調査時available844MiB、前回ビルド約900MiBのため並列ビルドの資源条件を要確認。調査のみで構成変更はしていない。


### 2026-10-09 既存コンテナ維持の無停止反映案

既存nextコンテナ／3000を維持し、別リリース・別.next出力で候補を別内部ポートに起動する方法、または追加コンテナをloopback限定別ホストポートに起動する方法を調査。ホストからnextのbridge IP:3000へHTTP200到達を確認。運用上は候補を個別監視・restartできる追加コンテナ案が扱いやすい。両案とも公開先がNginx→3005へ固定されているため、Nginx設定検証・graceful reloadの権限が必要。旧静的資産とBUILD_ID別data経路の保持が必要。ローカル合成Nextで旧版稼働中に新版をビルド・起動し、旧版100リクエスト失敗0件。これは本番全体の切替完了や本番ビルド検証ではない。調査では本番未変更。詳細はnext/pages/limited/tricks/docs/tricks-live-container-deployment-investigation-2026-10-09.md。


## 2026-10-10 ポーリング修正のローカル準備

SWRのインラインrefreshInterval関数をuseCallback([fieldSorting])に固定する修正をローカルコミットd81ef872へ収録。本番基準f13406b2、push・本番接続／反映なし。Next build成功193.67秒・警告なし、lint成功、開発／next start双方の合成Playwright検証成功（３秒取得、変更反映、終了停止、テイク後再開、離脱破棄、Canvas静止）。手順書next/pages/limited/tricks/docs/tricks-polling-deployment-ready-2026-10-10.md。オンライン人数の確定APIはなく登録人数をアクティブ人数と解釈しない。実施時は運営が０人を確認し、別途ユーザー指示でNextのみ更新。現行方式ではビルド中サイト停止、migration/Seeder不要。本番LimitedIdeas.js既存差分を保持。


## 2026-10-10 ステージ1356の本番ホット修正

ステージ1356（deck287/card174/元401/time）は残り時間が多いほど上位。Func／TrickRecordServiceに投稿ステージ1356だけの降順例外を追加、109件成功、HTTP202/24/21/7順を確認。ローカルコミット4b12a5f0。未承認のフロントコミットd81ef872/0825193eを本番へ送らないためpush/pullはせず、本番PHP2ファイルのみ構文確認・原子的置換で無停止反映。本番HEAD=f13406b2＋Func.php/TrickRecordService.php未コミット差分＋既存LimitedIdeas.js差分。次回デプロイで今回の緊急PHP修正を保持し、対応コミットへGit同期する必要あり。

### 2026-10-10 本番更新・160枚補充完了
- limited-trickをd979c334へ同期（実装602089da、現行本文／難易度保持003e1312）。master mergeなし。本番の旧PHP緊急差分とLimitedIdeas差分を限定stashに保存し、対応修正込みfast-forward。
- Next停止14:48:38 JST、14:53:02 HTTP200確認。補充照合中schedulerを短時間止めて再開、Laravel/MySQL/Redisは継続。全コンテナrunning。
- 限定metadata migrationとTrickReplenish261009Seeder実行成功。元160枚を維持して161〜320追加、デッキ4→164、捨て札32維持。既存プレイヤー・記録・支払い・回収・ログ不変と再実行無変更を同一トランザクション内で照合。
- CSVとの差は本番で修正された本文044/089と難易度070/156。本文・難易度は現行本番をコピーし、CSVへ戻さない。その他のカード対応照合を維持。1356と複製261009-287はDESC。
- 本番ブラウザでトップ・大会・Webマニュアル200、現大会表示、stateポーリング、カテゴリ、バー非表示、新ルール確認。参加者はリロードが必要。詳細はtricks-production-release-2026-10-10.md。

## 2026-10-11 次回反映対象の整理

反映記録と作業ツリー差分から、未反映は管理者ユーザー統計・カード統計、ミニカード複数行配置、261009閉幕後機能。Next再ビルドとLaravel同時反映、新migration/Seeder不要。3ac061beの補充札3桁ID表示は無停止反映済みのため除外。古い準備文書の未反映表記より後日の反映結果を優先する。詳細next/pages/limited/tricks/docs/tricks-pending-release-2026-10-11.md。整理時点で本番操作なし。

### 2026-10-11 閉幕後機能・管理者統計の本番反映完了

明示的なダウンタイム承認後、limited-trickを3ac061beから166780efへfast-forward。管理者統計・ミニカード配置・261009閉幕後機能を反映。Next停止12:56:40〜HTTP200確認12:59:49 JST、約3分10秒。Laravel等は稼働継続、migration/Seederなし。Laravel121件、Next本番ビルド、公開API・カテゴリ・canvas・共通ページ確認成功。回収表示の件数は有効投稿件数で、ゲーム用カウンターを変えない。記録公開・24時間超再編集・コレクタールームは10/11 20:00 JST以降（ホルダーは終了処理完了も必要）。本番HEAD166780ef・差分なし、全サービスrunning。詳細next/pages/limited/tricks/docs/tricks-production-release-2026-10-11.md。


### 2026-10-11 20時台の人気クリエイター指数デプロイ

本番166780efには管理ステータス・ミニカード配置・閉幕後対応が反映済み。残る正規スクリーンネーム照合をac6faba1、検証ドキュメントを33a87108へコミットしlimited-trickを本番fast-forward。Nextのみ停止・リビルド、20:02:48〜20:06:57 JSTに復旧確認（約４分９秒）。旧.nextは本番/tmp/pik5-next-build-before-creator-fix-ac6faba1に保持。Laravel/scheduler/DB再起動なし、migration/Seeder/DB変更なし。HTTP200・未ログイン管理API403・本番15人の集計（正規名10人非ゼロ）・スコア訂正４件保持を確認。

## 2026-10-12 事後修正・第19回大会アーカイブ

limited-trick 64935e37を本番へfast-forward。Nextのみ約３〜４分停止、ビルド179.48秒で成功。全５サービスrunning、Next再起動０回、143回収カードの実表示確認済み。migration/Seederなし。

本番大会261009の全投稿432件・大会ログ2270件・関連12テーブルをGit ignoreのbackups/tricks/261009-final-20261012.jsonへ退避し、開発MySQLの専用DB bowsprit_tricks_261009へ全列照合付きで取り込んだ。既存開発DBはステージID30件が衝突し既存記録も参照するため保持。開発Webは従来DBのまま。証拠画像416件はbackups/tricks/261009-images-20261012.tar.gz（111MB）と261009-evidence/imgに保存。ファイルは0600、転送ハッシュ一致。認証情報は移行しない。詳細next/pages/limited/tricks/docs/tricks-postevent-2026-10-12.md。

### 2026-10-13 イベント初期表示のL5フレームと429

- 本番nginxのlocation /は同一IP2r/s・burst20・nodelay。/limited/tricks/のSVGと通常APIが同じ枠を使い、トップ直後のイベント遷移で/api/usersとL5 filaments-v6.svgの429を再現。/_next/static/・/_next/data/のみ別の50r/s枠。
- L5 SVGはpublic,max-age=0で再検証され、304も制限枠を消費する。画像の失敗はCSS背景なので自動再取得されず、11秒待機でも0回、再読み込みで両画像200に回復した。
- 対策候補は静的アセットの制限枠分離・バージョン付き画像の長期キャッシュ・初期通信量に合わせた読み取りAPIのburst調整。今回の依頼は調査のみで本番変更なし。詳細はnext/pages/limited/tricks/docs/tricks-l5-and-429-investigation-2026-10-13.md。

### 2026-10-13 API制限の横断検査（実効値訂正）

- 本番new／record／tricksの実効middlewareはThrottleRequests:1800,1。HTTP応答のX-RateLimit-Limitも1800。RouteServiceProviderの名前付きapi=60/分・署名ユーザー単位は未接続。過去の60/分が有効との記述は定義と実効値の混同なので本項を優先する。
- Next→Laravelの汎用GETは利用者IPを転送せず、通常のthrottleは署名IDを使わないため、NextAuth利用者のGETがNextのIP枠を共有する構造。Next直結APIはLaravelの枠を通らない。
- 提案は配信種別／業務用途の分離、信頼できるIP・署名主体、名前付きlimiterの実装接続、認証・OTP専用の原子的制限、Retry-After転送とfetcher統一、score_type一括返却／ポーリング削減。閾値は測定して決める。
- 詳細はnext/pages/limited/tricks/docs/api-rate-limit-review-2026-10-13.md。調査・提案のみ、本番未変更。
