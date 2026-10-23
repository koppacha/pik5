# 記録投稿APIの実経路確認

通常のNode / Laravel分離テストだけではNextAuth・Prisma認証DB・Laravel業務DB間の接続は保証されない。投稿経路を変更した際は、必要に応じて以下で確認する。**実DBへ投稿する手順**なので、専用環境を優先し、既存環境で行う場合は対象・影響・後始末を明確にする。

## 前提と専用ユーザー

- Next / Laravel / MySQLの稼働、依存導入、必要な両側migration、Prisma生成client、内部署名設定を確認する。Nextはホスト3005、以下の実行はnextコンテナ内3000を使う。
- 専用ユーザーは `codex_post_api_test`。パスワードはGit管理外の `PIK5_POST_TEST_PASSWORD` から渡す。既存の実在ユーザーを検索・復号して使わない。
- **`npx prisma db seed` は実行しない。** 現行 `prisma/seed.ts` は `prisma/data/data` の実ユーザー資料もimport・投入する。専用パスワード環境変数を設定しても、この処理は省略されない。
- 新規作成時は専用Userだけを扱う。既存アカウントがある場合は所有・用途を確認し、パスワードや権限を勝手に更新しない。
- 専用Userだけを作る例を以下に示す。コンテナ内で環境変数を非表示入力等で用意し、`next/` をカレントディレクトリにする。Prisma接続はアプリと同じ設定を利用し、値は表示しない。これは静的照合した例で、今回の文書整理では実行していない。

```bash
node --experimental-strip-types --input-type=module <<'JS'
import 'dotenv/config'
import bcrypt from 'bcrypt'
import {PrismaMariaDb} from '@prisma/adapter-mariadb'
import {PrismaClient} from './generated/prisma/client.ts'
import {getMariaDbConnectionString} from './lib/prismaConnection.js'
const password = process.env.PIK5_POST_TEST_PASSWORD
if (!password) throw new Error('Dedicated test password is required')
let db
try {
    db = new PrismaClient({adapter: new PrismaMariaDb(getMariaDbConnectionString())})
    const userId = 'codex_post_api_test'
    if (await db.user.findUnique({where: {userId}, select: {id: true}})) {
        throw new Error('Dedicated test user already exists; confirm ownership separately')
    }
    await db.user.create({data: {
        userId, name: 'Codex Post API Test', role: '',
        password: await bcrypt.hash(password, 10),
    }})
    console.log('Dedicated test user created')
} catch {
    console.error('Dedicated test user creation failed; no credentials printed')
    process.exitCode = 1
} finally {
    await db?.$disconnect()
}
JS
```

## ログインから投稿まで

コンテナ内で次を実行する。Cookie / CSRF / パスワードはプロセス内でのみ使用し、値・生レスポンスは表示しない。stage399にrule1・score123のテスト投稿を作るため、対象がテストに使えることを事前確認する。

```bash
node <<'JS'
const {randomUUID} = require('node:crypto')
async function main() {
    const base = 'http://localhost:3000'
    const password = process.env.PIK5_POST_TEST_PASSWORD
    if (!password) throw new Error('Dedicated test password is required')
    const cookies = new Map()
    const remember = response => {
        for (const value of response.headers.getSetCookie()) {
            const pair = value.split(';')[0]
            cookies.set(pair.slice(0, pair.indexOf('=')), pair)
        }
    }
    const cookieHeader = () => [...cookies.values()].join('; ')
    const csrf = await fetch(`${base}/api/auth/csrf`)
    remember(csrf)
    if (!csrf.ok) throw new Error('CSRF request failed')
    const {csrfToken} = await csrf.json()
    const login = await fetch(`${base}/api/auth/callback/credentials`, {
        method: 'POST', redirect: 'manual',
        headers: {'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader()},
        body: new URLSearchParams({csrfToken, userId: 'codex_post_api_test', password, callbackUrl: base, json: 'true'}),
    })
    remember(login)
    const sessionResponse = await fetch(`${base}/api/auth/session`, {headers: {cookie: cookieHeader()}})
    const session = await sessionResponse.json()
    if (session.user?.userId !== 'codex_post_api_test') throw new Error('Dedicated login failed')
    const marker = `codex api post test ${randomUUID()}`
    const form = new FormData()
    for (const [key, value] of Object.entries({
        stage_id: '399', rule: '1', region: '1', score: '123', console: '1', difficulty: '0',
        video_url: '', post_comment: marker, user_agent: 'codex', mode: 'create',
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })) form.append(key, value)
    const post = await fetch(`${base}/api/server/post`, {
        method: 'POST', headers: {cookie: cookieHeader(), origin: base, referer: `${base}/`}, body: form,
    })
    const body = await post.json().catch(() => null)
    const matched = Array.isArray(body) && body[0] === 'OK' && body[1] === 200
    console.log('testMarker', marker)
    console.log('postStatus', post.status)
    console.log('expectedResponse', matched)
    if (!post.ok || !matched) process.exitCode = 1
}
main().catch(() => {
    console.error('Dedicated post API verification failed; no credentials printed')
    process.exitCode = 1
})
JS
```

## 判定と後始末

- 正常系はHTTP200と `['OK',200]` の一致。HTTP200だけで成功と扱わない。
- 401はセッション / 認証DB / 制限API、403はsame-origin / 権限 / 署名、502は専用proxy / Prisma接続 / Laravel文脈取得を分けて調べる。
- 作成データはテスト専用user_id・stage399・出力markerを組み合わせて限定する。既存の同ユーザー投稿を一括削除しない。関連履歴・集計・画像の有無も確認し、既存の削除APIか対象限定cleanupを使う。
- 今回だけ作成した専用ユーザーは投稿と関連履歴の整理後に削除する。既存の専用ユーザーは保持する。認証履歴はLaravel側接続にもあるので別途対象を限定する。
- ルール48のブラウザ補助 `tests/dandori-browser-session.cjs` は管理者User作成・固定ポート・cleanupを伴う別用途であり、この投稿テストの汎用runnerではない。
