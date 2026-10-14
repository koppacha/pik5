# API制限の横断検査と改善提案（2026-10-13）

## 対象と結論

ユーザー指示：webアプリ全体のAPI制限を横断して検査し、ベストプラクティスを提案する。

本番20d2822eのnginx設定、Laravel実効ミドルウェアとHTTPヘッダー、Nextの主要API／fetcher、トップ・通知・Tricks・Arena・Swissの取得処理を確認した。前回のL5画像と429の通常操作による再現結果も参照する。今回の作業は読み取りと文書作成だけで、本番コード・設定・DB変更、負荷試験、実ユーザー認証は行わない。

結論は「配信種別を分離し、信頼できる利用者情報で業務APIを制限し、通信量を削減し、429から復旧できる契約を整える」。一律の上限引き上げだけでは、誤遮断・利用者間の巻き添え・認証系の制限不足を同時に解決できない。

## 現状と証拠

| 層／処理 | 実際の状況 | 問題・評価 |
|---|---|---|
| nginx通常location / | 同一IP2r/s、burst20、nodelay。ページ・通常API・public画像を共用 | 普通のページ遷移でも画像とAPIを誤遮断。L5 SVG・/api/usersの429を前回再現 |
| nginx Next静的／データ | 50r/sの同一zone、burst200／120。接続上限は一部100、通常50 | public配下のL5画像はこの枠に入らない。接続数制限とリクエスト速度制限は別の指標 |
| Laravel実効ルート | api/new、api/record GET/POST、api/tricks/state、replayの展開後ミドルウェアはThrottleRequests:1800,1 | RouteServiceProviderの名前付きapi=60/分は定義のみで未接続。実効HTTPヘッダーもLimit=1800、Remaining=1799を確認 |
| Laravel識別 | 通常throttleはLaravel user、未認証ならドメイン＋IP。Next GETは利用者IPを転送しない | NextAuthの利用者やTricks署名IDをこのthrottleは使わない。通常GETはNextの接続元IPの枠を共有する構造 |
| Next直結API | limited-ideas、users、NextAuth、ユーザー登録、OTP等はLaravelを通らない | Laravelだけを改善しても全APIを網羅できない。nginxの粗いIP制限に加え用途別の制御が必要 |
| 認証・メール | OTP送信は同一ユーザー＋宛先ごと30秒の事前照合。OTP検証／NextAuth Credentials／登録に専用の試行回数制限は見当たらない | 宛先変更・同時送信・失敗試行には別の制御が必要。LaravelのLoginRequestの制限はNextAuthログインに適用されない |
| 429契約 | nginxはHTML。Next汎用・Swiss等プロキシは上流ステータスを返すがRetry-After、X-RateLimit-*を転送しない | バックエンドには制限情報があっても公開GETには無いことを実測。フロントが適切な再開時刻を選べない |
| fetcher | next/lib/pik5.jsは失敗時にFetch Responseの数値statusを関数として呼ぶ | TypeErrorとなり元のHTTP statusを失う。Tricksはstatusを付与するがRetry-Afterは読まない。ReplayはJSONを先に解析するためHTML429で構文エラーになる |
| 画像キャッシュ | L5のv6 SVGはpublic,max-age=0 | キャッシュ済みでも再検証し制限枠を消費。CSS背景は失敗後に自動再取得しない |
| サーバーキャッシュ | Laravel cache.default=redis、Next usersCacheは1時間＋同時取得の共有 | 良い基盤。ただしNextのusersCacheはプロセス内で、HTTPキャッシュや利用者別の制限とは別物 |

### 前回説明の訂正

前回の調査記録の「Laravel APIは60件/分」は定義を実効制限と扱っていた。本番ルートを展開して確認すると1800件/分であり、60件/分の署名ユーザー別制限は未接続である。前回のnginxによるSVGの429・L5表現欠落の結論は変更しない。

### IP・署名の信頼境界

- Next汎用GETはidentityHeadersだけを上流へ送り、X-Forwarded-Forを付けない。POSTや投稿APIは転送ヘッダーを付けるため、GETとPOSTで識別の扱いが異なる。
- Laravel TrustProxiesは'*'。読み取れるnginx設定ではpik5.confにHost／X-Real-IP／X-Forwarded-For／Protoの明示上書きは見つからず、別サイトの設定には存在した。
- nginx -Tによる統合設定確認は取得できなかったため、全実効include・外部ポート到達性は未検証。改善前に統合設定と信頼プロキシ範囲を確認する。
- 利用者が送ったX-Forwarded-Forやuser_id、役割をそのまま制限キーにしない。nginxで接続元IPを確定・転送ヘッダーを上書きし、Nextで認証済み主体を取り出し、Laravelまで署名付きで伝える。匿名IPにも信頼できる転送経路を用意する。
- DockerのNextポートは現在全インターフェースへ公開されている。外部から実際に到達できるかは確認していないが、nginx経由の制限を前提にするならloopback／ネットワーク境界に限定する設計も確認する。

