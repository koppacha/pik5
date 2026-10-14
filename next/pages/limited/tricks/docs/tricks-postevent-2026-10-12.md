# 第19回大会の事後修正・データ退避（2026-10-12）

## ユーザー指示サマリー

イベント終了を受け、本番の最終リザルト見出し・終了前後メッセージ・証拠動画アイコン・コメント６文字・総還元P順・観戦時オフセットを修正し、今大会の全投稿と大会ログを開発環境へ移行する。ダウンタイム可。

原文：プロジェクトルート `docs/codex-logs/2026-10-12-01a12e99-bc66-7c53-9c16-dd2ad182f7e2.md`。

## 実装・検証

- コミット64935e37（limited-trick）。今回の実装・テスト８ファイルだけをコミットし、元から存在する文書・シミュレーション差分は維持。
- 最終リザルトの見出し、終了前１時間の２行通知、終了時刻以降の「大会は終了しました」を反映。
- 回収APIの確定順位・ポイントは維持。現在の有効記録から、同一ユーザー・同一スコアの証拠動画・画像・コメント・操作方法・記録IDを補完。閉幕後編集の動画をミニランキングへ反映する。
- API・UIとも総還元P降順、同額はstage_id昇順。ミニランキングコメントはUnicode文字単位の先頭６文字。
- 既存ResizeObserverによるheaderBottomを使用し、一覧上端をmax(216, headerBottom+24)へ変更。新しい常時描画・ポーリングは追加しない。
- Laravel Feature/Tricks 122件成功。最終追加アサーション後のTrickClosureTest２件成功。対象Next lint警告・エラーなし、git diff --check成功。
- Playwright合成データ：総還元P順、動画リンク、コメント６文字、終了文言、15人複数行、1024pxリサイズ、観戦解除、390px表示、canvas２枚を確認。終了後state取得は初期２回から増えない。
- 描画計測：2.5秒間のclearRect/fillRect/drawImage呼び出し０回、canvas２枚・DOM649要素とも不変。既存fps制限・sleep・destroy・ResizeObserver.disconnectを維持。
- 終了１時間前・終了ちょうど・終了後の通知境界３ケース成功。

## 大会データ移行

本番から整合したトランザクション内で大会261009に絞ってエクスポート。新旧event列の対応と、関連する投稿履歴も対象にした。ユーザーテーブル・認証情報・セッション・環境変数・アプリ認証ログは移行しない。

| テーブル | 件数 |
| --- | ---: |
| trick_events | 1 |
| decks | 320 |
| players | 15 |
| trick_event_cards | 320 |
| trick_card_payments | 710 |
| trick_collection_rewards | 298 |
| trick_event_records | 432 |
| trick_card_holders | 126 |
| limit_logs | 2270 |
| records | 432 |
| stages | 143 |
| events | 1 |

- 本番退避先：`/var/www/pik5/backups/tricks/261009-final-20261012.json`、`261009-images-20261012.tar.gz`。Git ignore、0600。
- 開発退避先：`backups/tricks/`配下の同名ファイル。JSONと画像アーカイブの転送前後SHA256一致。
- 証拠画像416ファイル、圧縮111MB。開発側`backups/tricks/261009-evidence/img/`へ展開。
- 開発MySQL内の専用DB：`bowsprit_tricks_261009`。12テーブルの全件・全列・JSON値を照合し一致。ユーザー情報へのjoinは元の開発DBを参照するか表示名を別途取得する。
- 通常開発DBは変更していない。変更前大会データも`261009-development-before-20261012.json`へ退避済み。
- 通常開発DBのstage_idに30件衝突し、既存記録からの参照もあるため、既存データを上書きせず専用DBを選択した。開発Web画面は従来DBを使用したまま。分析は専用DBまたはJSONを参照する。
- 本番DBへの書き込み、migration、Seeder、大会再初期化は行わない。外部動画はURLを保存し、動画本体の取得は行わない。

## 本番反映

- 本番HEAD6619df4c、作業ツリーcleanを確認後64935e37へfast-forward。master mergeなし。
- 2026-10-12 14:44:10 JSTからNextを停止・再作成。Laravel/scheduler/MySQL/Redisは継続稼働。
- 本番ビルド179.48秒で成功、Next起動成功、14:47台にHTTP200確認。停止は約３〜４分。全５サービスrunning、Next再起動０回、Git作業ツリーclean。
- 公開Playwright（モックなし・未ログイン）：回収143枚、総還元P降順、終了文言、実データの動画アイコン、観戦時の複数行表示と1024pxリサイズを確認。ユーザー情報最下端493.84pxに対し一覧上端518px、canvas２枚。
- [本番画面](../output/playwright/tricks-postevent-production-20261012.png)。停止中の初回ブラウザ取得は検証失敗、HTTP復旧後に再実行して成功。

- 本番で6.5秒間のcanvas描画０回・stateポーリング０回、ページ離脱後canvas０枚を確認。トップ・ログイン画面HTTP200。
- 正式マニュアルPDF `/limited/tricks/limited_19_manual.pdf` はHTTP200。検証用一時コピー・本番一時スクリプトは削除し、保存済みアーカイブを保持。
