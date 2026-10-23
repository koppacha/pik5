# 年別記録ページ

実装日：2026-10-19。ローカル実装・検証済み。本番反映・commitは行っていない。

## 表示契約

- URLは `/date/2026` の形式。2014年からJSTの現在年までの4桁整数だけを受け付け、未来年・2013年以前・不正値は404にする。
- サイト内記録は既存ステージランキングと同じ自己ベスト（同点は先着）を、締切以前の公開可能な投稿から選ぶ。全ステージ横断でもステージ・実体ルールを分離する。操作方法・難易度は既存の「すべて」と同じ統合条件。
- 過去年の締切は翌年1月1日未満。当年は取得開始時の現在時刻まで。年判定はAsia/Tokyo。
- 順位・RPは前年以前の参加者を含む母集団で計算する。その後、2015年以降はその年の投稿だけに限定する。2014年は投稿日時の下限なし。
- カテゴリは通常・特殊・期間限定・RTA。通常を初期選択し、記録がないカテゴリは隠す。通常自体が空なら最初の存在カテゴリへ移る。
- 通常の対象ルールは `10,20,21,22,30,31,32,33,36,40,41,42,43,48`。大会・大会カード・期間限定ステージは期間限定へ、それ以外の2P・TAS・実機無差別・その他rule91等も特殊へ含め、未分類のまま落とさない。
- 初期フィルターは動画あり。動画を外しても自己ベスト・順位・RPは変えない。動画なしの自己ベストを、動画ありの旧記録へ差し替えない。カテゴリ有無は動画条件の適用前に判断する。
- サイト内記録はカテゴリ内でRP降順、同点なら投稿日・post_id順。100件ずつ段階描画し、すべての記録へ到達できる。
- `flg=2` の再編集・削除行を過去年へ復元しない。この点も既存ステージランキングと共通。履歴DBの新設や書込経路の変更は行っていない。

## RTA

- 正本は `next/lib/const.js::speedrunStageConfigs`。既存speedrunページで扱う17種目・機種別game/category/variablesを共用する。31Xも含む。
- `GET /runs` を最大200件ずつ全ページ取得する。同一game/categoryの機種差分は取得を共有し、同時取得は3系統まで。現在のleaderboardsから過去年を推定しない。
- 投稿年はsubmittedのJST日時で判定。実施日dateは使わない。投稿日時不明の記録には固定日を補わず、除外件数をRTA表示時に示す。
- verifiedのみを使い、判明しているverify-dateが締切後なら除く。NG+や定義外のvariables・カテゴリ・個別ステージ記録も除く。
- 種目・機種・プレイヤー構成ごとの自己ベストを締切以前の履歴から選び、年内投稿だけを表示する。ゲスト・複数走者も表示する。
- 種目別に既存speedrunページと同じrealtime_t昇順（欠落時primary_t）。同点は1,1,3。RPは導入しない。
- サイト内一覧のSSR後に専用APIから取得する。障害時は通常一覧を維持し、RTAの警告と再試行を表示する。外部の承認取消・削除履歴を含めた過去状態の完全復元は行わない。

## 実装とキャッシュ

| 処理 | 入口・保存先 |
| --- | --- |
| ページ・年の選択 | `next/pages/date/[year].js`。SSR、private/no-store。フッターから当年へリンク |
| サイト内データ | Laravel `GET /api/date/{year}`、`YearRecords` サービス |
| 自己ベスト選別 | `StageRecordRanking::best()`。既存RecordControllerのステージ取得と共用 |
| 順位・RP | 既存Funcの方向・式を共用。年別は最大参加者数を条件別にまとめて渡し、行ごとのSQLを避ける |
| サイト内キャッシュ | Laravel標準Cache。過去年30日、当年はキャッシュしない。公開中大会集合・公開済みダンドリID・仕様版でキーを分離。生成をロック |
| RTA API | Next `GET /api/date/rta/{year}`。当年10分、過去年30日 |
| RTAキャッシュ | `next/.cache/year-records/` のJSON。仕様版・年・種目定義のハッシュで分離。プロセス間ロック・処理共有・一時ファイルからの原子的置換 |

