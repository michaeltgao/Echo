"""Re-aggregate using cached actions from last full run. No LLM calls.

Lets us iterate on SENTIMENT_IMPACT + DAILY_RECOVERY tuning in seconds, not minutes.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sim.sentiment_aggregator import aggregate_sentiment, attach_impact, derive_metrics  # noqa: E402

CONTRACTS = ROOT.parent / "contracts"


def main() -> None:
    cached = ROOT / "tests" / "last_result.json"
    if not cached.exists():
        print("Run test_full_sim first to produce a cached result.")
        return

    with open(cached) as f:
        result = json.load(f)
    with open(CONTRACTS / "northwind.json") as f:
        nw = json.load(f)
    agents = nw["agents"]

    actions = result["actions"]
    # re-attach impact with current SENTIMENT_IMPACT values
    for act in actions:
        attach_impact(act)

    snapshots = aggregate_sentiment(agents, actions, days=30)
    metrics = derive_metrics(agents, snapshots)

    delta = metrics['predicted']['enps'] - metrics['baseline']['enps']
    print(f"Baseline eNPS: {metrics['baseline']['enps']}")
    print(f"Predicted eNPS: {metrics['predicted']['enps']}")
    print(f"Delta: {delta:+d}  (PRD target: -13 to -16)")
    print(f"Engagement: {metrics['baseline']['engagement']:.3f} -> {metrics['predicted']['engagement']:.3f}")

    # cohort deltas
    print("\nCohort sentiment deltas (worst first):")
    final = {s["agent_id"]: s for s in snapshots[-1]["agent_states"]}
    cohorts: dict[tuple[str, str], list] = {}
    for a in agents:
        cohorts.setdefault((a["department"], a["location"]), []).append(a)
    rows = []
    for (dept, loc), members in cohorts.items():
        if len(members) < 2:
            continue
        baseline = sum(m.get("baseline_sentiment", 0.7) for m in members) / len(members)
        predicted = sum(final[m["id"]]["sentiment"] for m in members) / len(members)
        rows.append((predicted - baseline, f"{dept} – {loc}"))
    rows.sort()
    for d, label in rows[:8]:
        print(f"  {label:<40} {d:+.3f}")


if __name__ == "__main__":
    main()
