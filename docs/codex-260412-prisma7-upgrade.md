# Prisma 7 アップグレード引き継ぎメモ

更新日: 2026-04-13

## 目的

IDE 警告の発端は `schema.prisma` の `datasource.url` を将来的に `prisma.config.ts` へ移したい、という要件だった。  
ただし調査の結果、`Prisma 6.18.0` では `schema.prisma` から `datasource.url` を削除すると `prisma validate/generate` が失敗したため、最終的に `Prisma 7` への移行まで実施した。

今回のゴールは以下。

- Prisma を 7 系へ上げる
- `prisma.config.ts` を正式に利用する
- `schema.prisma` から `datasource.url` を削除する
- Next.js アプリ全体が `lint` / `tsc` / `build` を通ることを確認する

## 前提調査でわかったこと

### Prisma 6.18 の時点

- `prisma.config.ts` 自体は導入可能
- ただし `schema.prisma` から `datasource.url` を削除すると `P1012` で失敗
- そのため、6.18 では IDE 警告どおりの完全移行は不可

### Prisma 7 の要件

- Node `20.19.0+` 必須
- TypeScript `5.4+` 必須
- Prisma Client は `generator client { provider = "prisma-client" }` へ移行
- MySQL/MariaDB 接続では driver adapter が必要
- 今回は `@prisma/adapter-mariadb` を採用

### Next.js 側の方針

- Next.js は `14.2.24`
- TypeScript は `5.4.5`
- Prisma 7 のために package 全体へ `"type": "module"` を入れる案は試したが、アプリ互換性を崩したため採用していない
- Node 直実行が必要なものだけ ESM/TS 化している

## 実施したアップグレード

### 依存関係

[next/package.json](/Users/main/IdeaProjects/pik5/next/package.json)

- `prisma: 7.7.0`
- `@prisma/client: 7.7.0`
- `@prisma/adapter-mariadb: 7.7.0`
- `tsx: 4.21.0`
- `typescript: 5.4.5`
- `next: 14.2.24`
- `eslint-config-next: 14.2.24`
- `eslint: 8.57.1`

補足:

- `@mui/icons-material` は一度 `5.15.15` だったが、`@mui/material 5.14.3` とずれて dev ビルドで `import.meta` エラーを起こした
- 最終的に `@mui/icons-material` を `5.14.3` に下げて MUI を揃えた

### Node バージョン

- ローカルの元の Node は `20.18.3` で Prisma 7 の preinstall に失敗
- `brew install node@20` で `20.20.2` を導入
- 検証コマンドは `/opt/homebrew/opt/node@20/bin` を `PATH` の先頭に追加して実行した

重要:

- Prisma 7 検証は `Node 20.20.2` で通している
- 本番、CI、Docker 内でも `Node 20.19+` が必要

## 実際に変更した主要ファイル

### Prisma 設定

[next/prisma/schema.prisma](/Users/main/IdeaProjects/pik5/next/prisma/schema.prisma)

- `generator client` を Prisma 7 方式へ変更
- 現在は以下の構成

```prisma
generator client {
  provider               = "prisma-client"
  output                 = "../generated/prisma"
  engineType             = "client"
  generatedFileExtension = "ts"
  importFileExtension    = "ts"
}

datasource db {
  provider = "mysql"
}
```

[next/prisma.config.ts](/Users/main/IdeaProjects/pik5/next/prisma.config.ts)

- `schema: "prisma/schema.prisma"`
- `datasource.url = env("DATABASE_URL")`
- `migrations.seed = "tsx prisma/seed.ts"`

### Prisma Client 初期化

[next/lib/prisma.js](/Users/main/IdeaProjects/pik5/next/lib/prisma.js)

- `@prisma/client` 直 import を廃止
- generated client を参照
- `PrismaMariaDb` adapter 経由で初期化

概略:

```js
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../generated/prisma/client'
```

### seed