LaravelのCacheは配備済みの `CACHE_DRIVER` を使用する。fileなら `laravel/storage/framework/cache/data/`、redisなら既存のcache接続を使う。RTA保存先は `YEAR_RECORD_CACHE_DIR` で変更可能。プロセス再起動を跨いで利用するため、配備時はこれらの保存先を保持し、NextプロセスがRTA保存先へ書き込めるようにする。

期限切れのRTA更新が失敗した場合は、前回の正常な結果と取得時刻を保持し、画面に警告を表示する。部分取得を正常な全件一覧として保存しない。初回取得が失敗した場合は503を返す。

### 訂正・削除後の明示更新

管理者の認証済みブラウザからNextの `POST /api/date/refresh` に `{"year":"2025"}` を送る。既存のsame-origin/APIアクセストークン検証を通す必要があり、サーバーでPrismaの現行role=10を再確認する。署名付きの既存management経路でLaravel `POST /api/date/{year}/refresh` を呼び、サイト内とRTAの対象年キャッシュを失効する。次の参照時に再取得する。

通常の公開 `POST /api/revalidate?page=date&id=2025` からの更新は403。Laravelへ未署名でrefreshを送っても401となる。秘密値や署名ヘッダーを作業ログへ転記しない。

過去記録の訂正・削除で、後続年度の自己ベスト・順位・RP母集団にも影響する場合は、表示開始年から現在年までの影響年度も更新する。自動で履歴全年度を再集計する投稿処理は追加していない。

## 2026-10-19の検証

- 成功：コンテナ内 `./vendor/bin/phpunit --do-not-cache-result --filter 'YearRecordTest|TopRecordTest|ScoreOrderTest|TrickRecordVisibilityTest|UserTotalControllerTest'`。SQLiteインメモリ・合成データ、26件・183 assertions。年境界、既存APIとのRP一致、通常／特殊／期間限定、同点・0、動画なしの最良記録、現在時刻、長期キャッシュ失効、署名付き管理者、公開前・公開時刻ちょうどのルール48、大会公開後のキャッシュ切替を含む。
- 成功：ホスト `node --test next/tests/yearRecords.test.mjs`。9件。RTA履歴ページング・重複・variables・投稿時刻・承認・ゲスト・動画・部分失敗・永続キャッシュを検証。
- 成功：変更したNextページ・API・共通行・フッター・サーバーモジュールの `next lint --file ...`。
- 成功：Nextコンテナで `NEXT_DIST_DIR=.next-year-build yarn build`。既存devの出力と分離。ルート生成まで完了。
- 成功：Playwrightで実RTA APIの2025年取得と表示、当年のカテゴリ切替、動画あり／すべて、対象年付きリンク、PC・390px、ライト／ダーク・英語版、ページとRTA APIの不正年404、RTA障害からの再試行・空カテゴリ非表示、hydration警告なし、Next更新APIの未認証403。
- 成功：ブラウザ内の合成RTA応答で205件の段階描画と動画あり103件の表示、例外なしを確認。
- 未実施：本番反映、本番データ件数での負荷測定、専用MySQLでの追加性能計測、認証済みの実管理者によるNext更新APIの操作。DB migration・seedは実行していない。

初回の大会表示型テストでDeckのデフォルトpointsとStageのtimeが食い違うケースを検出し、既存表示と同じStage定義を使用するよう修正した。最終の関係テストは上記件数がすべて成功。Next更新APIの未認証確認では、既存のアクセス検証関数がfalseを返すだけのため応答が完了しない不具合を検出し、明示的な403応答へ修正した。修正後は対象APIのlintと実HTTP応答を再検証した。ブラウザ確認スクリプトのモバイル上の非表示テーマボタン選択と相対URL指定は、PCでのテーマ操作・絶対URLに修正して再確認した。

