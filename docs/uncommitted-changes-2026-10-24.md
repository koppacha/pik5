# 未コミット差分の整理（2026-10-24）

この一覧は整理開始時点の差分を機能単位で分類したもの。既存コードを破棄・ステージ・コミットしていない。後から追加した本書は下記227件に含めない。

公開前点検で文書の公開用表記修正と既存会話ログの追跡除外を追加した。下記件数はそれ以前のスナップショットであり、コミット後の未コミット件数ではない。点検結果は [公開文書点検](publication-audit-2026-10-24.md) を参照する。

## 全体像

- 追跡済み変更：88ファイル。88 files changed, 1162 insertions(+), 2890 deletions(-)（未追跡ファイルは含まない）。
- 未追跡：139ファイル（うち確認画像39件、過去資料26件）。ステージ済み0件。
- 差分整理にあたり、3ファイルの改行のみ調整。改行を除く全行が前後一致することを確認し、機能変更はしていない。
- 本番反映をこの会話で確認したのはNginx設定のみ。他機能の本番状態は、この一覧のローカル差分だけで断定しない。

|分類|件数|内容|
|---|---:|---|
|D 開発文書・運用方針|57|サマリー再編、docs入口、過去資料26件の退避、AGENTSと運用手順の更新。機能仕様書は該当機能へ分類。|
|S 認証・認可・接続元・監査|36|ログイン履歴、認証系の原子的制限、reset消費、メール鍵検証、旧APIの410化、管理者照会、署名付き接続元、画像パス・アップロード制限、PTR非同期化。|
|R ダンドリ検定・ルール48|36|ステージ管理・権限・公開、英数字コード、月次表示、難易度、採点・分母・総合ランキングへの算入。|
|W 認定記録・世界記録報告|15|48の認定マーカー、世界記録報告・機種別表示・論理削除・ボーダー。|
|E 限定大会の成績・スタンプ|6|大会グループ表示、参加・MVP・チーム勝利のスタンプ計算、第1回ダミー結果とゼロ表示。|
|Y 年別記録|21|/date/[year]、Laravel年別集計、年別RTA・キャッシュ・管理更新、共通Record・フッター導線・翻訳。|
|B 記録CSVの復旧|2|限定したCSV復元Seederと冪等性・既存値保持・rollbackのテスト。通常seedとは別のデータ操作。|
|P 初回表示・投稿後更新・通信削減|10|HTML段階のLoading、inert、pageshow復帰、SSR session引継ぎ、投稿後フルリロード回避、HTTPエラー表示、新着score_typeと共通fetcher。|
|N 本番Nginxの429対策|2|認証10r/s・一般API30r/sの別zone、静的アセット除外、転送ヘッダ上書き。今回の会話で本番反映・検証済み。|
|U 周辺の表示・操作調整|3|NextEventの空枠抑止、総合ステージ一覧の5行表示、ステージ・ルール切替状態の調整。|
|A ブラウザ確認画像|39|確認用PNG39件。対応する機能の証跡として選別して含める。画像があること自体は最新差分の検証成功を保証しない。|

## コミット候補と依存

これは実行前の分割案。下の主分類は所有先の目安であり、そのファイルを丸ごとstageすれば独立したコミットになるという意味ではない。共通ファイルは変更箇所ごとに分け、対応する仕様書・テスト・画像を同梱する。

1. Nginx設定（N）：他のアプリ変更から独立。本番との有効設定一致・nginx -t・reload・公開HTTP確認済み。
2. CSV復旧（B）：実行用Seederと分離テスト。コミットとSeeder実行は別の操作。
3. 認証・管理署名・proxy基盤（S）：認証履歴migration、管理署名helper、IP署名、upload処理を先に揃える。
4. ダンドリ検定（R）：Sの管理署名・現ユーザー照会に依存。難易度migrationを含む。
5. 認定記録・世界記録（W）：S/Rの管理・ステージ・採点基盤に依存。世界記録用migration2件を含む。
6. 限定大会の集計（E）：ダミー成績Seederとスタンプ・表示変更を対応づける。
7. 年別記録（Y）：S/Rの管理照会・採点・カタログを参照。ルール48と共有するRecord・翻訳の変更箇所を分ける。
8. 初回Loading・認証表示・通信削減（P）：S/R/Wと投稿フォーム・投稿APIを共有。Nginxだけでアプリの改修が配備されたことにはならない。
9. 周辺UI（U）：StageListのカタログ取得はRに依存。NextEvent単独の空枠抑止は切り分け可能。
10. 文書整理（D）：文書入口・アーカイブ・運用規約をまとめる。機能サマリーに含まれる実装の説明は各機能と整合させる。

