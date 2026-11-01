# Next.js セキュリティ更新（2026-10-24）

## 変更と判断

- Next.js / eslint-config-next を 14.2.24 → **15.5.28** に固定。公式サポート表の Maintenance LTS を採用する。Pages Router と React 18 を維持でき、React 19・Next 16 への同時移行を避けられる。
- 画像処理の実依存 **sharp 0.35.5** を直接指定し、Yarn lock に固定。Next 側の optional dependency が未導入になったり、旧 sharp に解決されたりしないことを検証する。
- React Buddy を Next 15 対応の 2.5 系へ更新。未使用の `@react-libraries/use-ssr` を削除し、それが引き込んでいた Next 12 と旧 SWC を lock から除去した。
- Docker ベースを **node:22.23.4-alpine** に固定。別途共有された本番実測とは独立に、ローカル Next コンテナは Node 22.23.2 と確認した。既存コンテナの再作成は実施していない。
- PHP、DB schema、migration、通常 seed、Router、画像許可先、認証・投稿処理は変更しない。初回の依存更新時点では本番接続・配備・commit・pushは未実施。後続の配備作業は末尾で区別する。

開始時の作業ツリーは clean。ルート AGENTS.md、docs/README.md、共通方針・構成運用・検証方針・配備・フロントのサマリーを確認した。別途の `.agents/`・`.codex/` はこのチェックアウトに存在しなかった。

## 告知と影響の整理

一次情報：