検証ツールのタイムアウト出力に専用ブラウザの認証関連Cookieが含まれた。値は本書・ソース・transcriptへ転記せず、以後はエラー詳細を抑制した。検証終了時に専用ブラウザのCookieを値を読み取らず消去した。実在ユーザーの認証情報をテストへ流用していない。

画像：`output/playwright/yearly-rta-desktop.png`、`yearly-events-desktop.png`、`yearly-events-mobile-dark.png`、`yearly-events-mobile-light.png`。

## 開発環境の記録復元

既存の `RecordCsvSeeder` は全件truncateするため、既存の投稿・大会リンクを保持する復旧には使わない。差分復旧には次を実行する。

```bash
docker compose exec -T laravel php artisan db:seed --class=RestoreRecordCsvSeeder
```

`RestoreRecordCsvSeeder` は開発環境専用。`database/seeders/data/records.csv` にある公開IDがDBに存在する場合は既存記録を保持し、未登録の公開IDだけを投入する。同じ公開IDを持つCSV内の履歴はまとめて保持する。内部post_idはDBに採番させ、ローカルの既存投稿・大会リンクと衝突させない。

投稿日・更新日はCSVの日時を保持する。既存・新規とも難易度が未設定なら、既存migrationと同じ `console=3 → difficulty=3`、その他は2で補完する。既存の非NULL難易度・スコア・削除状態・日時は変更しない。追加と補完はtransactionで行い、入力不正・SQL失敗時はrollbackする。

新規投入する項目は公開記録の列に限定する。アクセス元・user_agent・非公開メモ・未知の列は取り込まない。ユーザー・認証データのSeederは実行しない。完了後に年別キャッシュを失効させる。

現行CSVの投稿期間は2006～2024年。2025年以降のサイト内記録を新たに復旧するには別の復元資料が必要。RTAは従来どおりspeedrun.comから取得する。

## 共通Recordによる表示

通常・特殊・期間限定・RTAの行はすべて `next/components/record/Record.js` を使用する。`YearRecordList` はデータ変換と種目見出しだけを担当し、独自の行レイアウトを持たない。

Recordの任意props `stageHref` / `stageLabel` は年付きステージリンクとRTAの種目リンクを指定する。`userEntries` は複数走者・ゲスト、`detailHref` はspeedrun.comの記録詳細、`showRankPoints=false` はRPを持たないRTAに使う。RTAのミリ秒表示には `scoreText`、通常記録の0表示には `showZeroScore` を使う。未指定時の他ページの表示は従来どおり。

## 2026-10-20の復旧・表示確認

- 開発DBに不足30件を追加し、既存18,263件のNULL難易度を補完。最終のrecordsは18,329件。既存行の削除・公開IDの変更は行っていない。
- 完了後のSeeder再実行は追加0件・難易度補完0件。年別APIは2014～2024年の全年度で記録を返す。
- 2020年の動画フィルター前の内訳は通常1,090件、特殊179件、期間限定916件。2025年は復元元にサイト内記録がないため0件。2026年の既存ローカル記録は保持。
- 成功：関連Laravelテスト29件・199 assertions（追加Seederテスト3件を含む）。新規投入・公開ID重複の履歴・再実行・既存値保持・NULL補完・内部ID衝突回避・500件投入後の不正行によるrollbackを検証。
- 成功：Nodeテスト11件（年別9件＋RTA表示変換2件）、変更Nextファイルのlint、隔離出力先 `.next-year-build` でのbuild。
- 成功：Playwrightで復元済み2020年の共通Record、動画条件、カテゴリ切替、年付きリンク、RTAのRP非表示・種目リンク、PC／390pxを確認。独自article行がないこと・表示例外がないことも確認。既存ステージページのRP表示、英語版、合成RTAでの複数走者・ゲスト・ミリ秒表示も確認した。
- 画像：`output/playwright/yearly-record-shared-desktop.png`、`yearly-record-shared-mobile.png`、`yearly-rta-shared-desktop.png`、`yearly-rta-shared-mobile.png`。
- 本番反映・DB migration・認証データ投入は未実施。
