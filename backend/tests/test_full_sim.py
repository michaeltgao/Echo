"""End-to-end smoke test for simulate(). One full run on canonical RTO v1."""
from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sim.simulator import simulate  # noqa: E402

RTO_V1 = """Effective June 1, 2026, all employees based in our San Francisco and New York offices are required to work from the office Tuesday, Wednesday, and Thursday each week. This policy applies to all departments and levels.

We believe in-person collaboration is essential to building the products our customers need and the culture we want to be known for. The era of indefinite remote flexibility is ending, and we are aligning with industry best practices.

Exceptions will be reviewed case-by-case at manager discretion. Employees who cannot meet the in-office requirement should discuss alternatives with their manager.

We are confident this change will accelerate execution, strengthen mentorship, and improve company performance. We appreciate your partnership in this transition."""


def progress(p: dict) -> None:
    print(f"  [{p['elapsed']:.1f}s] {p['stage']}...")


async def main() -> None:
    print("Running full simulation on RTO v1...\n")
    t0 = time.time()
    result = await simulate(RTO_V1, policy_version="v1", on_progress=progress)
    elapsed = time.time() - t0

    print(f"\n{'='*72}\nRESULT (computed in {elapsed:.1f}s)")
    print('='*72)
    print(f"Summary: {result['summary']}\n")

    print(f"eNPS:         {result['baseline']['enps']:>3} -> {result['predicted']['enps']:>3} "
          f"(delta {result['predicted']['enps'] - result['baseline']['enps']:+d})")
    print(f"Engagement:   {result['baseline']['engagement']:.2f} -> {result['predicted']['engagement']:.2f}")
    print(f"Trust:        {result['baseline']['trust']:.2f} -> {result['predicted']['trust']:.2f}\n")

    print("Action volume:")
    for action_type, count in sorted(result['action_volume_summary'].items(), key=lambda x: -x[1]):
        bar = '█' * count
        print(f"  {action_type:<20} {count:>3} {bar}")

    print(f"\nTotal actions: {len(result['actions'])}")
    print(f"Fallbacks used: {result['fallback_used']}\n")

    print("Cohort risk (worst first):")
    for c in result['cohort_metrics'][:8]:
        print(f"  {c['cohort_label']:<35} delta={c['sentiment_delta']:+.2f} "
              f"flight={c['flight_risk_count']:>2} risk={c['risk_level']}")

    print("\nSample actions (first 5 days):")
    for act in result['actions'][:15]:
        c = act['content'] or f"[{act['action_type']}]"
        c = c[:90] + ("…" if len(c) > 90 else "")
        print(f"  Day {act['day']:>2}  {act['agent_id']}  {act['action_type']:<18}  {c}")

    out_path = Path(__file__).parent / "last_result.json"
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nFull result saved to {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
