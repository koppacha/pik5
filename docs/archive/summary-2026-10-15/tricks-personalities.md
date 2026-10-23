> 2026-10-15 整理前のサマリー。過去時点の記録であり、現行方針には使わない。パス表記はリポジトリ直下基準。現行の入口は [docs/README.md](../../README.md)。

# Tricks Personalities

## 2026-10-13 実大会モデルへの更新

- 旧5人格・X/Y階層・13人を撤廃。Ko(P01)/A(P02)/T(P03)/Ku(P05)/G(未観測)＋中位(P06〜10)5人＋下位(P11〜15)5人。内部player_01〜05の表示名はこの順で固定。
- 活動予算はKo20〜24h、A24〜30h、T34〜38h、Ku24〜30h、G12〜24h。中下位は成功操作の30分枠代理値±20%で生成し、遅参・休憩容量を守る。ログに実プレイ時間はなく代理値と明示する。関与札による活動延長は停止。
- 同一札の確定順位545ペアをカード加重Bradley-Terryで推定。全体ridge1、シリーズは全体へridge4。series-aware strength＋独立Gumbel試行、旧固定階層と個別学習倍率を使用しない。
- Kuシリーズ3は未補正0.295955を別保存し、指定の突出能力をKo/Aのseries2最大＋0.9で表現。Gは各seriesの採用最大＋1.25。これらはユーザー指定の仮定で実測ではない。試行時間・学習係数も未観測の仮定。
- Koは叩き台・ドロー・RP、Aは投稿済み札2位以下のホルダー延長優先。Kuの投稿/更新は3/4限定、延長は3かつ2位以下限定。中位下位を低RP順に弱く固定せず、短時間強者も個別ログで保持。
- 原本から認証情報・監査列・実ユーザーID・本文・証拠を転記しない。JSONは匿名個人モデルと数値校正だけ。
- 本体lab/tricks_rule_simulation.py、校正next/pages/limited/tricks/docs/studies/tricks-personality-calibration-261009.json、再推定docs/scripts/calibrate-tricks-personalities.py、記録docs/studies/tricks-personality-model-2026-10-13.md。activity-policy既定empirical、15人固定。正式ルール・本番・DB・Git履歴は未変更。
- 回帰7件、50seed生成、5seed完走＋延長無効1＋ノイズなし1、既存固定チェック、不変条件0。校正JSON再実行一致。Playwright15行8列・390px横はみ出し0・SVG2/canvas0/常時アニメ0/待機DOM更新0。

## 2026-10-13 行動校正v2（上記v1の行動制約を更新）

- ユーザーの追加回答でKuのシリーズ4延長を許可。Kuは投稿/更新3・4限定、投稿済み延長は2位以下、未投稿準備延長は4。Aの未投稿準備延長を許可し、投稿済み1位は延長しない。
- 観測頻度は経過活動時間に応じたソフトな行動評価であり件数固定ではない。試行時間・個別学習倍率を今回校正。初期Bradley-Terry実力と指定活動時間は維持。実測0のKo/T/Ku返却候補を抑制。Ku締切後ドロー実測12回を反映。
- 実大会比較モードは15人、Gを実測P04へ置換、47時間59分、160枚開始＋19時間後160枚補充。補充時刻はリプレイ境界からの推定。通常モデルはG参加・48時間・補充なしで比較結果を混同しない。
- 10seed×6反復、最終未使用20seedで36指標の平均差がmax(実測30%,3件/P)以内。主要8指標の誤差旧共通条件51.13%、同一調整seed最終10.99%、未使用最終9.91%。最終ソースSHA/パラメーターを検証JSONに固定。G通常設定は19.02%、5指標基準外で未解消。
- Kuのドロー/テイク/初投稿は21〜25%少なく、Aの希少返却も差が残る。全seed・時刻・還元/全収入・総合RP・中下位全行動を校正済みとはしない。
- レポートnext/pages/limited/tricks/docs/studies/tricks-behavior-fit-report-2026-10-13.md、パラメーターtricks-behavior-parameters-261009.json、比較docs/scripts/compare-tricks-behavior.py。v1ソースgzipと旧検証JSONを保持。回帰10件、不変条件、Playwright表示確認を通過。正式ルール・本番・DB・Git履歴は未変更。
