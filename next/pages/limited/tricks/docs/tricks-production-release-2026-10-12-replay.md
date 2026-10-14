# 2026-10-12 リプレイ・次回ルール募集の本番反映

## ユーザー指示サマリー

これまでの変更をすべて本番へ反映し、開催前に投稿された募集ルールをすべて削除して「現在の応募総数：0」を確認する。

## 作業結果

- 本番`/var/www/pik5`の`limited-trick`を`64935e37`から`7fa2629f`へfast-forward。masterへのmergeなし。今回のリプレイ・ヘッダー・最終リザルト・応募フォーム・登録方法と関連テストの31ファイルを選択コミット。別作業の仕様書・シミュレーション差分は保持。
- リプレイの193チェックポイントと2,272コマ（初期盤面を含む）を非公開の`laravel/storage/app/tricks/replay/261009`へ配備。配備用アーカイブは`backups/tricks/261009-replay-v1-20261012.tar.gz`、ローカル／本番SHA-256一致。画像の新規配信・大会再初期化・migration・Seederなし。
- 本番全DBのフルバックアップを`backups/mysql/replay-release-20261012/all-databases-before.sql.gz`へ保存し、gzip整合性を確認。ディレクトリ0700・ファイル0600。
- Next側の募集DBで有効応募221件、すべて開催開始（2026/10/09 20:00 JST＝2026/10/09 11:00 UTC）より前の作成、開始以後0件を確認。Laravel既定DBとは異なるためNextの既存Prisma接続を使用。
- 件数221・リビジョン一致のガード付きトランザクションで、対象の旧行のcurrentKeyをNULLにし、hidden=true・revision+1の新しい現行行を追加。旧本文・作成者・作成日時を保持し、editorIdは`system:next-event-reset`。開催以後の応募が出現した場合や競合時はロールバックする処理で実施。最終確認は有効応募0件・リセット履歴221件。
- Nextのみ停止・再作成。本番ビルド180.64秒、起動1,658msで成功。Laravel／scheduler／MySQL／Redisは継続稼働。全5サービスrunning、Next異常再起動0。

## 検証

- LaravelのTricks回帰テスト127件成功（分離DB）。募集の単体・APIモックテスト6件成功、専用DB未指定の統合1件はスキップ。Next lint成功、選択差分のgit diff --check成功。
- 公開API`/api/limited-ideas`がHTTP200・count=0・closesAt=null。本番トップページに「現在の応募総数：0」「募集終了日時：未定」を確認。匿名の作成ボタンは非活性。
- 架空セッションのブラウザ表示のみで、登録方法「スコア」「タイム（タイムアタック）」「タイム（残り時間）」と残り時間の説明を確認。実際の認証・投稿は行わず、既存ユーザーの認証情報は使わない。
- 本番最終リザルト見出し、リプレイ読み込み、193チェックポイント／2,272コマ、前後移動、自動再生、解除リンクを確認。
- 本番の負荷・破棄検証：待機中canvas2枚、DOM862要素で安定、描画呼び出し0・実行アニメーション0、Phaser sleep。高速3シーク後も正常。SPA離脱後canvas0・カードobserver0・visibility listener0。
- 初回ブラウザ検証は既存nginxの2リクエスト/秒・burst20制限で429となった。再取得で応募フォーム表示を確認し、後続の本番検証はブラウザの要求を600ms間隔に調整して実レスポンスで成功。nginx設定は変更していない。

## 留意事項

- 削除は既存応募システムと同じ論理削除。過去の応募履歴と非公開バックアップを保持する。新しい応募は通常どおり受け付けるため、0件確認後にユーザーが投稿すれば件数は増える。
- 次回募集の締切は未指定。日時設定は`next/lib/limitedIdeas.js`、登録方法保存値はscore／time／left。既存timeはタイムアタックとして維持。
- 過去文書の「本番未反映」は当時の状況。本書の本番反映完了結果を優先する。
- 確認画像：`output/playwright/limited-ideas-production-zero.png`、`output/playwright/tricks-replay-production-release.png`（ルートのoutput配下）。
