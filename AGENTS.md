# リポジトリ運用ガイドライン

## 全般
- 回答は日本語で簡潔かつ丁寧に記述してください。

## 認証情報・秘密情報の取り扱い
- Git 管理外・ignore 対象のファイル、ローカル DB、DB ダンプ、ログ、環境変数、セッション履歴にある認証情報は、実在ユーザーの秘密情報として扱ってください。
- これらに含まれるパスワード、API キー、トークン、Cookie、復号結果を、回答、コマンド、テスト、ソースコード、ドキュメント、コミットへ引用・転記・再利用してはいけません。値の確認が必要な場合も出力せず、一致・不一致などの非秘密情報だけを報告してください。
- 実在ユーザーの認証情報を調査・復号してテストへ流用してはいけません。認証が必要なテストには専用テストユーザーだけを使い、パスワードは Git 管理外の環境変数から与えてください。
- 認証情報らしき値を発見した場合は内容を表示せず、対象ファイルと種類だけを報告し、専用テストデータまたはプレースホルダーへ置き換えてください。

## Codex ドキュメント・セッションログ運用
- Codex は、今後の開発で参照すべき重要事項が `docs/codex-summary/` 配下に集約されていることを前提に、必要に応じて同ディレクトリの要約ドキュメントを参照してください。
- `docs/codex-summary/` はカテゴリごとに `{category-name}.md` として管理します。カテゴリ名は英語のケバブケースにしてください。必要に応じて既存カテゴリへ追記・更新し、適切なカテゴリがなければ新規作成して構いません。
- ユーザーがプロンプトを入力し、Codex がそれを処理するたび、すべての出力後に Codex が読み取れる範囲の transcript を `docs/codex-logs/{yyyy}-{mm}-{dd}-{sessionId}.md` に追記してください。日付にはセッション開始日を使い、該当セッション用ファイルが存在しない場合は新規作成してください。
- ログは要約ではなく transcript を原則とし、ユーザーが入力したプロンプトは省略・言い換えをせず、そのまま記録してください。ローカル JSONL から再生成する場合は `node docs/scripts/export-codex-log.mjs <JSONLファイル>` を使ってください。
- ユーザーが「このセッションは記録しないで」と指示した場合、そのセッションでは以後 `docs/codex-logs/` へのログ書き込みを行わないでください。
- ログ追記時に、今後の開発で参照すべき開発ルール、開発ポリシー、web アプリの構造や重要概念、Codex の禁止事項、出力ルール、セキュリティポリシー、Git 運用ポリシーなどの重要事項が含まれている場合は、適宜 `docs/codex-summary/` 配下の要約ドキュメントへ抽出・追記・更新してください。
- Codex は、通常のやりとりでは `docs/codex-logs/` を読み取らないでください。
- 例外として、ユーザーが「セッションログを読み取って」と明示的に指示した場合に限り、その指示に対する処理の範囲で `docs/codex-logs/` 配下のログを読み取って構いません。

## Codex 開発統計運用
- 開発統計ページは `docs/stats.html` とします。
- ユーザーが「統計情報を更新して」と指示した場合は、`node docs/scripts/update-stats.mjs` を実行して `docs/stats.html` を更新してください。既存データは再集計した値で上書きしてください。
- 開発統計には、Git commit ごとの短縮ハッシュ、commit 日、commit メッセージ内の `ver.x.xx` 相当文字列（存在しない場合は `ver.-.--`）、変更行数を出力してください。
- 開発統計には、`docs/codex-logs/` のセッションごとの開始日、セッションID、ユーザープロンプト文字数を出力してください。
- 開発統計には、`yyyy年mm月` ごとの変更行数とユーザープロンプト文字数の合計をダッシュボードとして出力してください。

## プロジェクト構成・モジュール構成
- next/ は Next.js フロントエンドを格納します（React、MUI、styled-components、Prisma クライアント利用など）。
- laravel/ は PHP/Laravel の API バックエンドです（コントローラ、モデル、ルーティング、マイグレーションなど）。
- docker-compose.yml は next / laravel / mysql / redis のローカルサービスを定義します。
- mysql/ と redis/ はローカルのデータボリュームです。log/mysql/ は DB ダンプとログを保存します。
- wiki/ と lab/ と sandbox/ には実験用コンテンツやドキュメントが入っています。変更対象がこれらに関係する場合を除き、編集は避けてください。

## ビルド・テスト・開発コマンド
- `cp sample.env .env` で、Docker サービスが利用するローカル環境設定を作成します。
- `docker compose up -d` で、フルスタック（Next.js / Laravel / MySQL / Redis）を起動します。
- `docker compose exec next bash` の後に `yarn dev` を実行すると、フロントエンドが http://localhost:3005 で起動します。
- `docker compose exec laravel bash` の後に `php artisan serve --host 0.0.0.0` を実行すると、API が http://localhost:8000 で起動します。
- `docker compose down` で、コンテナを停止して削除します。