## 複数機能が混在する主なファイル

|ファイル|混在する内容|
|---|---|
|`laravel/app/Http/Controllers/RecordController.php`|Rの48投稿条件、Wの認定記録、SのPTR非同期化・採点処理。|
|`laravel/app/Library/Func.php`|Rの採点・RPと、Yで使うrank_calcの最大人数引数。|
|`laravel/routes/api.php` / `laravel/app/Http/Kernel.php`|S/R/W/Yのルート・middleware。単純なファイル単位分割を避ける。|
|`next/components/modal/RecordForm.js`|Rの操作方法・時間、Wの認定チェック、Pの投稿後更新・エラー表示。|
|`next/pages/api/server/post.js`|SのIP・upload、Wのcertified転送。投稿フォームのP変更と併せて扱うが、API差分自体は認証・投稿基盤。|
|`next/components/record/Record.js`|Rの分母、Wの認定アイコン、Eの0点、Yの表示・リンク・複数走者等の汎用props。|
|`next/components/record/Score.js` / `next/lib/pik5.js`|Rの表示判定・コード解決とPのscore_type / fetcher利用。|
|`next/pages/index.js`|Sのログイン履歴、Rの月次表示、PのSSR session/no-store、UのNextEvent配置。|
|`next/pages/stage/[...stage].js`|Rの英数字ID、Wの世界記録表示、Uの切替状態。|
|`next/pages/total/[...series].js` / `next/components/record/StageList.js`|Eの大会分類、Rの検定カタログ、Uの5行表示。|
|`next/locale/{ja,en}.js` / `next/.gitignore`|RとY。ignoreには検証buildと公開RTAキャッシュの除外。|
|`next/tests/security-and-dandori.test.cjs`|S/Rを横断する既存の結合したテスト。|
|`docs/codex-summary/*.md` / `docs/top-reload-429.md`|既存の文書再編と追加機能説明、Nginx本番反映、アプリ未反映の記述が混在。|

## DB変更とデータ操作

新規migrationは以下の5件。未コミットであることから適用状況は判断できない。各環境の適用履歴を別途確認する。

- `laravel/database/migrations/2026_10_15_000001_create_dandori_management.php`
- `laravel/database/migrations/2026_10_15_000002_create_login_events.php`
- `laravel/database/migrations/2026_10_16_000001_add_difficulty_to_stages.php`
- `laravel/database/migrations/2026_10_20_000001_create_world_record_reports.php`
- `laravel/database/migrations/2026_10_20_000002_add_world_record_platform_and_moderation.php`

`RestoreRecordCsvSeeder` と `LimitedFirstDummyRecordSeeder` はデータを書き換える実行物。今回の整理ではmigration・Seederを実行していない。

## 実装と計画の区別

- `docs/security-argon2id-kms-plan.md` は方針文書。Argon2idへの移行やKMSの導入が今回の差分で実装済みという意味ではない。
- 新しいpublic API・管理API・認証制限はLaravel/Next双方の追加ファイルを必要とする。追跡済みの変更だけをコミットするとimport先・ルート先・migrationが欠落する。
- 確認画像は39件、約3.37MiB。ファイル名だけで不要と判断せず、各変更の証跡として採用するものを選ぶ。今回削除していない。
- 作業transcriptは運用どおり別途保存。通常コンテキストに過去ログを読み込んで機能の検証を補っていない。

## 検証状況

