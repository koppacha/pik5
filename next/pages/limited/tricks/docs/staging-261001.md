# 大会261001 ステージング公開手順

この大会だけパスワードゲートを使う。公開は2026-10-01 20:00〜23:00 JST、ページは2026-10-02 00:00 JST以降404。23:00〜00:00は結果表示を許可する。

1. 本番相当ホストのGit管理外`.env`へ`TRICKS_EVENT_ID=261001`と`TRICKS_TEST_EVENT_PASSWORD`を設定する。パスワード値は配布先以外へ記録しない。`NEXTAUTH_SECRET`と`TRICKS_INTERNAL_SECRET`も設定済みであることを確認する。
2. `limited-trick`をデプロイし、`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`でNext/Laravel/schedulerへ同じ大会IDを渡す。
3. `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec laravel php artisan migrate --force`を実行する。既存の未適用マイグレーションも適用されるので、実行前に対象一覧を確認する。
4. ステージデータ投入後、`docker compose -f docker-compose.yml -f docker-compose.prod.yml exec laravel php artisan db:seed --class=TrickStaging261001Seeder --force`を実行する。既存大会データは上書きせず、再実行は160枚の投入済みを確認して終了する。
5. 未入力・誤入力では大会UIとAPIが閉じ、正しい入力で閲覧できることを確認する。大会時間外の操作、10/2 00:00以降のページ/APIの404も確認する。大会ID、カード160枚、開始・終了日時をDBの非秘密項目で確認する。

## 詳細仕様との照合

- 通常大会の仕様書は48時間大会を前提とする。261001は依頼に従う3時間の例外大会で、20:00〜23:00 JSTとする。
- 既存ルールをそのまま適用すると、終了3時間前のレア度切替は大会開始時から、終了150分前のテイク待機免除は20:30から、テイク・任意延長の締切は22:00から有効になる。この短時間大会用の例外ルールは詳細仕様書に未記載。
- 投稿・回収・給付・順位・ポイント分配・カード循環の実装は、分離DBのトリック機能テスト47件で確認した。期限前の操作拒否、二重処理防止、失敗時ロールバックも対象。
- Phaserは30fps上限で、シーン破棄時のGameObject削除とゲーム破棄、アニメーションの停止処理がある。状態取得は通常3秒、ホルダー情報30秒間隔。今回のゲートでは認証前にPhaser自体を生成しない。

公開先のホスト名、デプロイ手段、Git管理外の環境値はこの文書へ記録しない。masterへはマージしない。
