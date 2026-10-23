# トップページのリロードと429

## 2026-10-18の調査

専用の未ログインPlaywrightブラウザで本番 `https://pik5.net/` をリロード。約8秒間で同一サイトの応答127件、うち `/api/server/stage/14xx` など13件が429。応答は `server: nginx/1.18.0 (Ubuntu)`、`content-type: text/html`。この観測では `/api/auth/session` は200。実在ユーザーでのセッション失効や本番Cookie削除は確認していない。

ローカル実装から確認した原因と修正：

- 新着APIは既にstagesをJOINしているが、表示種別を返していなかった。`Score` がイベントステージごとに追加APIを呼ぶため、新着50件が多段通信になる。新着APIのイベント記録に `score_type: time | points` を付与する。通常ステージは既存のルール別時間換算を維持するため付与しない。通常取得・差分取得の両方に適用。
- トップSSRは `getServerSession` を実行するがpropsに含めていなかった。`session` をSessionProviderへ渡し、トップの応答を `private, no-store` にする。
- インストール済みNextAuthの `client/_utils.js` はセッション取得のHTTP/JSONエラーをnullに変換し、SessionProviderはそれを未ログイン状態として採用する。429でログイン表示が消える経路はあるが、本番の今回の失効原因の断定とは区別する。JWTの失効と一時的なクライアント状態の消失も別。
- 共通fetcherは失敗時にResponseへ `res.status(500).end()` を呼んでいた。HTTP status付きErrorへ変更し、HTMLの429本文をJSONとして解析・ログ出力しない。
- リポジトリのNginx設定では、通常API・認証・publicアセットが `location /` のperip枠を共有する。認証/APIを別zoneへ分離し、静的アセットを動的制限枠から外す。本番のhttp共通設定や実効上限そのものは取得していない。

## Nginx反映手順

2026-10-18時点ではローカルファイルの修正まで。2026-10-24にNginxのみ本番反映した結果・切戻しは末尾の節を参照する。

1. 本番の現行設定との差分を確認する。
2. `nginx.pik5-http.conf` の新しいzone定義を `http {}` 内で一度だけ読み込む。既存の `perip`、`perip_nextdata`、`connperip` は維持する。`server {}` 内へzone定義を置かない。
3. `nginx.pik5.conf` のlocation変更を反映する。認証10 req/s・burst20、一般API30 req/s・burst60は初期値であり、実測で調整する。アプリ側のログイン試行制限は維持する。
4. `nginx -t` 成功後にreloadする。ローカル環境にはNginx実行ファイル・既存イメージがなく、今回の構文実行確認は未実施。
5. Next/Laravelも更新し、未ログイン・専用ログインユーザーでリロードを確認する。ステージ別の追加取得、429対象、認証API応答、ログイン表示を確認する。秘密値やCookie全文を採取しない。

## 検証

- `node --test tests/clientFetchJson.test.mjs`（next）：3成功。
- `docker compose exec -T laravel php artisan test --filter=TrickRecordVisibilityTest`：SQLiteインメモリ6成功。時間/点数・通常ルール・差分取得・大会公開境界を確認。
- `docker compose exec -T next yarn lint`：成功。
- `php -l app/Http/Controllers/NewRecordController.php`（laravelコンテナ）：成功。
- ローカル開発ブラウザ：ステージ情報の追加取得0件、ページ例外0件、1280pxで横はみ出しなし。React Strict ModeではSessionProviderのeffect再実行がセッション再取得を起こすため、認証APIを429にした検証ではクライアント状態がnullになる。本番動作の検証とは区別する。
- 分離出力先で `yarn build`：成功。既存devの出力とは共有せず、本番モードを一時的に5555で起動して検証。
- 専用一時ユーザーで本番モードのリロード：`/api/auth/session` を429にするブラウザルートを設定しても、初期再取得0件・ステージ情報追加取得0件。SSRセッションとログイン履歴リンクを維持、ログインリンクなし、ページ例外0件、応答 `private, no-store`。390pxで横はみ出しなし。通常devでも390pxのログイン表示を確認。
- 実在ユーザーの認証情報は使用せず、専用ユーザーのパスワードはGit管理外の一時環境変数から渡す。ユーザーとログイン履歴は検証後に削除。