- 今回成功：全227ファイルを分類（漏れ・重複なし）、ステージ済み0件、3ファイルの改行以外の内容一致、`git diff --check`。
- 改行整理前はstageページ39件・totalページ1件のCRLF由来警告があった。`.gitignore`の全面的な改行差分も縮小した。バックアップは `<LOCAL_BACKUP_DIR>`。
- この会話で実行済み：Next lint・分離出力build、clientFetchJson 3件、Laravel TrickRecordVisibility 6件・TrickClosure 2件、Loading・モック投稿・専用ユーザー認証のブラウザ確認。これは全227ファイルを網羅した再検証ではない。
- 本番Nginx：構文・実効設定・reload・PC/スマホ幅のHTTP確認成功。反映後136/124応答でHTTPエラー0件。
- 他機能の既存の検証記録は `docs/security-and-rule48-implementation.md`、`docs/dandori-certified-world-records.md`、`docs/yearly-record-page.md` 等にある。記録の検証日と対象を区別し、今回再実行したと扱わない。
- 未実施：全差分の一括テスト、追加migrationの本番適用確認、MySQL並行処理の再確認、本番での実ログイン・投稿・編集。整理だけのためにDBや本番へ接続し直していない。

## ファイル別一覧

分類は重複なし。共通ファイルの関連先は上の表を併用する。

### D：開発文書・運用方針（57件）

- 変更 `AGENTS.md`
- 新規 `docs/README.md`
- 新規 `docs/archive/README.md`
- 新規 `docs/archive/commands-before-2026-10-15.md`
- 新規 `docs/archive/summary-2026-10-15/auth-security-proxy.md`
- 新規 `docs/archive/summary-2026-10-15/backend-laravel.md`
- 新規 `docs/archive/summary-2026-10-15/caching-and-performance.md`
- 新規 `docs/archive/summary-2026-10-15/codex-working-rules.md`
- 新規 `docs/archive/summary-2026-10-15/data-and-prisma.md`
- 新規 `docs/archive/summary-2026-10-15/deployment-and-environment.md`
- 新規 `docs/archive/summary-2026-10-15/events-and-rankings.md`
- 新規 `docs/archive/summary-2026-10-15/frontend-next.md`
- 新規 `docs/archive/summary-2026-10-15/keywords-editorial.md`
- 新規 `docs/archive/summary-2026-10-15/limited-ideas.md`
- 新規 `docs/archive/summary-2026-10-15/records-and-scoring.md`
- 新規 `docs/archive/summary-2026-10-15/repository-operations.md`
- 新規 `docs/archive/summary-2026-10-15/security-and-rule48-planning.md`
- 新規 `docs/archive/summary-2026-10-15/testing-and-verification.md`
- 新規 `docs/archive/summary-2026-10-15/treasure-simulator.md`
- 新規 `docs/archive/summary-2026-10-15/tricks-deck-schema.md`
- 新規 `docs/archive/summary-2026-10-15/tricks-personalities.md`
- 新規 `docs/archive/summary-2026-10-15/tricks-release-audit.md`
- 新規 `docs/archive/summary-2026-10-15/tricks-replay.md`
- 新規 `docs/archive/summary-2026-10-15/tricks-reward-proposals.md`
- 新規 `docs/archive/summary-2026-10-15/tricks-rule-consistency.md`
- 新規 `docs/archive/summary-2026-10-15/tricks-rules.md`
- 新規 `docs/archive/summary-2026-10-15/tricks-tournament-analysis.md`
- 新規 `docs/archive/summary-2026-10-15/tricks-ui.md`
- 変更 `docs/codex-260412-prisma7-upgrade.md`
- 変更 `docs/codex-summary/auth-security-proxy.md`
- 変更 `docs/codex-summary/backend-laravel.md`
- 変更 `docs/codex-summary/caching-and-performance.md`
- 変更 `docs/codex-summary/codex-working-rules.md`
- 変更 `docs/codex-summary/data-and-prisma.md`
- 変更 `docs/codex-summary/deployment-and-environment.md`
- 変更 `docs/codex-summary/events-and-rankings.md`
- 変更 `docs/codex-summary/frontend-next.md`
- 変更 `docs/codex-summary/keywords-editorial.md`
- 変更 `docs/codex-summary/limited-ideas.md`
- 変更 `docs/codex-summary/records-and-scoring.md`
- 変更 `docs/codex-summary/repository-operations.md`
- 変更 `docs/codex-summary/testing-and-verification.md`
- 変更 `docs/codex-summary/treasure-simulator.md`
- 変更 `docs/codex-summary/tricks-deck-schema.md`
- 変更 `docs/codex-summary/tricks-personalities.md`
- 変更 `docs/codex-summary/tricks-release-audit.md`
- 変更 `docs/codex-summary/tricks-replay.md`
- 変更 `docs/codex-summary/tricks-reward-proposals.md`
- 変更 `docs/codex-summary/tricks-rule-consistency.md`
- 変更 `docs/codex-summary/tricks-rules.md`
- 変更 `docs/codex-summary/tricks-tournament-analysis.md`
- 変更 `docs/codex-summary/tricks-ui.md`
- 変更 `docs/commands.md`
- 変更 `docs/database-recovery.md`
- 新規 `docs/documentation-audit-2026-10-15.md`
- 変更 `docs/idea/event-arena.md`
- 変更 `docs/release-2026-09-12.md`

