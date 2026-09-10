"""Render the reward study JSON as reproducible Markdown tables."""
import json
from pathlib import Path

DIRECTORY = Path(__file__).resolve().parent
data = json.loads((DIRECTORY / "tricks-reward-suppression-results.json").read_text())
groups = data["aggregate"]
for group in groups.values():
    assert abs(sum(h["rewards"] for h in group["hourly"]) - group["economy"]["collection_rewards"]) < 1e-8
    assert sum(b["reward"] for b in group["difficulty"].values()) == group["total_rewards"]
    assert abs(sum(h["field"] for h in group["hourly"]) / 48 - group["mean_field"]) < 1e-8
names = {"current": "現行", "a0_b075": "a0/b0.75", "a2_b1": "a2/b1",
         "a1_b075": "a1/b0.75", "a2_b075": "a2/b0.75（提案）", "a3_b075": "a3/b0.75",
         "a2_b05": "a2/b0.5", "a2_b075_keep_single": "a2/b0.75・単独維持"}
lines = ["# 還元ポイント抑制シミュレーション（2026-09-09）", "",
         "## 結論", "",
         "a=2,b=0.75は、総還元を35.1%、時間平均所持Pを28.9%抑える一方、場札数7.6%、テイク数9.2%の減少を伴った。"
         "空場時間は48時間あたり295.02分から315.27分（+20.25分）へ増加。循環停止には至らないが、軽微とは言い切れない抑制である。",
         "",
         "循環をなるべく維持してポイントを適度に抑える目的にはa=1,b=0.75が第一候補。"
         "還元21.7%減、場札3.9%減、テイク5.4%減、空場+11.70分で、枯渇は100試行中0。"
         "ただし0件の候補間で枯渇耐性の優劣は断定できない。より強い減額（a=3またはb=0.5）は今回の目的には過剰寄り。",
         "",
         "a=2,b=0.75で単独投稿だけ従来還元を維持すると、還元28.5%減、場札5.5%減、空場+6.82分。"
         "単独稼働時の循環を保ちたい場合の別候補になるが、単独投稿を選好する新しい戦略への耐性までは検証していない。",
         "",
         "減少は終盤に強い。提案の42〜48時間の平均場札は5.691枚から4.724枚（17.0%減）、"
         "47〜48時間単独では9.442枚から7.067枚（25.2%減）。前半0〜6時間は5.015枚から5.040枚でほぼ同じ。"
         "還元削減の累積で後半の再投資が減るという解釈と整合するが、終盤テイク促進処理の仮定にも依存する。",
         "",
         "現行の枯渇5回はいずれも45時間以降。開始時の拘束137〜153枚と回収済み本体47〜63枚が合計200枚になった。"
         "拘束だけが200枚近くになる現象ではない。aだけを0のままb=0.75にしても1試行で2回発生した。",
         "",
         "a=2,b=0.5の難易度5平均10.872Pは現行10.681Pを上回るが、同じカード条件で還元が増えたわけではない。"
         "再実行で対象が47枚から39枚へ変わり、平均支払いが2.191Pから3.949P、平均投稿者が2.532人から3.385人に増えた。"
         "少数標本と構成変化によるため、集計平均はパラメータに対して単調にならない。",
         "",
         "## 条件・集計定義", "",
         "48時間・最大16人・200枚、全ケースk=2（必要スタック=3+floor(累計テイク数/2)）。"
         "各100試行、同じseed 278000〜278099で比較した。以下の現行とは「k=2で還元式だけ現行」の意味。",
         "",
         "Sは場札本体を含むスタック、Pは当該札への実支払い合計、Dは難易度。"
         "2人以上投稿の提案式はS−a+round(P×b)+D×floor((S+P)/5)。難易度ボーナスの基準は減額前。"
         "roundは0.5切り上げ。無投稿は0P、1人投稿はS−a+round(P×b)（単独維持ケースのみS+P）。"
         "実際の分配額と行動評価の予想報酬をともに変更して再実行した。",
         "",
         "場札数・全員所持Pは状態変更前の値を実時間で積分した。"
         "枯渇は山札と捨て札が両方0となる正の長さの連続区間。同時刻の一瞬の中間状態は含まない。"
         "回数はドロー要求数ではない。難易度別平均の分母には無投稿で0Pの回収も含む。",
         "",
         "## 全体結果", "",
         "金額・時間・枚数は特記以外1大会あたりの平均。上限時間は参加済み2人以上で場札数が参加済み人数−1に達した時間。", "",
         "| 条件 | 総還元P | 100大会還元P合計 | 平均場札 | テイク数 | 空場分 | 上限分 | 枯渇試行/100 | 枯渇延べ回数 | 枯渇分/大会 | 最大拘束枚数 |",
         "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|"]
for key, g in groups.items():
    lines.append(f"| {names[key]} | {g['economy']['collection_rewards']:.2f} | {g['total_rewards']} | {g['mean_field']:.3f} | {g['takes']:.2f} | {g['empty_minutes']:.2f} | {g['cap_minutes']:.2f} | {g['shortage_runs']} | {g['shortage_episodes']} | {g['shortage_minutes_per_event']:.3f} | {g['maximum_locked']} |")
lines += ["", "## ポイント収支", "",
          "全員所持Pは活動していない参加者も含む。終了時残高は48時間の強制回収後。参加時発行は各大会200P。",
          "収支は200＋給付＋回収還元−ドロー−投稿−返却＝終了時残高。", "",
          "| 条件 | 時間平均全員所持P | 終了時全員P | 給付P | ドロー支出P | 投稿支出P | 返却支出P |",
          "|---|---:|---:|---:|---:|---:|---:|"]