## 2026-10-24の再調査・ローカル追加修正

本番公開ページを未ログインの専用Chromiumで確認した。変更・投稿は行っていない。

- トップのDOM構築直後はLoading表示0件、リンク18件。初回アクセス・リロードにはSPAのrouteChangeStartが発火せず、既存のローディングが表示されない。
- キャッシュありのリロードは同一サイト124応答・HTTPエラー0件。キャッシュを無効にした1回のリロードは124応答・429が4件。対象は `/api/server/stage/1441`、`1443`、`1416`、`1436`。イベントステージ追加取得は17件。429はNginxのHTML応答で、認証APIは200。
- 今回は本番のログインユーザーで投稿・編集していない。JWT/Cookieの実失効、Sleipnir Mobile実機・Windows 11実機の症状は未再現。認証APIの通信失敗がNextAuthの未ログイン表示に変わる経路と、JWT自体の失効を混同しない。

追加したローカル修正：

- `_document.js` にHTML段階から表示する初回ローディングを配置。JavaScript動作時は `__next.inert` でキーボード操作も抑止する。`_app.js` でルーター準備・初回セッション確認後に解除する。JavaScript無効時はnoscriptでローディングを隠し、inert設定も実行しない。
- `pageshow` で離脱用オーバーレイを除去する。BFCache復帰時にLoadingが残るケースを防ぐ。
- 記録詳細SSRもSessionProviderへsessionを渡す（既存のprivate/no-storeを維持）。
- 投稿後のISR再検証を待ってから更新する。`onPosted` があれば既存のデータ更新を利用し、それ以外は `router.replace` で同一ページのデータを再取得する。`window.location.reload()` によるSessionProvider再起動を避ける。
- 投稿失敗は401/403/429とその他を画面に表示し、フォームを保持する。生レスポンスをconsoleへ出さない。再検証失敗も本文・例外オブジェクトを記録しない。

429対策は2026-10-18の既存ローカル修正（イベント記録のscore_type、新着の追加API削減、Nginxの枠分離）が引き続き必要。本番で同じ原因が残っている観測であり、今回Nginxや本番アプリを反映した意味ではない。

検証の確定結果は下記へ追記する。本番反映・commit・pushは実施しない。

### 今回の検証結果

- 成功：`docker compose exec -T next yarn lint`。
- 成功：`docker compose exec -T -e NEXT_DIST_DIR=.next-bugfix-check next yarn build`。既存devと出力分離。Browserslistの既存データ更新通知あり。
- 成功：`node --test tests/clientFetchJson.test.mjs`（next）3件。
- 成功：Laravel SQLite分離 `TrickRecordVisibilityTest` 6件、`TrickClosureTest` 2件。後者は24時間超の証拠・コメント編集、本人/管理者の許可、他者・スコア変更の拒否、凍結結果の維持を含む。
- 成功：ローカルPlaywrightの静的ステージ直アクセスで、セッション取得を3秒遅延。Loading表示中はinert=true、認証確認後はLoading非表示・inert=false。
- 成功：ローカルトップのステージ追加API 0件、HTTPエラー0件、pageerror 0件。390pxで横はみ出しなし。`pagehide` / persisted `pageshow` の合成イベントで離脱用Loadingが1件→0件。
- 成功：専用一時ユーザーの実ログインで記録詳細SSRのsessionあり。`router.replace` による再取得の前後でdocumentを保持し、認証APIもログインを維持。
- 成功：同専用ユーザーの投稿フォームでPOSTと再検証のみモック。429時の画面メッセージ・スコア保持、再送成功、3件の再検証完了、documentと認証の維持を確認。実記録への投稿・編集はしていない。
- 検証手順の修正：最初のモック投稿テストは、非表示Backdropの文字列がDOMに残るためbody.textContentによる待機でタイムアウト。処理中要素の可視状態で待つ手順に直し、再実行成功。アプリの処理停止ではない。
- 制約：Next開発モードのStrict ModeはSSRセッションがあってもeffect再実行で認証APIを再取得することがある。本番build成功と、devブラウザでの確認は区別する。本番モードのブラウザ実行、Sleipnir Mobile実機、Windows 11実機、実投稿→24時間超編集を通したNextAuth込みの統合は今回未実施。
- テストで見つかった範囲外の事項：記録詳細の編集ボタンは1時間のusers一覧キャッシュのroleを使うため、新設テスト管理者が直ちに表示されない。このため既存記録の管理者編集ボタンを使うブラウザ試験にはせず、編集契約は分離テスト、認証・更新は実ログインとモック投稿で分けて確認した。
- 後始末：専用ログインブリッジを終了し、作成したUserとLaravel側の認証履歴のcleanupを実行。一時build出力を削除。通常devは稼働を継続。

