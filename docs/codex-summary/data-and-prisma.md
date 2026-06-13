# Data And Prisma

## Prisma 7

- 本番反映コミット付近で Prisma 7 へ移行済み。
- `next/lib/prisma.js` は `@prisma/adapter-mariadb` と generated client を使う構成。
- Prisma 7 では `tsx` で generated client を直接実行したときのモジュール解決エラーが、本番アプリの症状とは別に出ることがある。
- 本番アプリの障害切り分けでは、直接 `tsx` 実行の失敗より、実行中 Next の API と DB migration 状態を優先する。

## Migration

- 本番でサインアップ 500 / ログイン 401 が起きた実例では、主因は Prisma migration 未適用だった。
- `migrate deploy` が成功し、`User` に `emailHash` 等が存在すれば、DB カラム不足は解消見込み。
- `20260103121031_add_email_verify_and_reset`、`20260103132402_fixed_email_otp` などメール認証/OTP系 migration が重要。
- `migrate deploy` 後も失敗する場合は、Next プロセス再起動、環境変数反映、Cookie/NextAuth 設定に切り分ける。
- `User.disablePickupVideoAutoplay` はトップページのピックアップ動画で最初の動画だけ自動再生を止める設定。既定値は `false`。

## ユーザー一覧キャッシュ

- Prisma の `user.findMany` は各ページに分散させず、`next/lib/usersCache.js` へ集約する方針。
- 通常のユーザー一覧は `getCachedUsers()`。
- `role` が必要なページ/APIは `getCachedUsersWithRole()` を使う。
- サーバー側メモリキャッシュは 1時間 TTL。
- 期限切れ時のみ再取得し、同時リクエスト重複を防止する。
- `addName2posts(posts, users)` は投稿ごとに `users.find()` するため、大きい一覧では `posts * users` の探索コストに注意する。必要なら userId Map 化する。

## User / Auth

- `/api/count/{userId}` は `cnt` と `oldest_created_at` を返すが、`oldest_created_at` は登録日ではなく最初の投稿日時。
- 登録日を厳密に見る場合は Next 側 Prisma の `User.date` を使う。
- サインアップ/ログイン不具合では、`DATABASE_URL is not set`、認証失敗、接続タイムアウト、`Unknown column`、adapter系エラーを確認する。

## Totals / Snapshots

- `total_snapshots` は前年比ランクポイント差分計算に使う。
- `totals` が空のユーザーでも API は `score/rps/mark` の初期値を返すべき。フロントは `totals.rps` を数値正規化し、非数なら `0` にフォールバックする。
- `totals` テーブルへ `console` を追加した経緯がある。集計・ダッシュボード改修時は console 条件を確認する。