## 通信量の問題

| 画面／機能 | ソースから分かる通信量 | 改善方向 |
|---|---|---|
| トップ記録一覧 | /newは10秒更新。イベントの各異なるstageについてScoreが/stage/{id}を追加取得 | 新着APIにscore_typeを一括付与し、表示のための追加取得を無くす |
| トップ動画／通知 | 動画は/new?limit=200、全ページ通知は/new?limit=1初期取得＋10秒差分更新 | 一覧・動画・通知の共有データ／差分更新設計。SWRは異なるキーを重複排除しない |
| 全ページ通知 | _app.jsで常時設置。setInterval10秒、同時poll防止はあるが非表示時停止は無い | 表示中だけ更新、複数タブは代表タブで取得しBroadcastChannel等で共有する候補 |
| Tricks開催中 | state3秒=20/分、holders30秒=2/分、選択ランキング3秒=20/分 | 通常だけでも約22/分、ランキングを開くと約42/分＋通知6/分。focus再取得・再試行も上乗せ |
| Tricks閉幕後 | stateは停止、holdersは30秒、観戦ランキングは3秒更新のまま | 完全固定ではなく証拠等の後日編集は反映しつつ、15〜60秒／明示更新へ緩和 |
| Arena | state1秒=60/分＋通知 | 通常GET60/分をそのまま有効化すると余裕が無い。鮮度要件を確認し共有キャッシュ・差分・SSE等を評価 |
| Swiss | 一覧3秒=20/分＋選択状態1.5秒=40/分＋通知 | 一覧は10〜30秒、選択状態のみ短周期等、用途ごとに分ける |
| リプレイ | バッチ上限8、キャッシュ上限24、解放時取得、取消処理あり | この軽量化は維持。manifest／静的チェックポイントと最新証拠を合成するsnapshotのキャッシュを区別 |

分あたりの数値はコードに記載された設定からの試算で、負荷試験による容量値ではない。SWRの同一キー重複排除・非表示時の既定動作によって実際の数は変動する。通知は独自setIntervalなのでSWRの制御は効かない。複数利用者をNextの同じ枠へ集約すると、Arena30人×60/分だけで1800/分に達する試算となる（他画面・通知を除く）。

## 推奨する制限方針

| 種別 | 主な制限単位 | 推奨方針 |
|---|---|---|
| ハッシュ／版付き静的画像・JS・CSS | キャッシュ・配信帯域 | 業務APIの枠を消費させない。厳密に版管理する画像だけ長期max-age＋immutable。未版管理画像へ一律適用しない |
| 公開軽量GET | エッジのIP上限＋経路別予算 | IP制限は共有NATを許容する粗い外周防御。短時間キャッシュ・初期集中に対応するburst。制限を全撤去しない |
| 認証済みGET | 検証済みユーザーID＋用途 | 読み取り枠を更新・認証から独立させる。通常GETは120〜180/分を試算候補とし、実測で調整 |
| 高コストGET | 主体別＋全体の同時実行数 | 新着200件の順位計算、総合集計、リプレイ復元等はコスト差を扱う。件数上限・キャッシュ・同時実行枠を組み合わせる |
| 投稿・大会操作 | 検証済みユーザーID＋操作種別 | 読み取りで更新の枠を使い切らせない。競技ルールを変える制限は別途要件判断。冪等キー・DB整合性の仕組みを維持 |
| ログイン・登録・OTP | IP＋対象アカウント／検証済みユーザー | 専用の失敗試行・送信回数制限。登録／bcrypt計算前に判定。固定長の永久ロックより段階的待機と監視 |
| 管理・内部処理 | 信頼できる認証主体＋専用枠 | 公開閲覧の枠から分離し、管理権限・署名検証は維持 |

GET120〜180/分は現行画面を収める候補であり、確定値でも一般的な標準値でもない。エッジのIPレートも一律の最適値は無い。同一IPの人数、複数タブ、P95/P99の初期リクエスト数、応答時間、DB負荷、拒否率を測って決める。1800を単純に60へ置換するだけの変更は推奨しない。

Laravelは名前付きread／write／auth／expensive等のlimiterを実際のmiddlewareへ明示接続し、Next直結の同等処理は共有Redisを使う。複数プロセス／同時要求で回数がすり抜けないよう、認証やOTPは原子的な判定・加算を行う。既存のRedisキャッシュ設定だけで全処理の原子性を保証するとは扱わない。