## 2026-10-24：YouTubeのlog_event遮断エラーの追加調査

追加報告：トップのピックアップ動画自動再生中に `https://www.youtube.com/youtubei/v1/log_event?alt=json` の `net::ERR_BLOCKED_BY_CLIENT` 等が頻発する。

- 本番の未ログイン専用Chromiumで25秒観測。ピックアップiframeは1個、autoplay=1。対象パスへの送信は5回で、全てwww.youtube.comのiframe由来。対象通信の失敗0件、ページのJavaScript例外0件。この環境では報告の遮断を自然再現しなかった。
- `next/components/top/PickupVideo.js` はreact-youtubeのIFrame Player APIを使い、対象URLを直接fetchしたり失敗時に再送したりしない。onErrorはプレーヤーのエラーイベントを扱う。
- Chromiumの定義ではBLOCKED_BY_CLIENTはクライアント側の遮断。広告ブロッカーや追跡防止などは候補だが、報告環境でどの機能が遮断したかまでは未確認。
- YouTube公式資料はautoplay有効時にページ読み込みから再生データの収集・共有が始まると説明している。公式player parametersにはlog_eventだけを無効化する項目は掲載されていない。
- 通信先はYouTubeであり、pik5.netのNginx 429とは別経路。このエラー表示だけでサイト認証の失効とは判断しない。

一次資料：
- https://raw.githubusercontent.com/chromium/chromium/main/net/base/net_error_list.h （BLOCKED_BY_CLIENT）
- https://developers.google.com/youtube/player_parameters （autoplay）

遮断条件での検証：専用ブラウザの対象URLだけを `route.abort('blockedbyclient')` で遮断（拡張機能の再現ではなく通信遮断の合成試験）。約20秒の待機中に12回の `net::ERR_BLOCKED_BY_CLIENT.Inspector` を観測したが、動画時刻は7.22秒→19.23秒と進み、paused=false / readyState=4を維持。iframeは1個、ページ例外0件、認証APIは200。ログ送信の遮断が繰り返されても、この条件では再生・サイト側JavaScriptは継続した。未ログイン試験なので、ログイン済みセッション保持の実証とは区別する。検証後に遮断ルートを解除した。

判断：YouTube内部のログ通信がクライアント側で遮断される現象として切り分ける。サイトの直接送信・再送ループは認められず、今回アプリコード・自動再生仕様・本番設定の変更は行わない。報告端末の遮断機能の特定、長時間や動画切替後の影響は未検証。ログ送信だけを公式設定で停止できるとは案内しない。

## 2026-10-24：本番Nginxの検査・改善

ユーザーの追加依頼により、この節のNginx変更に限って本番反映する。前節までの「本番未反映」は当時の状態であり、Next/Laravelのローカル修正は今回も配備しない。YouTube通信は対象外。

### 検査