### S：認証・認可・接続元・監査（36件）

- 変更 `next/pages/api/server/post.js`
- 新規 `docs/security-argon2id-kms-plan.md`
- 新規 `docs/testing-post-api.md`
- 新規 `laravel/app/Console/Commands/PruneSecurityEvents.php`
- 変更 `laravel/app/Console/Kernel.php`
- 変更 `laravel/app/Http/Controllers/GetImageController.php`
- 新規 `laravel/app/Http/Controllers/SecurityEventController.php`
- 変更 `laravel/app/Http/Kernel.php`
- 新規 `laravel/app/Http/Middleware/ForeignTrafficLimit.php`
- 変更 `laravel/app/Http/Middleware/TrustProxies.php`
- 新規 `laravel/app/Http/Middleware/VerifiedClientIp.php`
- 新規 `laravel/app/Jobs/ResolveRecordHost.php`
- 新規 `laravel/app/Services/ManagementIdentity.php`
- 変更 `laravel/config/services.php`
- 新規 `laravel/database/migrations/2026_10_15_000002_create_login_events.php`
- 新規 `laravel/tests/Feature/SecurityEventTest.php`
- 新規 `next/lib/authSecurity.js`
- 新規 `next/lib/clientIpSignature.js`
- 新規 `next/lib/dandoriServer.js`
- 変更 `next/lib/emailCrypto.js`
- 新規 `next/lib/recordUpload.js`
- 新規 `next/lib/requestContext.js`
- 変更 `next/pages/admin.js`
- 変更 `next/pages/api/auth/[...nextauth].js`
- 変更 `next/pages/api/auth/email/request-otp.js`
- 変更 `next/pages/api/auth/email/verify-otp.js`
- 変更 `next/pages/api/auth/password-reset/confirm.js`
- 変更 `next/pages/api/auth/password-reset/request.js`
- 変更 `next/pages/api/auth/password-reset/verify.js`
- 新規 `next/pages/api/login-history.js`
- 変更 `next/pages/api/server/[...query].js`
- 変更 `next/pages/api/user/[id].js`
- 変更 `next/pages/api/user/check-credentials.js`
- 変更 `next/pages/api/user/create.js`
- 新規 `next/pages/auth/history.js`
- 新規 `next/tests/security-and-dandori.test.cjs`

### R：ダンドリ検定・ルール48（36件）