- [next/prisma/seed.js](/Users/main/IdeaProjects/pik5/next/prisma/seed.js) を削除
- [next/prisma/seed.ts](/Users/main/IdeaProjects/pik5/next/prisma/seed.ts) を追加
- generated client + adapter を使う実装へ変更

### Next.js 設定

- [next/next.config.js](/Users/main/IdeaProjects/pik5/next/next.config.js) を削除
- [next/next.config.mjs](/Users/main/IdeaProjects/pik5/next/next.config.mjs) を追加

### TypeScript 設定

[next/tsconfig.json](/Users/main/IdeaProjects/pik5/next/tsconfig.json)

- `target: "ES2022"`
- `module: "ESNext"`
- `moduleResolution: "bundler"`

補足:

- `ES2023` は Next 14 の `next lint/build` 側で受け付けず失敗したため `ES2022` へ調整

### その他の関連修正

[next/pages/api/server/post.js](/Users/main/IdeaProjects/pik5/next/pages/api/server/post.js)

- `require("formidable")` を `import formidable from "formidable"` に変更

[next/lib/discordCastom.ts](/Users/main/IdeaProjects/pik5/next/lib/discordCastom.ts)

- `next-auth/providers` からの型 import を `next-auth/providers/oauth` に変更
- `profile` の型注釈を追加

## Prisma 7 で起きた問題と対処

### 1. Node 20.18.3 では Prisma 7 が入らない

症状:

- `yarn add prisma@7 @prisma/client@7 ...` で preinstall 失敗
- メッセージは `Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+`

対処:

- `brew` で `node@20.20.2` を入れた

### 2. `package.json` に `"type": "module"` を入れるとアプリ側が壊れる

試したこと:

- package 全体を ESM 化

起きたこと:

- `styled-components` 周辺の server build で `g is not a function`、`M is not a function` などの実行時例外

結論:

- package 全体の `"type": "module"` は不採用
- `next.config.mjs`、`prisma.config.ts`、`seed.ts` のような Node 直実行ファイルのみ ESM/TS 化

### 3. Prisma 7 の MariaDB adapter がクライアントバンドルへ漏れる

症状:

- `build` 時に `mariadb` 由来で `fs` / `tls` / `net` が見つからない

原因:

- `lib/usersCache.js` が `lib/prisma.js` を import
- それを複数のページがモジュール先頭で import
- server-side 専用のつもりでも、ページモジュールの import により client bundle 側まで引き込まれた

対処:

- `usersCache` を使うページは、モジュール先頭 import をやめた
- `getServerSideProps` / `getStaticProps` の中で `await import("../../lib/usersCache")` する方式へ変更

対象ページ:

- `next/pages/index.js`
- `next/pages/admin.js`
- `next/pages/battle/index.js`
- `next/pages/auth/login.js`
- `next/pages/auth/register.js`
- `next/pages/auth/discord.js`
- `next/pages/keyword/*`
- `next/pages/limited/*`
- `next/pages/compare/[...compare].js`
- `next/pages/total/[...series].js`
- `next/pages/stage/[...stage].js`
- `next/pages/user/[...name].js`
- `next/pages/record/[record].js`
- `next/pages/speedrun/[...run].js`

### 4. `yarn dev` で `import.meta` エラー

ユーザー報告:

```txt
./node_modules/@mui/icons-material/node_modules/@babel/runtime/helpers/interopRequireDefault.js
Module parse failed: Cannot use 'import.meta' outside a module
```

原因調査結果:

- `@mui/material` が `5.14.3`
- `@mui/icons-material` が `5.15.15`
- `@mui/icons-material` だけが `@babel/runtime@7.24.4` をネストで保持

対処:

- `@mui/icons-material` を `5.14.3` に揃えた
- `yarn install --ignore-engines` 後、`@mui/icons-material/node_modules/@babel/runtime` は消滅
- `@babel/runtime` は hoist された `7.22.6` に統一

