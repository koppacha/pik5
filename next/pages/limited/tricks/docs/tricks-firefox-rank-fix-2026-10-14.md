# Firefoxカード描画・投稿フォーム暫定順位修正（2026-10-14）

## ユーザー指示

以下の不具合について調査し、可能なら修正してください。

- Firefox系でカードコンポーネントを表示したとき、レア度2〜4のカード内部が表示されずにフレームのみが表示される。ミニカードも同様。
- 期間限定チャレンジに投稿するとき、投稿フォームの「暫定順位」が常に1位として表示される。

## 原因と修正

- TricksCardBorder.jsの標準mask/mask-compositeの後にWebKit用指定を置いていた。Firefoxでは後の-webkit-maskが標準マスクを上書きし、計算済みmask-compositeがadd, addになって縁レイヤー全体が不透明になった。標準指定を最後にしてexcludeを維持。共通コンポーネントのためミニカードも修復。
- RecordForm/GetRankは一般公開用record/rankを参照していた。Record::publiclyVisibleは開催中の大会記録を除外するため、上位人数0→1位になる。既存の一般公開条件は維持し、tricks/rank/{stage}/{score}?event_id=...を追加。対象大会・カードの有効な個人最良をTrickRecordServiceから取得し、TrickScoreOrderによる昇降順で入力値を上回る人数+1を返す。同値は上位人数に含めない。不存在の大会・ステージは404。
- RecordFormの表示とバリデーション両方を大会専用APIへ切り替え。初期編集データのtricks_event_idも参照。

## 検証

- next lint: 変更3ファイル成功。
- Laravel TrickTimeScoreTest / TrickRecordVisibilityTest: SQLite :memory:で28件成功。個人最良・得点・経過時間・残り時間・同率・対象不存在・開催中非公開を確認。実ユーザーの認証情報・ローカルDBを使わない。
- Playwright: 既存CLIと既存Firefox間にプロトコル不一致があったため、既存Playwright 1.50.1と対応するFirefox/Chromiumを使用。API全件を合成応答へ差し替え、DB書込なし。
- 両ブラウザで実ページ通常カードU2/R3/E4/L5とミニカードを確認。Firefoxで旧CSSを一時追加して内部消失を再現し、除去後復帰。Chromiumでも標準exclude指定で内部表示を維持。
- 投稿フォーム: 合成順位応答で99入力→3位、200入力→1位。リクエストは大会専用API、event_id付与。
- 静止Canvas: phaserRenderCount=1のまま、phaserLoopSleeping=true、activeRaf=0、activeTimers=0。カード消去後border observed=0、eligible=0、visibilityListeners=0。新規常時ループ・ポーリングなし。

## 画像

- [Firefox修正前](../../../../../output/playwright/tricks-firefox-mask-before.png)
- [Firefox修正後](../../../../../output/playwright/tricks-firefox-mask-fixed.png)
- [Chromium修正後](../../../../../output/playwright/tricks-chromium-mask-fixed.png)

## 反映状態

ローカル修正のみ。commit/push/本番反映なし。フロント変更の反映にはNextの再ビルド、API側にはルートとTrickControllerの反映が必要。DB migrationなし。ルール変更はなく、第19回の確定結果と第20回案は変更しない。