- 変更 `next/components/record/Score.js`
- 新規 `docs/codex-summary/security-and-rule48-planning.md`
- 新規 `docs/security-and-rule48-implementation.md`
- 新規 `laravel/app/Http/Controllers/DandoriController.php`
- 変更 `laravel/app/Http/Controllers/RecordController.php`
- 変更 `laravel/app/Http/Controllers/StageController.php`
- 変更 `laravel/app/Http/Controllers/TotalController.php`
- 変更 `laravel/app/Http/Controllers/UserTotalController.php`
- 新規 `laravel/app/Http/Middleware/StageCodeBoundary.php`
- 変更 `laravel/app/Library/Func.php`
- 新規 `laravel/app/Services/DandoriCatalog.php`
- 新規 `laravel/app/Services/StageCodes.php`
- 新規 `laravel/app/Services/StageRecordRanking.php`
- 新規 `laravel/database/migrations/2026_10_15_000001_create_dandori_management.php`
- 新規 `laravel/database/migrations/2026_10_16_000001_add_difficulty_to_stages.php`
- 変更 `laravel/routes/api.php`
- 新規 `laravel/tests/Feature/DandoriManagementTest.php`
- 新規 `laravel/tests/Feature/DandoriMonthlyTest.php`
- 変更 `next/components/BreadCrumb.js`
- 変更 `next/components/form/PullDownRule.js`
- 変更 `next/components/modal/RecordForm.js`
- 変更 `next/components/record/RankingTotal.js`
- 変更 `next/components/rule/Totals.js`
- 変更 `next/components/top/DashBoard.js`
- 新規 `next/components/top/MonthlyDandori.js`
- 新規 `next/hooks/useDandoriCatalog.js`
- 変更 `next/lib/const.js`
- 新規 `next/lib/dandori.js`
- 変更 `next/lib/factory.js`
- 新規 `next/pages/admin/stages.js`
- 新規 `next/pages/api/dandori-management.js`
- 新規 `next/pages/api/dandori.js`
- 変更 `next/pages/index.js`
- 変更 `next/pages/stage/[...stage].js`
- 新規 `next/tests/dandori-browser-session.cjs`
- 新規 `next/tests/dandori-local-user.cjs`

### W：認定記録・世界記録報告（15件）

- 新規 `docs/dandori-certified-world-records.md`
- 新規 `laravel/app/Http/Controllers/WorldRecordController.php`
- 変更 `laravel/app/Models/Record.php`
- 新規 `laravel/app/Services/RecordCertification.php`
- 新規 `laravel/app/Services/WorldRecordPolicy.php`
- 変更 `laravel/config/const.php`
- 新規 `laravel/database/migrations/2026_10_20_000001_create_world_record_reports.php`
- 新規 `laravel/database/migrations/2026_10_20_000002_add_world_record_platform_and_moderation.php`
- 新規 `laravel/tests/Feature/WorldRecordTest.php`
- 新規 `next/components/modal/WorldRecordReport.js`
- 変更 `next/components/record/RankingStandard.js`
- 新規 `next/components/record/ReferenceScoreBorder.js`
- 新規 `next/hooks/useWorldRecordPermissions.js`
- 新規 `next/lib/worldRecordScore.js`
- 新規 `next/pages/api/world-records.js`

### E：限定大会の成績・スタンプ（6件）

- 変更 `laravel/app/Services/EventStampService.php`
- 変更 `laravel/app/Services/LimitedEventResultService.php`
- 新規 `laravel/database/seeders/LimitedFirstDummyRecordSeeder.php`
- 新規 `laravel/tests/Feature/LimitedFirstDummyRecordSeederTest.php`
- 変更 `laravel/tests/Unit/EventStampServiceTest.php`
- 変更 `next/components/record/EventList.js`

### Y：年別記録（21件）

- 新規 `docs/yearly-record-page-plan.md`
- 新規 `docs/yearly-record-page.md`
- 新規 `laravel/app/Http/Controllers/YearRecordController.php`
- 新規 `laravel/app/Services/YearRecords.php`
- 新規 `laravel/tests/Feature/YearRecordTest.php`
- 変更 `next/.gitignore`
- 変更 `next/components/Footer.js`
- 変更 `next/components/record/Record.js`
- 新規 `next/components/record/YearRecordList.js`
- 新規 `next/lib/yearRecordPresentation.mjs`
- 新規 `next/lib/yearRecords.mjs`
- 新規 `next/lib/yearRecordsCache.mjs`
- 新規 `next/lib/yearSpeedruns.mjs`
- 変更 `next/locale/en.js`
- 変更 `next/locale/ja.js`
- 新規 `next/pages/api/date/refresh.js`
- 新規 `next/pages/api/date/rta/[year].js`
- 変更 `next/pages/api/revalidate.js`
- 新規 `next/pages/date/[year].js`
- 新規 `next/tests/yearRecordPresentation.test.mjs`
- 新規 `next/tests/yearRecords.test.mjs`