### 5. Docker の Node 18 により Prisma 7 が再び失敗する

症状:

- `next` コンテナ内で `yarn install --ignore-engines` 実行時に `prisma` の `preinstall` が失敗
- エラー発生箇所は `/var/www/next/node_modules/prisma`

原因:

- [next/Dockerfile](/Users/main/IdeaProjects/pik5/next/Dockerfile) が `node:18.17.0-alpine` のままだった
- Prisma 7 は `Node 20.19+` 必須

対処:

- `next/Dockerfile` を `node:20.20.2-alpine` へ更新
- `docker compose build next` とコンテナ再作成後、`next` コンテナ内の `node -v` は `v20.20.2` を確認

### 6. Prisma 7 + MariaDB adapter でトップページ表示時に pool timeout

症状:

- `yarn dev` 後、`pages/index.js` の `getCachedUsers()` 実行時に以下で失敗

```txt
DriverAdapterError: pool timeout: failed to retrieve a connection from pool after 10002ms
```

原因:

- `@prisma/adapter-mariadb` に `process.env.DATABASE_URL` をそのまま渡していた
- 既存の `DATABASE_URL` は `mysql://root:root@mysql:3306/poc?schema=public`
- MariaDB ドライバ側では `mariadb://` が前提で、さらに MySQL 8 の `root` 認証では `allowPublicKeyRetrieval=true` が必要だった

対処:

- [next/lib/prismaConnection.js](/Users/main/IdeaProjects/pik5/next/lib/prismaConnection.js) を追加
- `mysql://` を `mariadb://` に変換
- `schema` クエリを除去
- `allowPublicKeyRetrieval=true` を補完
- [next/lib/prisma.js](/Users/main/IdeaProjects/pik5/next/lib/prisma.js) と [next/prisma/seed.ts](/Users/main/IdeaProjects/pik5/next/prisma/seed.ts) から共通利用するよう変更

確認結果:

- `next` コンテナ内で MariaDB への直接接続は成功
- `yarn dev` 起動後に `/` へアクセスして `200 OK` を確認

### 7. 記録投稿 API `/api/server/post` が 502 proxy error

症状:

- 記録投稿 API `/api/server/post` を叩くと `502 {"error":true,"message":"proxy error"}` が返る

原因:

- [next/pages/api/server/post.js](/Users/main/IdeaProjects/pik5/next/pages/api/server/post.js) の `parseForm()` が `new formidable.IncomingForm()` を使っていた
- `formidable@3.5.3` ではこの形が崩れ、実際の例外は以下だった

```txt
TypeError: formidable__WEBPACK_IMPORTED_MODULE_2__.default.IncomingForm is not a constructor
```

- 例外は `Log` テーブルの `postProxyError` に記録されていた

対処:

- `parseForm()` を `const form = formidable({})` へ変更

確認結果:

- 認証済みで `/api/server/post` を再現送信し、修正前は `502`、修正後は `200 ["OK",200]` を確認

## 途中で確認した検証コマンド

Node 20.20.2 を使って以下を実行し、最終的にすべて成功している。

```bash
PATH=/opt/homebrew/opt/node@20/bin:$PATH npx prisma validate
PATH=/opt/homebrew/opt/node@20/bin:$PATH npx prisma generate
PATH=/opt/homebrew/opt/node@20/bin:$PATH npx tsc --noEmit
PATH=/opt/homebrew/opt/node@20/bin:$PATH yarn lint
PATH=/opt/homebrew/opt/node@20/bin:$PATH yarn build
```

最終結果:

- `prisma validate`: 成功
- `prisma generate`: 成功
- `tsc --noEmit`: 成功
- `yarn lint`: 成功
- `yarn build`: 成功

## 現在のワークツリー状況

このセッション終了時点で、Prisma 7 関連の変更はまだコミットしていない。主な変更対象は以下。

