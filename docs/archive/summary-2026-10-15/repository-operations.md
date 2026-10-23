> 2026-10-15 整理前のサマリー。過去時点の記録であり、現行方針には使わない。パス表記はリポジトリ直下基準。現行の入口は [docs/README.md](../../README.md)。

# Repository Operations

## 基本構成

- `next/` は Next.js フロントエンド。React、MUI、styled-components、Prisma client、NextAuth、SWR を含む。
- `laravel/` は Laravel API バックエンド。コントローラ、モデル、ルート、マイグレーション、Seeder、サービスを含む。
- `docker-compose.yml` は `next` / `laravel` / `mysql` / `redis` のローカルサービスを定義する。
- `mysql/` と `redis/` はローカルデータボリューム。`log/mysql/` は DB ダンプやログ用途。
- `wiki/`、`lab/`、`sandbox/` は実験・ドキュメント用途。関連タスクでない限り編集しない。
- `laravel/project.json` はアプリバージョン情報ソース。旧ルート `project.json` と `VERSION` は廃止済みの前提で扱う。

## 開発起動

### ローカルDBの復旧・容量管理（2026-10-13）

- ローカルDBのバックアップはCodex作業中の誤削除からの復旧が目的で、日時別の累積アーカイブは不要。破壊的DB操作の直前にbinlog位置付きフルバックアップを作成・検証し、その後のbinlogを作業検証完了まで保持する。
- ローカルComposeの既定値は日次03:20バックアップ有効・フルバックアップ2日保持。MySQLは `docker/mysql/conf.local/pik5.cnf` でbinlog3日保持。本番overrideは従来の `conf.d/pik5.cnf`（30日）とフルバックアップ14日を維持する。
- バックアップ単体は取得時点へ戻すもの。誤削除直前への復旧には取得後のbinlogも必要。定期バックアップ失敗・長期停止時はDB作業前に新規取得が必須。
- 自動削除は `db:backup` 生成形式の `<database>-YYYYMMDD-HHMMSS.sql.gz` のみに限定する。手動退避・移行JSON・復旧証拠は別途用途確認する。日次取得対象は設定されたアプリDBのみで、共有binlog整理前には必要な別DBも退避する。
- 2026-10-13に全ローカルDBの整合性確認済み退避を `backups/mysql/local-all-20261013-before-binlog-prune.sql.gz` へ保存。`binlog.002240` より前をPURGEし、mysql容量は32.53→約3.31GiB。ローカル稼働MySQLへ3日保持をSET PERSIST済み、schedulerへ新設定反映・バックアップ成功確認済み。本番操作なし。

- 初回は `cp sample.env .env` で Docker 用 `.env` を作成する。
- フルスタック起動は `docker compose up -d`。
- Next は `docker compose exec next bash` 後に `yarn dev`。ホスト公開は通常 `http://localhost:3005`、コンテナ内は `http://localhost:3000`。
- Laravel は `docker compose exec laravel bash` 後に `php artisan serve --host 0.0.0.0`。コンテナ内は `http://localhost:8000`。
- 停止は `docker compose down`。
- Git checkout で置換されるファイルを Docker へ単一ファイル mount しない。ホスト側の inode 置換後にコンテナから参照できなくなることがある。

## バージョンと発番

- 記録の `unique_id` は「バージョン由来3桁 + ランダム6桁」の9桁相当が仕様。
- `RecordController` は `config('version.record_prefix')` を使う。`record_prefix` は `laravel/project.json` の `version` から算出される。
- `laravel/project.json` は既存の `./laravel:/var/www/laravel` ディレクトリ mount 経由で参照し、個別 mount は追加しない。
- `laravel/project.json` が欠落・不正な場合、`record_prefix` は `"300"` へフォールバックし、PHP Warning を API 応答に混入させない。
- 本番や設定キャッシュ利用環境で `laravel/project.json` や `.env` を変えた後は `php artisan config:clear` または `php artisan config:cache`、必要に応じてコンテナ/Nextプロセス再起動を行う。

## Git と既存変更

- 作業ツリーにはユーザー由来の未コミット変更があることが多い。無関係な差分は戻さない。
- 既存未コミット差分を検知したら、今回タスクに必要な変更だけを追加する。
- `[]` を含む Next.js 動的ルートのパスは zsh glob に引っかかる。コマンドでは `'next/pages/total/[...series].js'` のように必ず引用する。
- 大量置換は `[]` を含むファイル名で失敗しやすい。対象ファイルを絞り、ヌル区切りや個別確認を使う。
- IDE設定の `/.idea/` と Prisma 生成物の `/next/generated/` は Git 追跡対象外にする。既に追跡済みの場合は、実ファイルを残したまま `git rm -r --cached .idea next/generated` で index から外す。

## コミット/PR

- 既存履歴は `ver.X.XX <short description>` 形式が多い。
- PR にはユーザーに見える変更点、UI変更のスクリーンショット、DB migration/seeder 実行有無を書く。


## イベントブランチの継続開発とmaster統合（2026-10-15）

ユーザー方針: イベント専用ブランチを削除せず、今後も単独開発を継続する。実ブランチ名はlimited-trick。masterへの統合前に未コミット変更を保存し、通常mergeで履歴を保持する。強制push・rebase・ブランチ削除は不要。完成単位でmasterへ統合し、必要に応じmasterの変更をイベントブランチへ通常mergeする。

統合前確認ではLaravel193件成功、認証7件失敗。同じ7件が隔離masterでも失敗し、旧認証factoryのusers.name列不一致6件とmiddleware戻り値型不一致1件を確認。イベント差分の回帰ではない。Next lint・Node13件（専用MySQL2件スキップ）・シミュレーター18件・隔離Next本番ビルド・canvas表示/loop sleep/破棄確認は成功。共有node_modulesのtsx/esbuildはホストmacOSで実行する。詳細 next/pages/limited/tricks/docs/tricks-master-merge-review-2026-10-15.md。

2026-10-15: 未コミット187ファイルをf4a3db6dへ保存し、masterへcb875bbbで--no-ff統合（競合なし）。マージ後のtreeは検証したlimited-trickと完全一致。統合記録後は両ブランチを同じ基点へ揃え、イベントブランチを保持してそちらへcheckoutする。本番環境は変更しない。
