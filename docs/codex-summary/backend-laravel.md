# Backend Laravel

## API 構成

- Laravel API ルートは `laravel/routes/api.php` に追加する。
- 新規 API は既存の `api` / `cors` middleware グループに合わせる。
- Next からは基本的に `http://laravel:8000/api/...` を使う。ホスト公開 URL とコンテナ内 URLを混同しない。
- `php artisan route:list --path=...` で登録確認できる。

## コントローラ方針

- `RecordController` は記録投稿・編集・ユニークID発番の中心。
- 新規投稿時は `createUniqueId()` で `unique_id` を発番する。
- 編集投稿時は既存 `unique_id` を引き継ぐ仕様。6桁/9桁問題を見たら、まず `mode=create` か `mode=edit` か確認する。
- `NewRecordController` は `/api/new` の実体。期間限定ステージ `stage_id >= 1000` は通知対象や通常新着から除外する方針がある。
- `UserTotalController` はユーザー総合、ダッシュボード、`dashboard-summary` 系の中心。
- ダッシュボードの「総合ランキング / ライバルリスト」が使う `/api/user/rank/{id}` は、集計済みキャッシュテーブル `totals` を参照する。全ユーザー分を維持するため、スケジューラで `user:fetch-totals --latest` を日次実行する。引数なしの `user:fetch-totals` は月次スナップショット作成であり、最新 `totals` は更新しない。
- `BattleController` / `battles` はダンドリバトル大会やレート系で使う。全件取得して `unique('user_id')` する実装は件数増加時にボトルネックになりやすい。
- `/api/count/{userId}` はユーザーの総投稿数、初投稿日、最終投稿日、キーワード編集回数、イベントスタンプ数をオブジェクトで返す。
- イベントスタンプ計算は `EventStampService` に集約し、イベント総合 API とユーザー統計 API で共用する。
- イベント総合 API の `last_updated_at` は投稿更新日時ではなく、集計対象に含まれる最終イベント開催日を返す。

## Seeder / Migration

- CSV Seeder は既存の `SplFileObject` ベースに合わせる。
- CSV の空文字は `null` に正規化し、数値列は `(int)` 化して DB 型と揃える。
- `EventResultCsvSeeder` は `event_results` を `truncate()` して投入する方針。
- `records.csv` には `difficulty` 列がない。`RecordCsvSeeder` は既存マイグレーションと同じく、`console=3` を difficulty 3、それ以外を difficulty 2 として補完する。補完しないとステージ別 API の `difficulty > 0` 条件ですべて除外される。
- `DatabaseSeeder` に追加するか単独実行にするかは運用に合わせて決める。
- DB リセットは Laravel Seeder を優先する。MySQL の直接 truncate は必要時のみ MySQL コンテナ内で実行する。

## 設定/環境

- `config/version.php` は `/var/www/project.json` を JSON として読み、`version` から `record_prefix` を算出する。
- `project.json` が壊れていても落とさず安全にフォールバックする。
- 設定キャッシュ利用環境では `.env` や設定ファイル変更後に `config:clear` / `config:cache` が必要。
- PHP 8.5 などでは Laravel/vendor 由来 Deprecated が大量に出ることがある。今回変更の成否とは切り分ける。

## Laravel 公開範囲

- 本番では Laravel を外部公開せず、Docker 内部ネットワーク公開に寄せる。
- `docker-compose.yml` では Laravel を `ports` ではなく `expose: "8000"` にする方針がある。
- nginx は Next へ `Host`、`X-Real-IP`、`X-Forwarded-For`、`X-Forwarded-Proto` を渡す。
