"""Explore alternatives, then confirm selected policies on independent seeds."""
import argparse
import hashlib
import importlib.util
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from fractions import Fraction
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("suppression", HERE / "tricks-reward-suppression-study.py")
study = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = study
spec.loader.exec_module(study)
original_budget = study.budget
FORMULAS = {
    "current": "S+P+B",
    "a1_b075": "S-1+round(0.75P)+B",
    "a1_b05": "S-1+round(0.5P)+B",
    "a0_b05": "S+round(0.5P)+B",
    "a1_b09": "S-1+round(0.9P)+B",
    "a1_b1": "S-1+P+B",
    "stack_half": "3+round(0.5(S-3))+P+B",
    "stack_half_p075": "3+round(0.5(S-3))+round(0.75P)+B",
    "base4_half": "min(S+P,4)+round(0.5max(S+P-4,0))+B",
    "base6_half": "min(S+P,6)+round(0.5max(S+P-6,0))+B",
    "base6_quarter": "min(S+P,6)+round(0.25max(S+P-6,0))+B",
    "total6_half": "min(S+P+B,6)+round(0.5max(S+P+B-6,0))",
}


def budget(card, policy, multi):
    if policy in study.POLICIES:
        return original_budget(card, policy, multi)
    assert policy in FORMULAS
    s, p = card.stack_count, card.paid_points_total
    bonus = (card.difficulty or 1) * ((s + p) // 5) if multi else 0
    def rounded(n, fraction):
        return study.half_up(n * Fraction(fraction))
    if policy == "a0_b05":
        return s + rounded(p, "0.5") + bonus
    if policy == "a1_b05":
        return s - 1 + rounded(p, "0.5") + bonus
    if policy in ("a1_b09", "a1_b1"):
        return s - 1 + rounded(p, "0.9" if policy == "a1_b09" else "1") + bonus
    if policy.startswith("stack_half"):
        return 3 + rounded(s - 3, "0.5") + (rounded(p, "0.75") if policy.endswith("p075") else p) + bonus
    threshold = 4 if policy == "base4_half" else 6
    base = s + p + (bonus if policy == "total6_half" else 0)
    return (min(base, threshold) + rounded(max(0, base - threshold), "0.25" if policy == "base6_quarter" else "0.5")
            + (0 if policy == "total6_half" else bonus))


study.budget = budget


def run(job):
    row = study.run_one(job)
    row["initial_posts"] = sum(b["participants"] for b in row["difficulty"].values())
    return row


def tests():
    for policy in FORMULAS:
        for single in (False, True):
            for s in range(3, 20):
                for p in range(20):
                    card = study.SimpleNamespace(stack_count=s, paid_points_total=p, difficulty=3)
                    amount = budget(card, policy, not single)
                    assert 0 <= amount <= budget(card, "current", not single)
                    larger = study.SimpleNamespace(stack_count=s + 1, paid_points_total=p, difficulty=3)
                    assert budget(larger, policy, not single) >= amount
                    larger = study.SimpleNamespace(stack_count=s, paid_points_total=p + 1, difficulty=3)
                    assert budget(larger, policy, not single) >= amount
    study.self_test()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=100)
    parser.add_argument("--seed", type=int, default=278000)
    parser.add_argument("--policies", nargs="+", choices=list(FORMULAS), default=list(FORMULAS))
    parser.add_argument("--output", type=Path, default=HERE / "tricks-reward-search-results.json")
    args = parser.parse_args()
    tests()
    rows = []
    with ProcessPoolExecutor(max_workers=4) as pool:
        jobs = [(p, s) for p in args.policies for s in range(args.seed, args.seed + args.runs)]
        for row in pool.map(run, jobs):
            rows.append(row)
            if len(rows) % args.runs == 0:
                print(f"completed {row['policy']} ({len(rows)}/{len(jobs)})", flush=True)
    aggregate = study.aggregate(rows)
    for key, group in aggregate.items():
        group["initial_posts"] = sum(r["initial_posts"] for r in rows if r["policy"] == key) / args.runs
    result = {"formulas": FORMULAS, "seed_start": args.seed, "runs": args.runs,
              "source_sha256": hashlib.sha256(study.SOURCE.read_bytes()).hexdigest(),
              "observer_sha256": hashlib.sha256((HERE / 'tricks-reward-suppression-study.py').read_bytes()).hexdigest(),
              "script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "aggregate": aggregate, "rows": rows}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(args.output, flush=True)