### B：記録CSVの復旧（2件）

- 新規 `laravel/database/seeders/RestoreRecordCsvSeeder.php`
- 新規 `laravel/tests/Feature/RestoreRecordCsvSeederTest.php`

### P：初回表示・投稿後更新・通信削減（10件）

- 新規 `docs/top-reload-429.md`
- 変更 `laravel/app/Http/Controllers/NewRecordController.php`
- 変更 `laravel/tests/Feature/Tricks/TrickRecordVisibilityTest.php`
- 新規 `next/lib/clientFetchJson.mjs`
- 変更 `next/lib/pik5.js`
- 変更 `next/next.config.mjs`
- 変更 `next/pages/_app.js`
- 変更 `next/pages/_document.js`
- 変更 `next/pages/record/[record].js`
- 新規 `next/tests/clientFetchJson.test.mjs`

### N：本番Nginxの429対策（2件）

- 新規 `nginx.pik5-http.conf`
- 変更 `nginx.pik5.conf`

### U：周辺の表示・操作調整（3件）

- 変更 `next/components/record/StageList.js`
- 変更 `next/components/top/NextEvent.js`
- 変更 `next/pages/total/[...series].js`

### A：ブラウザ確認画像（39件）

- 新規 `output/playwright/bugfix-loading-mobile.png`
- 新規 `output/playwright/dandori-certified-form.png`
- 新規 `output/playwright/dandori-certified-record.png`
- 新規 `output/playwright/dandori-header-ranking-desktop.png`
- 新規 `output/playwright/dandori-header-ranking-mobile.png`
- 新規 `output/playwright/dandori-management-desktop.png`
- 新規 `output/playwright/dandori-management-mobile.png`
- 新規 `output/playwright/dandori-monthly-desktop-light.png`
- 新規 `output/playwright/dandori-monthly-desktop.png`
- 新規 `output/playwright/dandori-monthly-mobile-light.png`
- 新規 `output/playwright/dandori-monthly-mobile.png`
- 新規 `output/playwright/limited-first-zero-stamp-marker.png`
- 新規 `output/playwright/limited-total-desktop-light.png`
- 新規 `output/playwright/limited-total-desktop.png`
- 新規 `output/playwright/limited-total-mobile-light.png`
- 新規 `output/playwright/limited-total-mobile.png`
- 新規 `output/playwright/limited-total-outside-label-desktop.png`
- 新規 `output/playwright/limited-total-outside-label-mobile.png`
- 新規 `output/playwright/limited-total-special-rules-desktop.png`
- 新規 `output/playwright/limited-total-special-rules-mobile.png`
- 新規 `output/playwright/series-stage-five-rows-1280.png`
- 新規 `output/playwright/series-stage-five-rows-390.png`
- 新規 `output/playwright/world-record-border.png`
- 新規 `output/playwright/world-record-delete-mobile.png`
- 新規 `output/playwright/world-record-platform-form-mobile.png`
- 新規 `output/playwright/world-record-platforms.png`
- 新規 `output/playwright/world-record-report-blocked.png`
- 新規 `output/playwright/world-record-report-form.png`
- 新規 `output/playwright/world-record-report-mobile.png`
- 新規 `output/playwright/world-record-soft-delete-fallback.png`
- 新規 `output/playwright/world-record-time-form.png`
- 新規 `output/playwright/yearly-events-desktop.png`
- 新規 `output/playwright/yearly-events-mobile-dark.png`
- 新規 `output/playwright/yearly-events-mobile-light.png`
- 新規 `output/playwright/yearly-record-shared-desktop.png`
- 新規 `output/playwright/yearly-record-shared-mobile.png`
- 新規 `output/playwright/yearly-rta-desktop.png`
- 新規 `output/playwright/yearly-rta-shared-desktop.png`
- 新規 `output/playwright/yearly-rta-shared-mobile.png`
