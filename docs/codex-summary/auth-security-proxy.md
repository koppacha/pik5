# 認証・認可・proxy

## 認証DBと返却情報

- 主認証はNextAuth / Prisma。パスワードはbcrypt、メールはAES-256-GCMと検索用HMAC。実在ユーザーの復号・秘密情報の再利用は禁止。
- 改修方針：新規登録・パスワード変更/再設定はArgon2id、既存bcryptは今後の通常ログイン成功時に自動移行する。ユーザーの追加作業・ログイン工程変更・強制再設定は不要とする。未ログインユーザーはbcryptのまま残る。現時点では未実装。[引き継ぎ正本](../security-argon2id-kms-plan.md)を参照する。
- KMSはCodexが対象AWS環境を操作できる場合に導入する方針。操作可否は未確認。アプリの安全なKMS認証・最小権限も確認し、条件未成立でもArgon2id改修は進める。第一候補は既存メール鍵・HMAC鍵のKMS保護で、実行権限侵害やメモリ内鍵の窃取への限界を区別する。
- 新規設定パスワードは半角英数記号8〜72文字。bcryptの72バイト切捨てを考慮し、フロントとサーバー双方で検証する。
- 現行作業ツリーでは登録APIのUser返却を許可項目に限定し、旧 `/api/user/check-credentials` と `/api/user/[id]` は410。`/admin` と管理APIはデータ取得前に現在のUserを照会する。本番適用は別途確認する。
- ログイン履歴・原子的制限・トークン消費は `authSecurity.js` とLaravel `SecurityEventController`。成功90日・その他30日の履歴を `security:prune` で整理する。認証制限APIへ到達できないときは503。[実装詳細](../security-and-rule48-implementation.md)を参照する。

## Next → Laravel

- 汎用proxyは `next/pages/api/server/[...query].js`、投稿専用は `post.js`。`serverApiAccess.js` のsame-origin判定と短命HttpOnly Cookieはユーザー認証とは別のアクセス制御。
- パスの `..` / `/` / `?` / `#`、汎用proxy経由の記録更新迂回等を拒否する。専用経路のNextAuth・権限・本文検証を維持する。
- 管理要求は `ManagementIdentity`、大会要求は `TrickRequestIdentity` 等の署名検証を使う。入力のuserId / roleを信用しない。署名の主体・時刻・パス・本文・nonce等の契約は用途ごとに確認する。
- 接続元は `requestContext.js` で信頼CIDRを辿って正規化し、`clientIpSignature.js` → `VerifiedClientIp` で転送する。現行 `TrustProxies` は全proxy信頼ではなく設定CIDRのみ。
- 国情報は信頼peerと明示した `TRUSTED_COUNTRY_HEADER` がある場合のみ使用する。信頼proxyの上書きとNext直通不可が前提。現行ソースの国外短期限界と、本番WAF / Nginxの設定を混同しない。
- `Kernel.php` の通常API枠は `throttle:1800,1`。`RouteServiceProvider` の名前付き60回/分は定義だけで、このグループには接続されていない。実効middlewareと429 / Retry-Afterを確認する。
- `Origin` / `Referer` / `Host` / forwarded proto不一致による403、DB例外をauthorizeがnullへ変換する401、上流障害の502を分けて調べる。例外やヘッダの全文を診断ログへ追加しない。
- NextAuthのセッション取得は通信エラーもnullへ変換するため、429で未ログイン表示になってもJWT失効と断定しない。トップのSSRセッション引き継ぎと、Nginxの認証API制限枠の分離を維持する。Nginx枠分離・転送ヘッダ上書きは2026-10-24に本番反映済み。Next/Laravelのローカル修正の配備とは区別する。[調査・反映手順](../top-reload-429.md)。

## 旧Laravel認証

- Breeze / Sanctumの認証ルート・テストが残るが、現在の画面の主認証ではない。`App\Models\User` と小文字 `users` は業務コードでも使うため一括削除しない。
- 廃止時は `routes/auth.php`、旧Controller / Request / middleware / factory / テスト / フロントhookの依存をまとめて調査する。旧認証テスト7件の既知失敗は [テスト方針](testing-and-verification.md)を参照する。