- `next/package.json`
- `next/yarn.lock`
- `next/prisma/schema.prisma`
- `next/prisma.config.ts`
- `next/lib/prisma.js`
- `next/prisma/seed.ts`
- `next/next.config.mjs`
- `next/tsconfig.json`
- `next/pages/...` の `usersCache` 動的 import 化
- `next/generated/` の追加

また、Prisma 7 以外のこのセッション中の変更もワークツリーに混在している。

- `next/lib/userContext.js`
- `next/pages/auth/config.js`
- そのほか名前表示や通知調整関連

次セッションでは、コミット前に `git diff` で Prisma 7 関連とそれ以外を切り分けて確認した方がよい。

## 残課題

### 1. Docker/コンテナ側の Node バージョン確認

ローカル検証は Homebrew の `node@20.20.2` を PATH 優先して通している。  
一方、Docker コンテナ内の Node が `20.19+` 未満なら Prisma 7 で再び失敗する可能性がある。

確認対象:

- `next` コンテナの Node バージョン
- CI の Node バージョン
- 本番ビルド環境の Node バージョン

### 2. `next/generated/` を VCS 管理するか決定

現状は `prisma generate` によって [next/generated](/Users/main/IdeaProjects/pik5/next/generated) が作成されている。  
運用上は以下のどちらかを決める必要がある。

- 生成物を commit する
- 生成物は commit せず、install/build 時に必ず `prisma generate` を実行する

現時点では方針未確定。

### 3. seed 実行の実環境確認

- `prisma validate` と `generate` は確認済み
- `prisma db seed` 自体は未実行
- DB 接続可能な環境で `tsx prisma/seed.ts` が問題なく動くかは別途確認が必要

### 4. 本番/コンテナでの `yarn dev` 再確認

`@mui/icons-material` の版ずれは修正済みだが、ユーザーの報告は Docker 再作成後の `yarn dev` だった。  
次セッションではコンテナ内で以下を再確認するのが安全。

```bash
yarn install --ignore-engines
yarn lint
yarn build
yarn dev
```

### 5. 本番ビルド時の Prisma generate 実行順

- Prisma 7 では generated client を [next/generated/prisma](/Users/main/IdeaProjects/pik5/next/generated/prisma) に出力する構成へ変わっている
- そのため、本番ビルド時に generated client が無いと `../generated/prisma/client` の import で失敗する
- `next/generated` を commit しない運用にする場合は、install/build の途中で必ず `prisma generate` を実行する必要がある

## 本番ビルド時にやるべきこと

### 前提確認

1. Node が `20.19.0+` であることを確認する
2. `DATABASE_URL` が設定されていることを確認する
3. `DATABASE_URL` は Prisma 用に `mysql://...` のままでよいが、アプリ実行時には `next/lib/prismaConnection.js` で MariaDB adapter 向けに変換される前提であることを把握する

### 推奨手順

```bash
yarn install --ignore-engines
npx prisma generate
yarn lint
yarn build
```

補足:

- `next/generated` を commit しない場合、`npx prisma generate` は必須
- `prisma.config.ts` を使うため、ビルド環境でも `prisma/schema.prisma` と `prisma.config.ts` が揃っている必要がある
- seed が必要な環境では、別途 `prisma db seed` または `tsx prisma/seed.ts` の実行可否を確認する

### 本番リリース前の確認項目

- `next` 実行環境の Node バージョン
- `prisma generate` 実行有無
- `yarn build` 成功
- 起動後のトップページ表示確認
- 記録投稿 API `/api/server/post` の疎通確認

## 次セッションでまずやるべきこと

1. `next` コンテナ内の `node -v` を確認する
2. コンテナ内で `yarn install --ignore-engines` をやり直す
3. コンテナ内で `yarn dev` を起動して `import.meta` エラーが消えたか確認する
4. 必要なら `next/generated` の運用方針を決める
5. 問題なければ Prisma 7 関連差分を整理して commit する
