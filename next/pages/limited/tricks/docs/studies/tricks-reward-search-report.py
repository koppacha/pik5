"""Render exploration and independent confirmation, including paired uncertainty."""
import json
import math
import statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent
search = json.loads((HERE / "tricks-reward-search-results.json").read_text())
confirmation = json.loads((HERE / "tricks-reward-search-confirmation.json").read_text())
names = {"current": "従来還元", "a1_b075": "a1/b0.75（比較基準）", "a0_b05": "a0/b0.5",
         "a1_b09": "a1/b0.9", "a1_b1": "a1/b1", "stack_half": "スタック超過半減",
         "stack_half_p075": "スタック超過半減＋P×0.75", "base4_half": "基礎4P超半減",
         "base6_half": "基礎6P超半減", "base6_quarter": "基礎6P超を25%還元",
         "total6_half": "ボーナス込み6P超半減"}
lines = ["# 還元式の追加探索と独立再検証", "", "## 結論", "",
         "進行維持と約20%の還元抑制のバランスでは「基礎6P超半減」が有力。"
         "推奨候補式は `S+P-floor(max(S+P-6,0)/2)+B`。"
         "これは `min(S+P,6)+round(0.5max(S+P-6,0))+B` と整数入力で等価。"
         "少額の基礎還元を保護し、大きな基礎還元にだけ控除をかける。難易度ボーナスBは削らない。",
         "",
         "独立300試行でa1/b0.75比、場札+1.77%、テイク+2.23%、初投稿+1.71%。"
         "総還元は435.11→451.22P（+3.70%）だが従来式561.97P比では19.71%減。"
         "全員の時間平均所持Pは95.71→98.26P、終了時残高は226.38→229.65Pで増加は小さい。"
         "従来式の時間平均119.16P、終了時296.84Pをともに下回る。",
         "",
         "空場333.30→328.48分、上限到達181.80→181.75分、枯渇は両式0/300。"
         "空場短縮の95%区間は−11.35〜+1.71分で0を含み、短縮効果は断定できない。"
         "場札と初投稿の増加は参考95%区間で0を含まないが、効果量は小さい。"
         "全指標で優越する式ではなく、総還元を少し多く許容して活動を維持するトレードオフである。",
         "",
         "さらに供給を抑えたい場合は「基礎6P超を25%還元」も候補。"
         "還元389.22P（従来比30.74%減）で、初投稿197.89回は基準198.44回に近い。"
         "ただし場札4.003枚、テイク51.74回に減るため、循環優先では半減案を選ぶ。",
         "",
         "a1/b0.9やa1/b1も探索では循環を維持したが、単に抑制を緩める側面が大きい。"
         "スタック超過減額は独立再検証で初投稿が増えた一方、空場短縮を再現しなかった。"
         "ボーナスまで減額する案は高難易度への直接の誘因を弱めるため、基礎部分だけの減額を優先した。",
         "",
         "6Pは最初のテイク3枚＋初投稿料金1〜3P程度を保護する目安で、理論的な最適閾値ではない。"
         "整数丸めにより7Pまで実際の控除は0、8P以降2P増えるごとに1P控除される。"
         "a1/b0.75の約22.6%減を厳密に維持する条件なら、半減案は同水準の抑制とは言えず、現案維持も合理的。",
         "", "### 単独投稿の具体例（B=0）", "",
         "| S | P | ドロー＋投稿支出 | a1/b0.75還元 | 基礎6P超半減の還元 |", "|---:|---:|---:|---:|---:|",
         "| 3 | 1 | 4 | 3 | 4 |", "| 3 | 3 | 6 | 4 | 6 |",
         "| 6 | 4 | 10 | 8 | 8 |", "| 10 | 4 | 14 | 12 | 10 |",
         "", "小さな場の資金を残し、大きいスタックの再投資原資を抑える構造。"
         "1人投稿でも例外扱いせず同じ式を使う。支出例は各カードを1Pでドローした分と当該初投稿料金のみで、返却・給付は除く。",
         "", "## 実験条件", "",
         "48時間・最大16人・200枚・k=2。探索11条件×100seed（278000〜278099）、"
         "独立再検証5条件×300seed（279000〜279299）、計2,600大会。"
         "従来還元とa=1,b=0.75も同じseedで再実行した。探索で選んだ式の評価は独立再検証を主とする。",
         "",
         "S=場札本体込みスタック数、P=実支払い合計、B=難易度×floor((S+P)/5)。"
         "1人投稿でも各候補式を適用し、その場合だけB=0。無投稿は0P。roundは0.5切り上げ。"
         "還元分配だけでなく行動評価で見込む報酬も変更した。本番実装は変更していない。",
         "",
         "目的は、ポイント抑制と、場札・テイク・初投稿活動の維持、空場・枯渇の抑制を両立すること。"
         "各指標の重みは未指定なので唯一の最適解は求めず、トレードオフを示す。",
         "", "## 候補式", "", "| 名称 | 計算式 |", "|---|---|"]
for key, formula in search["formulas"].items():
    lines.append(f"| {names[key]} | `{formula}` |")
