# Repository Operations

## 基本構成

- `next/` は Next.js フロントエンド。React、MUI、styled-components、Prisma client、NextAuth、SWR を含む。
- `laravel/` は Laravel API バックエンド。コントローラ、モデル、ルート、マイグレーション、Seeder、サービスを含む。
- `docker-compose.yml` は `next` / `laravel` / `mysql` / `redis` のローカルサービスを定義する。
- `mysql/` と `redis/` はローカルデータボリューム。`log/mysql/` は DB ダンプやログ用途。
- `wiki/`、`lab/`、`sandbox/` は実験・ドキュメント用途。関連タスクでない限り編集しない。
- `laravel/project.json` はアプリバージョン情報ソース。旧ルート `project.json` と `VERSION` は廃止済みの前提で扱う。

## 開発起動

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
