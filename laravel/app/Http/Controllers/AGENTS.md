# laravel/app/Http/Controllers

このディレクトリは Laravel 側 API の中心です。Next.js から参照されるランキング取得、投稿処理、集計処理、認証処理が集まっています。以下を優先的に把握してください。

## 重要ファイル

### `RecordController.php`
- 記録 API の中核です。
- 単一記録取得、履歴取得、暫定順位計算、投稿作成・再編集の主要ロジックを持ちます。
- フロントの `RecordForm.js`、`pages/api/server/post.js` と強く結びついています。

### `StageController.php`
- ステージ情報 API です。
- ステージ詳細、検索用一覧、参加者数・投稿数の取得を担当します。
- `pages/stage/[...stage].js` の基礎データ供給元です。

### `TotalController.php`
- 総合ランキング集計の中心です。
- ルールごとの対象ステージ定義、総合ルールへの束ね方、年次フィルタ、順位計算を担います。
- 総合ページやダッシュボードに波及するため、集計仕様の変更影響が大きいファイルです。

### `UserTotalController.php`
- ユーザー別総合成績の集計 API です。
- `TotalController` の結果を基に、ユーザーごとのスコア・RPS・投稿数を再集計し、`totals` テーブルも更新します。
- トップページのダッシュボード表示に直結します。

### `KeywordController.php`
- キーワード・攻略記事・ルール本文を扱う API です。
- 一覧取得、詳細取得、最近更新の解決、記事作成などを担当します。
- `/keyword/*` 系ページやステージページのルール表示に関わります。

### `NewRecordController.php`
- 新着記録一覧の取得を担当するコントローラです。
- トップページの「新記録」表示に関わるため、ホーム更新系の調査で確認対象になります。

### `PostCountController.php`
- 投稿数ランキングの集計 API です。
- トップページの投稿数ランキングの供給元として重要です。

### `HomeController.php`
- Laravel の標準的な認証済みホーム画面用コントローラです。
- API 主体の運用では主役ではありませんが、Web ミドルウェア付きの画面導線が必要なときの起点です。

### `Auth/AuthenticatedSessionController.php`
- Laravel 標準のログイン・ログアウト処理です。
- 現在の主認証は NextAuth 側が中心ですが、Laravel 標準認証を維持する際の基準実装です。

### `Auth/RegisteredUserController.php`
- Laravel 標準のユーザー登録処理です。
- バリデーション、ユーザー作成、登録イベント発火、ログインまでを担当します。
- 認証方式の整理や移行時に確認価値が高いです。