OTPは既存30秒の再送間隔に加え、宛先を変えても効くユーザー単位／IP単位の時間窓上限を持つ。検証失敗は発行したチャレンジ単位で回数を数え、例として5回で失効する方式を検討する。送信判定→生成→保存の並行競合も防ぐ。具体回数は利用要件とサポート運用で決める。

## エラー・再試行・キャッシュの契約

- APIの429は共通JSONコードRATE_LIMITED、Retry-After、Cache-Control:no-storeを返す。人向けページのエラーとJSON APIを分ける。内部名・生の制限キー・認証情報は返さない。
- Nextの各プロキシはRetry-After・選択したX-RateLimit-*を明示ホワイトリストで転送する。Set-Cookieや任意の上流ヘッダーを無差別にコピーしない。非標準のX-RateLimit-*をクライアントの唯一の必須条件にしない。
- 共通fetcherをError.status／retryAfter／codeを持つ形に統一し、HTMLの429や502でも元のstatusを保持する。現状のres.status(500).end()はFetch Response用の処理へ修正する。
- GETの429はRetry-Afterを下限としてランダム待ちを加える。指定が無ければ指数バックオフ＋上限回数を使う。同じorigin／予算グループのクールダウンを共有して、各SWRが同時に再開しないようにする。
- 401／403／入力不正は原則自動再試行しない。書き込みは自動再試行を基本禁止し、サーバーで保証された同じ冪等キーを利用できる操作だけ別途設計する。既存の延長・裁定の冪等処理は保つ。
- 最後に成功したデータを保持し、再取得待ちを表示する。通常の失敗で募集フォーム等のブロック全体が消える実装も改善対象。
- 利用者別手札／未公開大会／認証・管理APIはprivate,no-store。公開集計は短TTLと更新時の無効化を明示する。エンドポイント名がGETだから共有キャッシュ可とは判断しない。
- リプレイは現在の証拠・コメントを合成するためsnapshot全体を永続immutableにしない。静的manifest等は成果物バージョンに結び付け、動的メタデータは短TTLまたは更新時無効化する。
- 汎用転送には経路別timeout・同時実行数の上限を設ける。timeout後も書き込みが完了している可能性があるため、書き込みの重複防止を分けて設計する。

## 実施順序と検証

1. 静的画像の枠分離と版付きキャッシュ、新着score_type一括返却で初期要求を削減する。L5・APIの誤遮断を先に改善する。
2. edge→Next→LaravelのIP／署名主体の信頼境界を整え、名前付き制限を実効middlewareへ接続する。全体共有枠から主体／用途別枠へ移行する。
3. 同時にログイン・登録・OTP専用制限を整える。一般GETだけ広げて認証処理も同じ広い枠にしない。
4. 共通JSON／Retry-After転送／fetcher／SWR再試行を統一し、終了画面・非表示タブのポーリングを削減する。
5. dry-run／段階適用で閾値を調整する。入口の粗い防御を維持しながら候補の業務制限を影で観測し、設定変更前後の拒否率・P95/P99遅延・DBクエリ数を比較する。

検証ケースはcold/warmキャッシュ、トップ→イベントの連続遷移、同じNAT内の複数人、利用者Aの連打がBを止めないこと、複数タブ、閉幕・観戦・x4リプレイ、匿名／ログイン／管理者の境界、正しいRetry-After遵守、HTML429、期限切れ認証、OTPの同時再送・失敗回数、書き込み冪等性を含める。認証が必要な試験は専用テストユーザー・Git外の専用環境変数を使用する。

観測はrouteテンプレート、status、edge／Next／Laravelの層、latency、limit結果、request-idを構造化して記録する。Cookie・トークン・OTP・メール本文・生の識別キーは記録しない。nginxはlimit_req_log_level=warnだが現状error_logの既定errorで警告が出ない可能性があり、専用の安全なログと$limit_req_statusの集計を整える。

## 一次資料

- [nginx limit_req](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html)：経路別枠、burst、dry-run、結果変数。
- [Laravel 9 Routing](https://laravel.com/docs/9.x/routing#rate-limiting)：名前付きlimiterの定義とmiddlewareへの取付。
- [SWR Error Handling](https://swr.vercel.app/docs/error-handling)：既定の指数バックオフとonErrorRetry。
- [RFC 6585 §4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4)：429とRetry-After。Retry-Afterは仕様上任意だが本提案では復旧のため付与する。
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling)：認証の試行制限。
- [Next public folder](https://nextjs.org/docs/pages/api-reference/file-conventions/public-folder)：publicの既定max-age=0。
- [nginx realip](https://nginx.org/en/docs/http/ngx_http_realip_module.html)：信頼するプロキシの範囲と利用者IPの確定。
