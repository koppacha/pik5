# 変更全体のレビューと修正（2026-10-05）

## 対象と結果

HEAD 267fbd0fからの作業ツリー差分を対象に、LaravelのAPI・移行・seeders・CSV・テスト、Next.jsの共通ランキングと大会UI、非ログ資料・検証用PHP・画像を横断レビューした。既存の署名付き本人性、管理者認可、同一origin、DB transactionと大会行lockを変更していない。差分から新たに到達できるセキュリティ脆弱性は確認されなかった。

生成された`.playwright-cli/`、session logs、環境値、DBdumpは読取・コミットから除外。ブラウザ状態が意図せずGitへ入らないよう.gitignoreへ追加した。参照のない旧試作SVG4点と今回の一時表示ページを除去し、現行v6 assetsを残した。

## 解消した不具合

1. 旧DBでは列統合前にlegacy移行が必要なのに、後続migrationのdraw_countへINSERTしていた。列未追加なら入力から除外し、後続backfillへ渡す。旧schemaからの順序をテスト。
2. レア度削除前の保全チェックがdeck_idだけだった。旧確定カードは同じ大会・同じ確定レア度を保存済みと確認する。別大会・NULL・不一致を拒否し、新方式未開封NULLは許容。
3. 終了時刻以上の期限でも延長ボタンが有効だった。state flagに期限上限を追加し、APIの非課金拒否と整合。
4. 基底未満の還元が下位優先減額でなかった。正の下位成分を集中減額し、3人4Pの実回収を(4,0,0)へ修正。
5. 場札一覧のwheelがカード本文の全文スクロールを奪った。本文にその方向の余地がある間は本文を優先し、端では一覧へ渡す。
6. コレクタールーム単独表示で全文スクロール・L5白90%・最新カード様式が欠けていた。独立したスタイルを整合。
7. 歴史参加者名辞書が継承キーを拾った。own propertyだけを参照しconstructor/toStringの表示を確認。
8. SSRでFont Awesomeのtitle IDがランダムになりHydration警告が出た。React useIdで安定化し再確認。

現行資料もミニ2px、U2黒、藍色裏面、半透明黒操作、スタック2色、L5白90%に統一し、古い試作の指定は履歴と明記した。

## 検証

- `php artisan test --filter='Trick|EventResultCsvSeederTest'`:75件成功。SQLite :memory:をforce指定した専用テスト。実DBや実在ユーザー認証を使用しない。
- 全変更フロント11ファイルのNext lint:警告・エラーなし。
- Playwright:長文を180pxスクロールしてカードY=190のまま、本文下端では場札Y=-170へ移動。単独collector本文scrollTop=180／scrollHeight528／clientHeight144、L5背景rgba(255,255,255,.9)、foreground z-index1。constructor/toStringが文字列表示、React・Hydration警告なし。
- 直前のUI検査で両テーマ、給付／課税の4通り、非表示アニメーション停止、Phaser待機停止・独自RAF0・監視解放0を確認済み。今回は常時描画や監視を増やしていない。
- 画像: `../output/playwright/tricks-review-collector.png`（Git対象外）。

## セキュリティスキャン記録の補足

Codex Security scan 92e27cca-e30d-4f15-90c0-215c2002580dは修正前snapshotを固定してレビューし、finding0で保存した。最終draftを送信しても途中checkpointの「レビュー進行中」がツール側に残り、生成されたcoverageはpartial表記となった。封印済みの原本は改変していない。本記録は対象全ファイルのレビュー結果と後続修正の検証を補足する。生成ログは明示除外し、実DBの多接続同時実行・全GPU性能は未検査。

ツール実測（4thread集計）:総5,467,347、入力5,451,151、キャッシュ入力5,198,848トークン。Daybreakアクセス未付与は警告済みで、レビューを妨げるものではない。