for key, g in groups.items():
    e = g["economy"]
    lines.append(f"| {names[key]} | {g['mean_points']:.2f} | {e['ending_points']:.2f} | {e['subsidy_payments']:.2f} | {e['draw_costs']:.2f} | {e['post_fees']:.2f} | {e['return_costs']:.2f} |")
lines += ["", "## 難易度別：1枚あたり平均還元P", "", "| 条件 | 難易度1 | 難易度2 | 難易度3 | 難易度4 | 難易度5 |", "|---|---:|---:|---:|---:|---:|"]
for key, g in groups.items():
    lines.append("| " + names[key] + " | " + " | ".join(f"{g['difficulty'][str(d)]['average_reward']:.3f}" for d in range(1, 6)) + " |")
lines += ["", "### 難易度別の枚数・還元総額と構成", "",
          "枚数と還元Pは100大会合計。他の平均は回収カード1枚あたり。", "",
          "| 条件 | 難易度 | 回収枚数 | 還元P合計 | 平均スタック | 平均投稿者数 | 平均支払いP |", "|---|---:|---:|---:|---:|---:|---:|"]
for key, g in groups.items():
    for d, b in g["difficulty"].items():
        lines.append(f"| {names[key]} | {d} | {b['cards']} | {b['reward']} | {b['average_stack']:.3f} | {b['average_participants']:.3f} | {b['average_paid']:.3f} |")
for title, metric, unit in (("時間ごとの平均場札数", "field", "枚"),
                            ("時間ごとの総還元ポイント", "rewards", "P/大会"),
                            ("時間ごとの全員所持ポイント", "points", "P")):
    lines += ["", "## " + title, "", f"単位：{unit}。経過時間で区切る。", "",
              "| 経過時間 | " + " | ".join(names[k] for k in groups) + " |",
              "|---|" + "---:|" * len(groups)]
    for h in range(48):
        lines.append(f"| {h}〜{h+1}h | " + " | ".join(f"{g['hourly'][h][metric]:.3f}" for g in groups.values()) + " |")
lines += ["", "## 枯渇の全発生区間", "",
          "拘束=全員の手札＋場札本体＋場札のスタック。回収済み本体はイベント中に再利用されず別枠。"
          "枯渇開始時は拘束＋回収済み=200。", "",
          "| 条件 | seed | 開始時刻h | 継続分 | 開始時拘束 | 開始時回収済み |", "|---|---:|---:|---:|---:|---:|"]
for r in data["rows"]:
    for s in r["shortages"]:
        lines.append(f"| {names[r['policy']]} | {r['seed']} | {s['start_hour']:.4f} | {s['minutes']:.3f} | {s['locked']} | {s['retired']} |")
lines += ["", "## 対照との差：同一seedペアの平均と参考95%信頼区間", "",
          "各セルは差の平均［下限, 上限］。100ペア、t≈1.984、独立大会を仮定した平均差の区間。多重比較補正なし。", "",
          "| 条件 | 平均場札数 | 空場分 | テイク数 | 総還元P | 終了時P |", "|---|---:|---:|---:|---:|---:|"]
for key, g in groups.items():
    if key == "current":
        continue
    cells = []
    for metric in ("mean_field", "empty_minutes", "takes", "collection_rewards", "ending_points"):
        mean, low, high = g["paired_difference_95ci"][metric]
        cells.append(f"{mean:+.3f} [{low:+.3f}, {high:+.3f}]")
    lines.append("| " + names[key] + " | " + " | ".join(cells) + " |")
lines += ["", "## 検証と限界", "",
          "- 丸め境界・単独/複数投稿の式・時間加重・枯渇区間の結合と分離をテストした。2seedで観測器付き対照と元シミュレーターの全サマリー（出力先時刻を除く）が一致。",
          "- 全800試行で各イベントのカード200枚保存、回収ごとの分配総額、終了時のポイント収支、不変条件を検証し、違反0。",
          "- 対照100試行は前回難易度別集計と回収枚数・還元Pが全難易度で一致（計5,677枚・56,751P）。毎時還元の和と大会還元、難易度別還元の和も照合した。",
          "- 同一seedでも行動が分岐すると乱数の消費順序が変わるため、完全に同じ行動列に対する差ではない。人物・初期カード・参加予定を揃えた再シミュレーション。",
          "- 100試行で枯渇0件でも発生しない保証はなく、独立試行なら真の発生率の片側95%上限は約3%。難易度5は少数標本。",
          "- 既存モデルの終了直前テイク促進処理（非活動者にも判定）と48時間時点の強制回収を維持。47〜48時間の還元にはこの終了時回収が含まれる。終盤の山と終了残高はこの仮定に影響される。",
          "- 性格・活動予定・練習と返却戦略は既存モデルのまま。新還元に特化した最適戦略を学習するモデルではない。価格は固定であり、ここでのインフレ/デフレ評価はポイント供給量・残高・行動量の変化を指す。",
          "- 本番ルール・API・UIは変更していない。",
          "", "## 再現", "", "```sh", "python3 docs/studies/tricks-reward-suppression-study.py",
          "python3 docs/studies/tricks-reward-suppression-report.py", "```", "",
          f"基礎シミュレーターSHA256: `{data['source_sha256']}`", "",
          f"実験スクリプトSHA256: `{data['script_sha256']}`", ""]
(DIRECTORY / "tricks-reward-suppression-report.md").write_text("\n".join(lines))
print("report saved")
