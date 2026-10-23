# 大会シミュレーターの行動モデル

- 本体は `lab/tricks_rule_simulation.py`。15人の匿名モデルと校正データは `next/pages/limited/tricks/docs/studies/tricks-personality-calibration-261009.json` 等。旧13人・固定5人格を既定とみなさない。
- 実力はカード加重Bradley-Terryとシリーズ補正、試行は独立Gumbel。指定された突出能力や活動時間には実測でない仮定が含まれる。
- 活動時間は実プレイ時間ではなく成功操作の30分枠代理値。Ko / A / T / Ku / Gと中下位各5人を使い、Gは未観測。実大会比較ではGを実測P04へ置換する。
- Aは投稿済み1位を延長せず、未投稿準備延長は許可。Kuの投稿 / 更新は3・4、投稿済み延長は2位以下、未投稿準備延長は4。実測頻度を固定回数へ変換しない。
- 実大会比較は47時間59分・160枚＋途中160枚補充、通常比較は48時間・G参加・補充なし。v19校正とv20施策比較も分ける。
- 全行動・全時点が校正済みとはいえず、下位個人・未観測G・未使用seedでの誤差を保持する。認証情報・内部監査列・実ユーザーID・証拠を研究成果物へ転記しない。
- 再推定 / 比較は機能配下 `docs/scripts/calibrate-tricks-personalities.py` / `compare-tricks-behavior.py`。回帰は `tests/tricks-personalities-test.py` を直接実行する。