- [10月14日告知](https://nextjs.org/blog/nextjs-security-update-october-14-2026)：Next 15.5.28 / 16.4.1、画像SVG問題の回避条件 sharp 0.35.5以降。
- [9月30日告知](https://nextjs.org/blog/september-2026-security-release)：Next 15.5.27 / 16.3.8。今回の15.5.28はその修正も含む。
- [サポート方針](https://nextjs.org/support-policy)：14は対象外、15はMaintenance、16はActive。
- [Pages Routerの15移行ガイド](https://nextjs.org/docs/pages/guides/upgrading/version-15)：React 18を継続可能。

| 対象 | リポジトリから分かる条件・今回の扱い |
| --- | --- |
| CVE-2026-96889、画像処理RCE | Alpine muslは告知のglibc条件外。`dangerouslyAllowSVG` は既定false。公開告知の修正版とsharpへ更新し、OS変更時にも古い画像ライブラリを残さない。攻撃用RCEペイロードは実行していない。 |
| CVE-2026-94483、画像SSRF | `remotePatterns` は `http://laravel:8000` を許可。任意ホストの許可はないが、`/_next/image` 自体が公開入口となる。経路許可だけでSSRF修正済みとは判定せず、フレームワークを更新。告知と個別advisoryの影響版表示に差があり、旧14での成立は未確定。 |
| CVE-2026-94543、SSG/ISRキャッシュ汚染 | セルフホストのPages Router。`keyword/[keyword]`、`limited/[limited]`、`speedrun/[...run]` はblocking fallbackとISRを使うため、移行先にも修正が必要。主要ランキングのSSRだけでは対象全体を評価できない。 |
| CVE-2026-94484、ルートcatch-all併用 | ルート直下のcatch-allはない。`stage/[...stage]` 等の配下catch-allとは区別する。 |
| App Router / use cache / Server Actions関連 | このチェックアウトはPages Router。該当機能の利用は確認されない。 |

現在使われる認証画面の最適化画像は `/img/bg29.jpg`。主な記録証拠画像は通常の `img` と `/api/file/` を使う。旧 `ModalDialogImage` はLaravelの `/api/img/` を指定するため、このURLの許可を回帰テストで維持した。許可先のDNS、redirectや画像API自体の安全性を、URL検証テストだけで保証したとは扱わない。

## 検証

検証にはGit追跡対象だけの一時コピーを使い、既存の `.env`・実ユーザー・DBダンプを渡していない。HTTP検証のDBは専用の使い捨てMySQLへschemaを作成したもので、開発DBではない。ホストのNodeは24.15.0。Alpine検証はNode 22.23.4の別コンテナ・別依存ディレクトリで実施した。

### 成功

- ホストで `yarn install --non-interactive`、新しいlockで依存解決。
- ホストで `yarn install --frozen-lockfile --offline --non-interactive` の再実行、Alpineで読み取り専用の取得済みキャッシュからのfrozen installも成功。
- `yarn lint`。`next lint` 廃止予定と複数lockによるworkspace推定の警告は残る。Next 15では使用可能。
- ホストとAlpineの隔離コピーで `DATABASE_URL=<専用テストDB URL> yarn build`。Prisma生成、型検査、コンパイル、25静的ページ生成とbuild traceが完了。
- 下記Nodeテスト：ホスト・Alpineの双方で **39成功・2スキップ**。
- ホスト・Alpineの隔離した `next start` に対するHTTPテスト：双方で **4成功**。日英認証画面のSSR・CSS、実画像のWebP変換、非許可URLの400、API hello、匿名session、CSRF取得、revalidateのGET拒否、日英SSG HTMLとNext dataの分離を確認。
- SSGへのルーティングヘッダ偽装リクエストの後も、通常HTMLとNext dataが元の内容を返す。これは回帰用の代替検証であり、告知CVEの完全な攻撃再現ではない。
- Playwright（ホストbuild）：日英認証画面、PC/390px幅、未入力時のフォームエラー、SSGマニュアル表示、背景画像ロード、初期Loading解除、inert解除、横はみ出しなし。hydration例外は観測されない。Laravelを接続しない構成なので、新着通知の `/api/server/new?limit=1` は502となる。

`next/` でのNodeテスト：

```bash
env -u LIMITED_IDEAS_TEST_DATABASE_URL node --import tsx --test --test-concurrency=1 \
  tests/limitedIdeas.test.js tests/legacyLimitedIdeas.test.js \
  tests/pickupVideo.test.js tests/serverFetchJson.test.mjs \
  tests/security-and-dandori.test.cjs tests/clientFetchJson.test.mjs \
  tests/yearRecords.test.mjs tests/yearRecordPresentation.test.mjs \
  tests/nextSecurity.test.cjs
```

HTTPテストは、専用DBを設定した隔離本番buildを別ポートで起動して実行する。URL未指定時は4件ともskip、loopback以外は拒否する。

```bash
NEXT_SECURITY_TEST_BASE_URL=http://127.0.0.1:3105 \
  node --test tests/nextRuntimeSmoke.test.mjs
```

### 初回失敗と環境の補正

- 既存の共有node_modulesはmacOS向けesbuildとLinux向けbcryptが混在。既存NextコンテナでのNodeテストは3ファイル失敗した。ホストでOSを揃え、bcryptをホスト向けに再構築して解消した。ホストとDockerでnode_modulesを使い回さない。
- sandbox内のHTTP listenはEPERM。権限を揃えた再実行では成功。
- 承認付きシェルの既定Node 20ではPrisma依存のengine要件を満たさずinstall失敗。Nodeパスを明示した再実行で成功。
- DBなしの最初の認証画面/API検証は500。専用の空MySQLと正常なbcryptを使って4件すべて再検証した。
- Alpineの最初のinstallはDocker領域のENOSPC。既存ボリュームは削除せず、今回だけの一時ディレクトリと取得済みの読み取り専用Yarnキャッシュに切り替えた。

### 未実施・制約

- 専用募集MySQLの統合2件はスキップ。
- 実ログイン成功、実multipart投稿、Laravelへの署名付き転送、業務DBのランキング実データ、実データを伴うISR再生成は未検証。実ユーザー資格情報の再利用や通常seedは行っていない。
- 初回検証はAlpine arm64で実施。後続の本番配備ではAlpine x64も検証した。glibc Linux・Windowsは未検証。
- 許可されたLaravelホストからのredirectによるSSRF攻撃再現は未実施。

## 本番反映手順（通常の起動時build方式）

単一Next構成なので停止時間を確保する。以下はbuild容量に余裕がある環境での通常方式。今回の小メモリ本番では、後述の事前build方式を使用した。認証情報・DB・他サービスは変更しない。今回の変更だけならmigration / seedは不要。

1. 適用する差分・リリース、旧リリースの復元方法、現在のNode/Next/依存の版を確認。旧コード・lock・依存・buildを復元できる非公開の退避先を用意する。秘密値や `docker compose config` の全文を公開ログへ出さない。
2. `next/Dockerfile` の新しいイメージを先にbuildする。pullだけでは稼働コンテナは変わらない。
3. Nextを停止し、新しいイメージのone-offコンテナでfrozen installする。bind mountされた依存はmacOSから持ち込まない。インストール中に旧Nextを走らせない。
4. Nextを再作成する。現行overrideは起動時に `yarn build && exec yarn start` を実行する。build失敗時のrestartループを監視し、失敗したまま公開しない。

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --pull next
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop next
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --no-deps next \
  yarn install --frozen-lockfile --non-interactive
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --no-deps next \
  node -e 'const assert=require("node:assert/strict"); assert.equal(require("next/package.json").version,"15.5.28"); assert.equal(require("sharp").versions.sharp,"0.35.5"); const sharp=require("next/dist/server/image-optimizer").getSharp(null); assert.equal(sharp.versions.sharp,"0.35.5"); console.log(process.version,"Next 15.5.28 / sharp 0.35.5 OK")'
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --force-recreate next
```

5. build完了・Ready・コンテナの版を確認。ローカル入口と公開HTTPSの双方でトップ、日英ログイン、背景画像、ランキング、SSG、Next data、匿名認証APIを確認する。専用ユーザーでログイン・投稿を行う場合は [投稿API手順](testing-post-api.md) に従い、対象とcleanupを確定する。Cookie・CSRF値・レスポンス全文は出力しない。
6. 新規buildでは旧画像・ページキャッシュを引き継がないことを確認する。CDNやNginxにHTMLキャッシュを別途持つ場合は、その実構成を確認して対象だけ失効する。稼働中に `.next` を削除しない。

切戻しはNextを停止し、退避した旧コード・旧lock・対応する依存とbuildを一組で戻して再起動する。共有node_modulesを新旧で混ぜない。DB巻戻しは不要。旧Next 14への切戻しはセキュリティ更新の撤回になるため、限定した復旧措置として修正版への再反映を計画する。

## 事前ビルド済み成果物による切替

本番のメモリが小さい場合は、既存Nextを稼働させたまま候補を分離して準備する。`docker-compose.next-prebuilt.yml` は、この方式でbuild済み成果物を `yarn start` するための追加設定。通常の本番overrideの起動時build方式は引き続き利用できる。

1. 本番ソースの追跡ファイルを候補へコピーする。実在の環境ファイルは候補ソースやイメージへ含めない。今回のpackage・lock・Dockerfileだけを適用し、本番と同じOS・CPU・Nodeでfrozen installと、環境ファイルを渡さないNodeテストを行う。
2. 本番内でbuildする場合、必要な既存環境ファイルを読み取り専用でmountする。別ホストでbuildする場合は同じイメージ・CPU・Node・コンテナ内作業パスを使い、公開ビルド設定だけを引き継ぐ。秘密値は転送しない。メモリ・swap・CPUを制限し、build workerは1に絞る。
3. 完了した `.next`、`node_modules`、生成Prisma clientを一組として確認する。候補の通常GET応答と、準備中に本番ソースが変わっていないことを確認する。
4. Nextを停止し、既存の依存・build・生成clientを管理者限定の退避先へ移動。検証した候補一式と設定を配置する。既存環境ファイルを保持し、候補イメージを本番サービスのイメージ名へ割り当てる。
5. 次の追加設定でNextだけを再作成し、Ready・実バージョン・公開ページ・画像・匿名認証APIを確認する。別サービスの再作成やDB migration / seedは行わない。

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  -f docker-compose.next-prebuilt.yml up -d --no-deps --no-build --force-recreate next
```

この設定での再起動はbuildを行わない。コード・依存が変わる次回配備では対応する成果物を事前に再生成するか、通常方式を選ぶ。失敗時はNextを停止して旧設定・旧依存・旧build・旧生成client・旧イメージを揃えて戻し、旧buildをstartする。

## 2026-10-24の本番反映結果

ユーザーの明示依頼により **19:55:21 JSTに反映完了**。Next.js **15.5.28**、実際に読み込むsharp **0.35.5**、Node.js **22.23.4**、Linux x64 / Alpine muslを稼働プロセスで確認した。

- 本番のpackage・lock・Dockerfileは、初回検証の基準と一致していた。実稼働はNext 14.2.24・React 18.2.0・Node 22.23.4。本番のアプリソースを保持し、更新対象3ファイルと追加のprebuilt Compose設定だけを適用した。切替直前にも追跡ソースの一致を確認した。
- 本番x64でfrozen installとNodeテストを実施：39成功・2スキップ。実ユーザー環境をテストへ渡していない。
- 本番内の事前buildは384MiB、続く640MiBのヒープ上限で停止した。稼働中Nextは維持した。依存導入完了前に先行したbuildも `prisma: not found` で停止し、順序を揃えて再実行した。
- 最終buildは本番と同一Dockerイメージのx64環境をローカルで再現して実施。公開される計測IDだけを形式検証して引き継ぎ、DB URLはダミー値とした。本番の環境ファイル・認証情報は転送していない。Nodeテスト39成功・2スキップ、lint・型・25静的ページ・build traceまで成功。
- `.next` と生成Prisma clientを転送し、成果物チェックサム・package・lock・イメージの一致を確認。本番側で導入済みの同じx64依存と組み合わせた。旧公開静的アセット72件を保持し、旧server成果物・ページキャッシュは引き継がなかった。
- 本番と同じCompose環境・既存環境ファイルの読み取り専用mountを使い、localhost限定の候補を起動。トップ・日英ログイン・総合・ステージ・SSGマニュアル・Next data・匿名session・CSRF・hello・WebP画像の正常応答とbuild IDを確認した。
- 旧設定・旧依存・旧build・旧生成client・旧イメージを管理者限定領域に保持。検証成功とソース一致を必須にし、失敗時に旧成果物へ戻す切替スクリプトでNextだけを再作成した。切替処理は **4.6秒**。外部の全リクエストを連続監視した停止時間の測定値とは区別する。
- 稼働コマンドは `yarn start`。起動時の再buildは行わず、再起動回数0を確認。Laravel・scheduler・MySQL・Redisは同じコンテナIDを維持した。PHPの既存差分を保持し、migration / seedは実施していない。
- 公開HTTPSでも各画面・API・画像が200を返し、HTMLとNext dataが新build IDの成果物であることを確認。旧クライアントのmainアセットも200を維持した。
- 公開サイトの未ログイン専用Playwrightブラウザで、日本語1200px表示、英語へのSPA遷移、390px表示を確認。Loading解除・inert解除・背景画像・横はみ出しなしを確認し、観測中のconsole error / warningは0件だった。

本番での実ログイン・multipart投稿、実ユーザーの既存JWTの継続は未検証。認証設定・環境ファイルとNextAuth版は保持した。Git commit / pushは行わず、本番の未コミット差分として反映している。

切戻し情報・成果物は本番ホスト内の非公開管理領域に保持し、公開文書へ接続先・退避先の実値を記載しない。切戻しではNextを止め、旧3設定ファイル・旧依存・旧build・旧生成client・旧イメージを復元して旧buildをstartする。DB巻戻しは不要。

## 開発環境の起動障害と復旧

セキュリティ更新後、ホストで導入した依存をDocker開発コンテナも参照していたため、macOS向けbcryptで `ERR_DLOPEN_FAILED`、esbuildでOS不一致、sharpでLinux用バイナリ不足が発生した。初回更新の検証を分離コピーで行った後、実際の開発コンテナの起動確認が不足していた。

開発専用の `docker-compose.override.yml` を追加し、`node_modules` と既定の `.next` をそれぞれnamed volumeへ分離した。`nocopy: true` によりホスト側の依存・キャッシュを初期コピーせず、Linuxコンテナでfrozen installを実施した。ソースのbind mountは維持するため、通常の編集・HMRを継続できる。本番用の明示的なCompose構成にはこのoverrideが入らないことを確認した。本番への追加反映は行っていない。

既存の開発スタックへこの変更を適用する場合：

```bash
docker compose up -d --no-deps --force-recreate next
docker compose exec -T next yarn install --frozen-lockfile --non-interactive
docker compose exec next yarn dev
```

以後は依存volumeを保持する。初回作成・lock更新後にDocker内でinstallし、devを起動する。明示的な `-f` を使う開発起動では、baseと開発overrideを両方指定する。Docker内で動かす依存をホスト側のinstallで修復しない。

- 成功：bcrypt・sharpのロード、esbuildの実変換、Next 15.5.28 / sharp 0.35.5の照合、Prisma生成とdevのReady。
- 成功：開発コンテナでNodeテスト39件、lint。専用募集DBの2件はスキップ。
- 成功：`http://localhost:3005` のログイン画面、トップ、匿名認証session、背景画像のWebP変換が200。専用依存・出力volumeが実際に使われ、ホストのmacOS用bcryptが維持されていることも確認。
- 初回ブラウザ確認では、Next 15.5.28の開発インジケーターが初期化前のrouterを参照する `isrManifest` 警告を観測した。`devIndicators: false` で補助表示を無効にした。コンパイル・実行時エラーの表示は維持される。[公式設定](https://nextjs.org/docs/pages/api-reference/config/next-config-js/devIndicators)。
- 成功：一時ページの表示変更が、ページ全体の再読込なしにHMRで反映された。検証用ページは削除した。PC・390pxのブラウザでLoading解除、inert解除、背景画像、横はみ出しなしを確認し、対処後のconsole error / warningは0件だった。
- バージョン確認の初回probeは `sharp/package.json` の非公開exportsで失敗したため、公開API `sharp.versions.sharp` に修正して成功を確認した。上記の本番手順の照合コマンドも同じAPIへ統一した。
- 未実施：実ログイン・投稿、DB migration / seed、追加の本番操作。開発修復はComposeの分離と依存再導入で行い、アプリの認証処理やDB schemaは変更していない。
