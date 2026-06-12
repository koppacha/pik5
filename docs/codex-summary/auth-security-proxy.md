# Auth Security Proxy

## Next API Proxy

- `next/pages/api/server/[...query].js` は Laravel API への汎用 proxy。
- `next/pages/api/server/post.js` は記録投稿用の専用 proxy。
- 共通アクセス制御は `next/lib/serverApiAccess.js` に集約する。
- `/api/server/*` は `ensureServerApiAccess()` で保護する。

## Same-Origin / Token

- `serverApiAccess.js` は `Origin`、`Referer`、`Sec-Fetch-Site`、`Sec-Fetch-Mode`、`Host`、`X-Forwarded-Host`、`X-Forwarded-Proto` を使って same-origin / same-site を判定する。
- 初回アクセス時に同一オリジンと判断できれば、短命アクセストークンを Cookie で発行する。
- アクセストークン Cookie は `HttpOnly`、`SameSite=Strict`、短期 TTL が前提。
- 本番プロキシで `X-Forwarded-Proto` が欠けると、TLS 終端後の Next 側では `http` 扱いになり、403 になることがある。
- 対策として `Origin` / `Referer` から protocol を推定し、`Sec-Fetch-Site` が `same-origin` / `same-site` かつ host 一致なら許可する緩和が入っている。
- Cross-site は引き続き拒否する。

## Proxy 入力検証

- proxy のパスセグメントでは `..`、`/`、`?`、`#` を拒否する。
- Laravel からのステータスコードは可能な限り伝播する。
- proxy でログに残す情報は最小化する。生ヘッダやレスポンス本文を広く記録しない。
- `GET` の初回アクセスで token cookie が無い場合、`Origin` または `Referer` の一致が重要。

## 投稿 API の保護

- `/api/server/post` は NextAuth セッションと `ensureServerApiAccess()` で保護する。
- ただしブラウザ側 yup は回避可能。投稿拒否に関わる重要バリデーションは Next API 側にも入れる。
- Laravel まで同じ検証を入れる必要が薄いケースでも、少なくとも Next API proxy でサーバー側検証する。
- 投稿APIの再現手順には実在ユーザーの認証情報を使わない。専用テストユーザーと環境変数のパスワードを使い、平文パスワードを AGENTS や Git 管理ファイルに載せない。

## IP / Host 記録

- `user_ip` / `user_host` をクライアントボディから信用して保存しない。
- Laravel 側では `Request::ip()` を使う。
- Next -> Laravel の内部通信で `X-Forwarded-For` と必要に応じて `X-Real-IP` を転送する。
- Laravel の `TrustProxies` は本番 proxy 構成に合わせて設定する。ログ上は `protected $proxies = '*'` に変更した経緯がある。
- 本番 nginx では `proxy_set_header Host`、`X-Real-IP`、`X-Forwarded-For`、`X-Forwarded-Proto` を設定する。

## NextAuth / Prisma 障害切り分け

- NextAuth credentials の `authorize` が例外を握りつぶして `null` を返すと、DB接続・bcrypt・Prisma例外でも画面上は「ID/パスワード不一致」になる。
- bcryptは入力の先頭72バイトだけを照合対象にする。多バイト文字や72文字超を許可すると異なる入力が同一パスワードとして照合されうるため、新規登録・パスワード変更・パスワードリセットでは、安全な半角英数記号8文字以上72文字以下に制限する。
- 本番ログイン 401 とサインアップ 500 が同時に起きる場合は、Prisma疎通、DB migration、環境変数、Next プロセス再起動を優先的に確認する。
- 一時的に `authorize` の catch へ `logger.error('credentials authorize failed', e)` を入れると、401 の背後の例外を取れる。
- Prisma migration 未適用の場合、`emailHash` などのカラム不足でサインアップ/ログインが失敗する。
- 本番では `npx prisma migrate deploy` の成功、`_prisma_migrations`、`User` テーブルのカラム、`NODE_ENV=production`、Next プロセス再起動を確認する。

## Laravel 標準認証の扱い

- 現行の主認証は NextAuth / Prisma。画面の登録、ログイン、パスワードリセットは Next.js API を使用する。
- `laravel/routes/auth.php`、`app/Http/Controllers/Auth/*`、`next/hooks/auth.js` は現行画面から参照されない旧 Laravel Breeze / Sanctum 系経路。
- Laravel 標準認証ルートは nginx から直接外部公開されず、Laravel コンテナも `ports` ではなく `expose` のみ。ただし内部ネットワークでは登録されている。
- 標準認証ルートを廃止する場合、`routes/auth.php` だけでなく、未使用の `auth:sanctum /api/user`、`Authenticate::redirectTo()` の名前付き `login` 依存、旧 Auth コントローラ・Request・テスト・Blade・`next/hooks/auth.js` を一括整理する。
- Laravel の `App\Models\User` と lowercase `users` テーブルは `UserNameController` や `Record::user()` で現役のため、標準認証廃止時も削除しない。
- リリース直前は、外部公開されておらず緊急の権限昇格経路も確認されていないため静観可能。廃止は独立した整理タスクとして実施する。