for dataset, title in ((search, "探索100大会/条件"), (confirmation, "独立再検証300大会/条件")):
    groups = dataset["aggregate"]
    lines += ["", "## " + title, "", "値は1大会あたり平均。枯渇は正の長さの山札＋捨て札同時0区間。"
              "初投稿数は各場札の投稿者数の合計で、記録更新投稿を含まない。空場と残高は時間加重。", "",
              "| 条件 | 還元P | 平均場札 | テイク | 初投稿 | 空場分 | 上限分 | 枯渇大会数 | 枯渇区間数 | 平均全員P | 終了時P |",
              "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|"]
    for key, g in groups.items():
        lines.append(f"| {names[key]} | {g['economy']['collection_rewards']:.2f} | {g['mean_field']:.3f} | {g['takes']:.2f} | {g['initial_posts']:.2f} | {g['empty_minutes']:.2f} | {g['cap_minutes']:.2f} | {g['shortage_runs']} | {g['shortage_episodes']} | {g['mean_points']:.2f} | {g['economy']['ending_points']:.2f} |")
    lines += ["", "### 難易度別1枚あたり還元P", "", "0P回収も分母に含む。括弧内は回収枚数。", "",
              "| 条件 | 難易度1 | 2 | 3 | 4 | 5 |", "|---|---:|---:|---:|---:|---:|"]
    for key, g in groups.items():
        lines.append("| " + names[key] + " | " + " | ".join(f"{b['average_reward']:.3f} ({b['cards']})" for b in g["difficulty"].values()) + " |")
    if dataset is confirmation:
        lines += ["", "### 毎時平均場札数", "", "| 経過時間 | " + " | ".join(names[k] for k in groups) + " |", "|---|" + "---:|" * len(groups)]
        for hour in range(48):
            lines.append(f"| {hour}〜{hour+1}h | " + " | ".join(f"{g['hourly'][hour]['field']:.3f}" for g in groups.values()) + " |")
        lines += ["", "### 毎時の還元P / 時間平均全員所持P", "", "| 経過時間 | " + " | ".join(names[k] for k in groups) + " |", "|---|" + "---:|" * len(groups)]
        for hour in range(48):
            lines.append(f"| {hour}〜{hour+1}h | " + " | ".join(f"{g['hourly'][hour]['rewards']:.2f} / {g['hourly'][hour]['points']:.2f}" for g in groups.values()) + " |")
lines += ["", "## 独立再検証：a1/b0.75との差と参考95%信頼区間", "",
          "同一seed300ペアの平均差［下限,上限］。t≈1.968、多重比較補正なし。", "",
          "| 候補 | 平均場札 | 初投稿 | 空場分 | 総還元P |", "|---|---:|---:|---:|---:|"]
reference = {r["seed"]: r for r in confirmation["rows"] if r["policy"] == "a1_b075"}
for key in confirmation["aggregate"]:
    if key in ("current", "a1_b075"):
        continue
    rows = [r for r in confirmation["rows"] if r["policy"] == key]
    cells = []
    for metric in ("mean_field", "initial_posts", "empty_minutes", "collection_rewards"):
        def value(row):
            return row["economy"][metric] if metric == "collection_rewards" else row[metric]
        differences = [value(r) - value(reference[r["seed"]]) for r in rows]
        mean = statistics.mean(differences)
        margin = 1.968 * statistics.stdev(differences) / math.sqrt(len(rows))
        cells.append(f"{mean:+.3f} [{mean-margin:+.3f}, {mean+margin:+.3f}]")
    lines.append("| " + names[key] + " | " + " | ".join(cells) + " |")
lines += ["", "## 枯渇の全区間（独立再検証）", "",
          "| 条件 | seed | 開始h | 継続分 | 拘束枚数 | 回収済み本体 |", "|---|---:|---:|---:|---:|---:|"]
for r in confirmation["rows"]:
    for s in r["shortages"]:
        lines.append(f"| {names[r['policy']]} | {r['seed']} | {s['start_hour']:.3f} | {s['minutes']:.3f} | {s['locked']} | {s['retired']} |")
lines += ["", "## 検証・限界", "",
          "- S=3〜19、P=0〜19、単独/複数投稿で各式が非負・現行以下・SとPに対して単調非減少であることをテスト。丸め・時間積分・枯渇区間と基礎モデル同値テストも実施。",
          "- 全試行でカード保存200枚、還元分配と式の一致、ポイント収支、不変条件をチェック。違反0。",
          "- 枯渇0/300でも非発生を保証しない。独立試行なら発生率の片側95%上限は約1%。モデル外の戦略・活動密度には適用できない。",
          "- 人物・参加予定・初期カードは同一seedで揃うが、行動分岐後は乱数消費順が異なる。モデルは新式に最適化した戦略を学習しない。",
          "- 夜間の単独活動を含む既存人物モデルを維持したが、全員の連続稼働や単独還元の意図的反復に特化したストレス試験ではない。",
          "- 少額還元保護は単独投稿も式の適用対象だが、少額では減額0になる。S=3,P=1なら基準式3P、基礎6P超半減4P。給付を除くドロー＋投稿の4Pが全額戻る。給付条件を含む循環性に留意。",
          "- 基礎還元の大きい札ほど強い控除となるため、多人数・高料金の投稿に対する原資も減る。難易度ボーナスを減額対象から外す案は、高難易度の誘因を残せる。",
          "- 終了直前テイク促進（非活動者も判定）と48時間強制回収は既存モデルの仮定。終盤の場札と還元量はその影響を受ける。",
          "", "## 再現", "", "```sh", "python3 docs/studies/tricks-reward-search.py",
          "python3 docs/studies/tricks-reward-search.py --runs 300 --seed 279000 --policies current a1_b075 stack_half_p075 base6_half base6_quarter --output docs/studies/tricks-reward-search-confirmation.json",
          "python3 docs/studies/tricks-reward-search-report.py", "```", "",
          f"基礎モデルSHA256: `{confirmation['source_sha256']}`", ""]
(HERE / "tricks-reward-search-report.md").write_text("\n".join(lines))
print("report saved")
