# DBとPrisma

- Prisma 7は `next/prisma.config.ts`、`next/prisma/schema.prisma`、`next/lib/prisma.js` / `prismaConnection.js` が接続・生成の入口。MariaDB adapterと `next/generated/prisma` のclientを使う。
- 実際の依存バージョンは `next/package.json` とlockfileを確認する。過去の移行メモの固定バージョンを再導入しない。生成物は追跡せず `predev` / `prebuild` で再生成する。
- Prisma側の `User`、募集 `LimitedIdea` と、Laravel側の `users`、記録・大会データは別責務。同一DB・同一主キー・同じ名前を仮定しない。正規スクリーンネームはPrismaの `User.name`。
- migrationはPrismaとLaravel双方にある。片方の適用で他方も完了したと扱わない。本番ではバックアップ後に必要なmigrationを追加適用し、reset / db pushを代用しない。
- `User` のメール認証・OTP・リセット用カラム不足は登録500やログイン401の原因となる。migration履歴、対象カラム、生成client、実行プロセスの反映を切り分ける。
- ユーザー一覧は `next/lib/usersCache.js` の `getCachedUsers()` / `getCachedUsersWithRole()`。TTL1時間・同時取得共有。権限確定にはこのキャッシュや古いJWTを使わず現行Userを照会する。
- `User.date` は登録日時、業務APIの `oldest_created_at` は初投稿日。`disablePickupVideoAutoplay` は最初のピックアップ動画だけを自動再生しない設定。
- `totals` は最新集計、`total_snapshots` は前年比等の時点値。console条件を保持し、未集計ユーザーの値は0として扱う。
- `next/prisma/seed.ts` はGit管理外の実ユーザー資料を静的importする。専用テストユーザーの作成目的に実行しない。`tsconfig.json` のbuild対象除外も保持する。
