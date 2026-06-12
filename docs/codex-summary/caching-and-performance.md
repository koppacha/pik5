# Caching And Performance

## Users Cache

- Prisma `user.findMany` は `next/lib/usersCache.js` に集約する。
- TTL は1時間。
- `getCachedUsers()` は通常のユーザー一覧、`getCachedUsersWithRole()` は role が必要な場合。
- 大量ページの `getStaticProps` で個別に `prisma.user.findMany` しない。
- `addName2posts()` の `users.find()` は大規模ランキングでボトルネックになり得る。必要なら userId -> user の Map を使う。

## Dashboard Summary

- 簡易版ダッシュボードには Laravel 側に専用 `dashboard-summary` API を追加する方針。
- ユーザーページの「総合ランキング / ライバルリスト」は `/api/user/rank/0` 経由で `totals` キャッシュを読む。`user:fetch-totals --latest` を日次実行して全ユーザー分を更新し、引数なしの月次スナップショット処理と混同しない。
- 詳細版ダッシュボードは既存のカテゴリ別総合点表示を維持し、`simple=true` 分岐だけを変更する。
- 詳細版ダッシュボードの操作方法別総合点セルは、当該シリーズでユーザーの投稿操作方法が2種類以上ある場合だけ表示する。1種類だけの場合はタイトル別総合点セルと重複するため省略する。
- おすすめステージはユーザー別に1時間キャッシュする。
- ただし候補ステージをキャッシュしても、返却直前に現在の自己ベストを再取得して `score` を付与する。キャッシュ中に投稿しても「未投稿」のまま残らないようにする。
- おすすめロジック変更時はキャッシュキーを更新し、旧ロジックの1時間キャッシュが残らないようにする。

## おすすめステージ選出

- `total_snapshots` で前年比ランクポイント差分を計算する。
- 全総合、通常総合、特殊総合、全総合に加算されないルールIDは除外する。
- 集約ルール `20/30/40` はおすすめ計算から除外し、実体ルールを使う。
- 現行方針では「前年比ランクポイント差分がもっとも多いルール」を優先する。
- 前年データが存在するルールだけを比較対象にする。
- 成長ルールから候補5件を作れない場合は、最後に投稿した記録のルールへフォールバックする。
- フォールバックでは同じルール内に未投稿ステージがあればランダム選出し、なければ自己ベストが古い順に選ぶ。
- 最新投稿の対象は `stage_id < 1000` の通常ステージに絞る。

## 新着通知

- `/api/new` は `NewRecordController`。期間限定 `stage_id >= 1000` は除外。
- 通知では `after_post_id` と `limit` に対応する。
- 通知文に必要な `user_name` は API で返せるようにする。
- 同一ユーザーの再通知は120分抑止。
- 通知全体は1分に1回まで。
- 抑止中に複数件あれば「ほかN件」でまとめる。
- 抑止状態は `localStorage` ベースで保持可能。

## トップページ API / 外部取得

- YouTube ID は11文字形式で検証し、不正IDは候補から除外する。
- 取得できない動画は即時スキップする。
- キーワード記事の抜粋本文はプレーンテキストとして表示し、画像は除外、改行は無視、末尾に `...` を付ける。
- Discord API では「取得失敗」と「イベント0件」を区別する。0件なら「予定されているイベントはありません。」等の空表示にする。
- 月別 MVP と最近のトレンドは、投稿がない月をスキップしながら直近12件/12ヶ月分を揃える仕様がある。

## PageSpeed / Core Web Vitals

- 2026-05-28 時点の本番トップページは `getServerSideProps` のため HTML が `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` で返る。
- 本番トップページ HTML は約 770KB あり、`__NEXT_DATA__` に `users` 全件が直埋めされている。初期表示で不要なユーザー一覧は SSR props から外し、検索や通知など必要箇所で `/api/users` 取得へ寄せる方針。
- `TrendRanking` は SWR ローディング時の空セルから実データセルへ差し替えるため、`CellBox` の高さがコンテンツ依存だと CLS の主因になり得る。トレンド用セルに `min-height`、行高、アイコン行の予約領域を持たせる。
- `_document.js` の Google Fonts は family/weight が多く、`fonts.gstatic.com` への多数リクエストにつながる。使用箇所を棚卸しし、必要な family/weight のみに削減する。
- LCP 改善では、フォント削減、トップページ HTML/props 削減、Above the fold の SWR 依存コンテンツの SSR/ISR 化、YouTube iframe 等の遅延読み込みを優先する。
- 2026-05-28 に `TrendRanking` 専用の `TrendCellBox` で高さ予約を追加し、Google Fonts 外部 `<link>` を削除して `next/font/google` self-host 化へ変更した。
- トップページの `users` SSR props 削減は、検索モーダル、通知、動画、ランキング名解決にまたがるため軽微ではない。実施する場合は各コンポーネントのユーザー解決方法をまとめて設計する。
- PageSpeed の forced reflow 指摘で `_next/static` chunk が表示される場合、まず chunk 位置情報でありキャッシュ自体が原因とは限らない。現状コード上は初期ロードで明確に同期レイアウトを強制する箇所は未特定。

## SEO / AI Search

- `stage/[...stage].js` と `total/[...series].js` は 2026-05-28 時点で `SeoHead` ではなく `Head` の title のみを使っている。ページ固有 description、JSON-LD、OG title/description を補う余地が大きい。
- 主要総合ページ（例: `/total/20`）には「ピクミン2 チャレンジモード」「総合ランキング」「全ステージ集計」「世界記録」など、検索意図を自然文で説明する本文ブロックを追加する方針。
- `locale` の `info` はルール注意だけでなく、各カテゴリ/ステージの一次ソース説明として拡充できる。ただしヘッダーに長文を出しすぎず、概要・集計対象・採点方法・対象ステージ数・更新頻度・投稿検証方針を構造化して表示する。
- sitemap は静的で主要ページのみ。ステージページ、総合ページの派生、キーワード記事、英語 alternate を動的生成する余地がある。

## 負荷注意

- `EventResultController` の `event_results` 全件ロード + PHP 集計は、件数が増えると ISR 生成時の負荷要因になる。
- `latestBattleScores()` の `battles` 全件取得 + `unique('user_id')` はカテゴリ241でボトルネックになり得る。
- 重い再計算は表示リクエスト時に走らせず、保存済み結果や短時間キャッシュへ寄せる。