- 本番ホストへ既存の管理SSHで接続し、`nginx -T` と `nginx -t` で実効設定を確認。Nginxは1.18.0、稼働中、変更前の構文正常。
- `/etc/nginx/nginx.conf` の共有制限は `perip: 2r/s`、`perip_nextdata: 50r/s`、拒否ステータス429。`perip` は別サイトも使うため、共有zoneの値を直接変更しない。
- 対象は `/etc/nginx/sites-enabled/pik5.conf` → `/etc/nginx/sites-available/pik5.conf`。通常API・認証API・public画像は `location /` の `perip burst=20 nodelay` を共有。`/_next/static/` も `perip_nextdata burst=200` を消費していた。
- 対象サイトにはHost・転送ヘッダの設定がなく、上位にも該当設定なし。DNSのIPv4は当該ホストを指す直接入口であることを確認。
- 変更直前のキャッシュなしトップ読込：同一サイト124応答中429が1件（`/api/server/stage/1436`）、認証API200。
- 読める範囲のNginx error.log / error.log.1には対象サイトの制限エラー記録なし。ログの不存在から429なしと判断せず、ブラウザ観測・実効設定を根拠にした。生ログ・IP・Cookieは保存・表示していない。

### 対象差分

- 新規 `/etc/nginx/conf.d/pik5-rate-limits.conf` に `pik5_auth:10m rate=10r/s` と `pik5_api:10m rate=30r/s` を定義。
- `/api/auth/` は認証専用zone・burst20、`/api/` は一般API専用zone・burst60。いずれもnodelay、429、既存と同じ接続数制限50を維持。
- `/_next/static/` と画像・フォント等の静的拡張子の経路を動的リクエスト枠から除外。`^~ /api/`・`^~ /api/auth/` が拡張子判定より優先し、APIを静的枠へ逃がさない。
- Host / X-Forwarded-Hostを `$host`、X-Forwarded-Protoを `$scheme`、X-Real-IP / X-Forwarded-Forを `$remote_addr` で上書き。直接入口としてクライアント申告の転送値を採用しない。今後CDN等を導入する場合は信頼proxyと実IP解決を別途設計する。
- ページ本体・Next dataの既存制限、SSL、転送先、他サイトの設定は維持。リポジトリの `nginx.pik5.conf` も同じ有効ディレクティブに合わせる。

候補差分をレビューし、変更前サイト設定と候補を `<NGINX_BACKUP_DIR>` に保存（管理者限定）。適用直前は元ファイルのSHA-256で他作業による変更がないことを照合する。構文検証またはreloadに失敗した場合は元設定へ復元する手順で実施。

### 反映・検証結果

- 成功：候補の `nginx -t`、`systemctl reload nginx`。`ActiveState=active` / `SubState=running` を確認。
- 成功：反映後 `nginx -T` の構文正常。新規zoneは各1定義で、実効サイト設定・zone定義はリポジトリの対応ファイルとコメント・空白を除いて一致。
- 成功：キャッシュ無効の本番トップ（各DOM構築後8秒観測）。PC幅1280pxは同一サイト136応答・HTTPエラー0件、スマホ幅390pxは124応答・HTTPエラー0件。両方の `/api/auth/session` は200。変更前に観測した429は、この2回では0件。
- 成功：同一オリジンから追加GETした `/api/auth/session`、`/api/auth/csrf`、`/record/101182037` は全て200。本文・Cookieは出力しない。
- 未実施：本番ログイン済みユーザーでの投稿・編集、Sleipnir Mobile実機、Windows 11実機、長時間・高負荷検証。429抑制の観測と、セッション失効の完全解消は別の判定とする。
- Nginxのみ本番反映済み。ローディング・投稿後更新・新着APIの追加取得削減など、先行するNext/Laravelのローカル変更は未配備。Git commit/pushも行っていない。

### 切戻し

今回の2ファイルに後続変更がないことを確認してから、管理接続でサイト設定を `<NGINX_BACKUP_DIR>` から復元する。新規zoneファイルはconf.d外の同バックアップディレクトリへ移動し、`nginx -t` が成功した場合だけ `systemctl reload nginx` する。バックアップは本番ホスト内・管理者限定で保持する。
