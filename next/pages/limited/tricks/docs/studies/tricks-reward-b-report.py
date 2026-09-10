"""Render the paired a=1, b=0.5 versus b=0.75 experiment."""
import json
import math
import statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent
data = json.loads((HERE / "tricks-reward-b-comparison.json").read_text())
groups = data["aggregate"]
keys = ["a1_b075", "a1_b05"]
metrics = [("総還元P", "collection_rewards"), ("平均場札数", "mean_field"),
           ("テイク数", "takes"), ("初投稿数（更新を除く）", "initial_posts"),
           ("空場時間（分）", "empty_minutes"), ("上限到達時間（分）", "cap_minutes"),
           ("時間平均全員所持P", "mean_points"), ("終了時全員所持P", "ending_points"),
           ("ドロー数・支出P", "draw_costs"), ("投稿支出P", "post_fees"),
           ("返却支出P", "return_costs"), ("給付P", "subsidy_payments")]


def value(row, key):
    return row["economy"][key] if key in row["economy"] else row[key]


lines = ["# a=1固定：b=0.5と0.75の比較", "", "## 結論", "",
         "b=0.5はb=0.75比で還元14.46%減、時間平均残高12.33%減。場札2.77%減、テイク4.74%減、初投稿2.21%減を伴う。"
         "追加のポイント抑制を優先するなら候補になるが、進行を改善する変更ではなく、少し活動量を減らして供給を抑える変更である。",
         "",
         "空場は+2.26分/48時間で、平均差の参考95%区間−4.54〜+9.05分は0を含む。空場の悪化は明確ではない。"
         "上限到達は12.75分減。枯渇はともに0/300で改善とは断定できない。",
         "",
         "両式の難易度ボーナスは減額前S+Pを基準に維持した。bの変更が直接減らすのは支払いPの還元部分のみ。"
         "ただし再投資の減少でドロー・テイク数も減るため、総還元の差には行動変化も含まれる。"
         "丸めにより、支払い1Pなら両方1P還元、支払い2Pならb=.75で2P・b=.5で1Pになる。",
         "", "## 条件", "",
         "48時間・最大16人・200枚・k=2、同一300seed（279000〜279299）で各条件を再実行。"
         "式はS−1+round(P×b)+B。Sは場札本体込みスタック数、Pは実際の投稿支払い合計。"
         "roundは0.5切り上げ。複数投稿のB=難易度×floor((S+P)/5)、単独投稿はB=0。"
         "単独投稿にも同じ減額式を適用、無投稿は0P。実分配と予想報酬をともに変更した。",
         "", "## 1大会あたり平均", "",
         "| 指標 | b=0.75 | b=0.5 | 差 | 相対変化 |", "|---|---:|---:|---:|---:|"]
for label, key in metrics:
    old, new = [value(groups[p], key) for p in keys]
    lines.append(f"| {label} | {old:.3f} | {new:.3f} | {new-old:+.3f} | {(new/old-1)*100:+.2f}% |")
lines += ["", "枯渇は山札と捨て札がともに0になる正の長さの連続区間。同時刻の瞬間的な中間状態を除く。", "",
          "| 指標 | b=0.75 | b=0.5 |", "|---|---:|---:|"]
for label, key in [("枯渇大会数/300", "shortage_runs"), ("枯渇延べ回数", "shortage_episodes"),
                   ("枯渇分/大会", "shortage_minutes_per_event"), ("全試行中最大拘束枚数", "maximum_locked")]:
    lines.append(f"| {label} | {groups[keys[0]][key]} | {groups[keys[1]][key]} |")
lines += ["", "## 難易度別", "", "0P回収を分母に含む。枚数・還元合計は300大会合計。", "",
          "| b | 難易度 | 回収枚数 | 還元P合計 | 平均還元P | 平均スタック | 平均投稿者数 | 平均支払いP |",
          "|---|---:|---:|---:|---:|---:|---:|---:|"]
for key in keys:
    for d, b in groups[key]["difficulty"].items():
        lines.append(f"| {'0.75' if key == keys[0] else '0.5'} | {d} | {b['cards']} | {b['reward']} | {b['average_reward']:.3f} | {b['average_stack']:.3f} | {b['average_participants']:.3f} | {b['average_paid']:.3f} |")
lines += ["", "## 毎時推移", "", "場札と所持Pは時間積分による平均。還元Pはその時間内の合計の大会平均。", "",
          "| 経過h | 場札 b.75 | 場札 b.5 | 還元P b.75 | 還元P b.5 | 全員所持P b.75 | 全員所持P b.5 |",
          "|---|---:|---:|---:|---:|---:|---:|"]
for hour in range(48):
    rows = [groups[k]["hourly"][hour] for k in keys]
    cells = [f"{r[m]:.3f}" for m in ("field", "rewards", "points") for r in rows]
    lines.append(f"| {hour}〜{hour+1} | " + " | ".join(cells) + " |")
lines += ["", "## 同一seedペアの差：参考95%信頼区間", "",
          "b=0.5からb=0.75を引いた差。300ペア、t≈1.968、多重比較補正なし。", "",
          "| 指標 | 平均差 | 下限 | 上限 |", "|---|---:|---:|---:|"]
reference = {r["seed"]: r for r in data["rows"] if r["policy"] == keys[0]}
for label, metric in metrics:
    differences = [value(r, metric) - value(reference[r["seed"]], metric)
                   for r in data["rows"] if r["policy"] == keys[1]]
    mean = statistics.mean(differences)
    margin = 1.968 * statistics.stdev(differences) / math.sqrt(len(differences))
    lines.append(f"| {label} | {mean:+.3f} | {mean-margin:+.3f} | {mean+margin:+.3f} |")
lines += ["", "## 検証・留意点", "",
          "- 600大会でカード200枚の保存、分配合計と式の一致、ポイント収支、不変条件を検証。式の非負・単調性・丸め・観測器の元モデル同値テストも実行。",
          "- 0/300でも枯渇しない保証ではない。独立試行なら発生率の片側95%上限は約1%。",
          "- 同じseedでも行動分岐後の乱数消費順は変わる。新式に特化して最適行動を学習するモデルではない。",
          "- 終了直前テイク促進（非活動者も判定）と48時間強制回収は既存モデルどおり。最後の1時間の還元に終了時回収を含む。",
          "- 価格は固定。インフレ/デフレという表現ではなく、供給・残高・活動量の変化として評価する。",
          "- 本番ルール・API・UIは未変更。",
          "", "## 再現", "", "```sh",
          "python3 docs/studies/tricks-reward-search.py --runs 300 --seed 279000 --policies a1_b075 a1_b05 --output docs/studies/tricks-reward-b-comparison.json",
          "python3 docs/studies/tricks-reward-b-report.py", "```", "",
          f"基礎モデルSHA256: `{data['source_sha256']}`", "",
          f"実験スクリプトSHA256: `{data['script_sha256']}`", ""]
(HERE / "tricks-reward-b-report.md").write_text("\n".join(lines))
print("report saved")