## コーディングスタイル・命名規則
- JavaScriptのコードに文末のセミコロンはつけないでください。
- フロントエンドは CSS-in-JS を利用します。インラインスタイルを使う場合は、Grid の xs と混同しないよう、MUI の sx よりも style prop を優先してください。
- 片方の分岐が使われない三項演算子は避け、論理演算子（`&&`, `||`, `??`）を使用してください。
- 各モジュールの既存の命名に合わせてください（React コンポーネントは PascalCase、変数は camelCase）。
- フォーマット系ツール：フロントエンドは next lint、バックエンドは導入済みであれば ./vendor/bin/pint を利用できます。

## テストガイドライン
- バックエンドのテストは laravel/tests/ にあり、laravel コンテナ内で `php artisan test` または vendor/bin/phpunit を実行します。
- 典型的な手順は `docker compose exec laravel bash` の後に `php artisan test` です（対象を絞る場合は `--filter=ClassName` を使います）。
- テストがシード済みデータに依存する場合、実行前に `php artisan migrate:fresh` と該当シーダーでリセットしてください。
- フロントエンドは scripts に専用のテストランナーがありません。next/ 内で `yarn lint` を実行し、ブラウザでの手動スモークチェックに依存してください。
- DB 関連のテストは分離し、冪等性（何度実行しても同じ結果になること）を保ってください。既存のローカルボリュームに依存しないようにしてください。

### 記録投稿APIの再現手順
- `/api/server/post` の疎通確認は、NextAuth の認証 cookie を取得した上で multipart の `POST` を送る必要があります。
- 前提として `docker compose up -d` 済み、`next` コンテナ内で `yarn install --ignore-engines` 済み、`yarn dev` 起動済みであることを確認してください。
- 記録投稿APIの再現には、専用テストユーザー `codex_post_api_test` を使ってください。実在ユーザーのアカウントやパスワードを使わないでください。
- 専用テストユーザーのパスワードは Git に記録せず、`PIK5_POST_TEST_PASSWORD` 環境変数で指定してください。
- 専用テストユーザーが未投入の場合は、`next` コンテナ内で `PIK5_POST_TEST_PASSWORD='<ローカル専用の任意パスワード>' npx prisma db seed` を実行してください。`next/prisma/seed.ts` は、この環境変数がある場合のみ専用ユーザーを作成・更新します。
- 投稿APIの再現では、`stage_id` は `399` を使ってください。
- 実行場所はホストではなく `next` コンテナ内に揃えてください。`docker compose exec next bash` で入った後、下記のコマンドを実行すると、認証取得から `/api/server/post` 送信まで一度に再現できます。

```bash
node -e "(async()=>{ const base='http://localhost:3000'; const userId='codex_post_api_test'; const password=process.env.PIK5_POST_TEST_PASSWORD; if(!password) throw new Error('PIK5_POST_TEST_PASSWORD is required'); let cookies=[]; const addCookies=(res)=>{ const vals = res.headers.getSetCookie ? res.headers.getSetCookie() : []; for (const v of vals) { const kv = v.split(';')[0]; const key = kv.split('=')[0]; cookies = cookies.filter(c=>!c.startsWith(key + '=')); cookies.push(kv); } }; const cookieHeader=()=>cookies.join('; '); const csrfRes = await fetch(base + '/api/auth/csrf'); addCookies(csrfRes); const {csrfToken} = await csrfRes.json(); const loginBody = new URLSearchParams({ csrfToken, userId, password, callbackUrl: base + '/', json:'true' }); const loginRes = await fetch(base + '/api/auth/callback/credentials', { method:'POST', headers:{ 'content-type':'application/x-www-form-urlencoded', cookie: cookieHeader() }, body: loginBody, redirect:'manual' }); addCookies(loginRes); const form = new FormData(); form.append('stage_id','399'); form.append('rule','1'); form.append('region','1'); form.append('score','123'); form.append('console','1'); form.append('difficulty','0'); form.append('video_url',''); form.append('post_comment','codex api post test'); form.append('created_at', new Date().toISOString().slice(0,19).replace('T',' ')); form.append('user_agent','codex'); form.append('mode','create'); const postRes = await fetch(base + '/api/server/post', { method:'POST', headers:{ cookie: cookieHeader(), origin: base, referer: base + '/', host:'localhost:3000' }, body: form }); console.log('postStatus', postRes.status); console.log(await postRes.text()); })().catch(e=>{ console.error(e); process.exit(1) })"
```

- 正常系では `postStatus 200` と `["OK",200]` が返ります。
- `502 {"error":true,"message":"proxy error"}` が返る場合は、まず `next/pages/api/server/post.js`、`next/lib/prisma.js`、`next/lib/prismaConnection.js` を確認してください。
- テスト投稿は DB に残るため、必要に応じて MySQL コンテナ内で該当レコードを削除してください。

## コミット・プルリクエストのガイドライン
- Git 履歴ではコミットメッセージとして ver.X.XX <short description>（日本語であることも多い）が使われています。この形式に合わせるか、短く要点が伝わる要約を付けてください。
- PR にはユーザーが目にする変更点を説明し、UI 更新には関連スクリーンショットを添え、実行した DB マイグレーションやシードがあれば明記してください。

## 設定に関するヒント
- ローカル DB データをリセットする場合は、Laravel のシーダー（例：`php artisan db:seed --class=StageCsvSeeder`）を優先してください。
- MySQL のデータを truncate する必要がある場合は、MySQL コンテナ内で実行してください（`truncate table ...`）。
