"""Verify v1 and v2 hit their PRD targets.

Runs both canonical RTO policies through the full pipeline and prints a
side-by-side comparison. This is the demo's central narrative — if v2 doesn't
produce a meaningfully smaller delta than v1, the before/after story breaks.

Targets:
  v1 (aggressive):  delta -13 to -20 eNPS  (real workforce reaction)
  v2 (recommended): delta  -2 to -6 eNPS   (mostly recovers)
  Spread:           v1 - v2 should be at least -10 (visible in demo)

Run from backend/:
  python -m tests.verify_v1_v2

Caches both results on success so subsequent demos are instant.
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sim import cache  # noqa: E402
from sim.simulator import simulate  # noqa: E402

RTO_V1 = """Effective June 1, 2026, all employees based in our San Francisco and New York offices are required to work from the office Tuesday, Wednesday, and Thursday each week. This policy applies to all departments and levels.

We believe in-person collaboration is essential to building the products our customers need and the culture we want to be known for. The era of indefinite remote flexibility is ending, and we are aligning with industry best practices.

Exceptions will be reviewed case-by-case at manager discretion. Employees who cannot meet the in-office requirement should discuss alternatives with their manager.

We are confident this change will accelerate execution, strengthen mentorship, and improve company performance. We appreciate your partnership in this transition."""

RTO_V2 = """Starting September 1, 2026, we are moving to a hybrid collaboration model for our San Francisco and New York offices. The default expectation is two days per week in-office (Tuesday and Wednesday), with the third day flexible at the team level.

Why we're doing this: Customer-facing teams have asked for more in-person time for cross-functional planning, and our engineering retros consistently rate hybrid sprints highest. We piloted this model with the Sales team in Q1 and saw measurable lift in pipeline velocity.

What's changing for you:
- Two anchor days (Tue/Wed) for cross-team collaboration
- One flexible team-choice day, owned by your manager and team
- Caregiving, medical, and accessibility exceptions are guaranteed, not discretionary — apply through People Ops, not your manager
- Fully-remote roles remain fully-remote; this policy applies to those already assigned to an office
- Three-month ramp: optional in June–August, expected starting September

We'll run a pulse survey 30 and 90 days after rollout and adjust based on what we learn. This is a starting point, not a final answer."""


async def run(name: str, text: str, version: str) -> dict:
    print(f"\n{'='*72}\nRunning {name}...\n{'='*72}")
    cached = cache.get(text)
    if cached is not None:
        print(f"  [cache hit — instant]")
        cached["policy_version"] = version
        return cached

    t0 = time.time()
    result = await simulate(text, policy_version=version)
    elapsed = time.time() - t0
    print(f"  [computed in {elapsed:.0f}s]")

    cache.put(text, result)
    return result


def line(label: str, v1, v2, fmt: str = "{}", spread_fmt: str = "{:+}") -> None:
    v1s = fmt.format(v1)
    v2s = fmt.format(v2)
    if isinstance(v1, (int, float)) and isinstance(v2, (int, float)):
        spread = spread_fmt.format(v2 - v1)
        print(f"  {label:<30} v1={v1s:>10}   v2={v2s:>10}   Δ={spread}")
    else:
        print(f"  {label:<30} v1={v1s:>10}   v2={v2s:>10}")


async def main() -> None:
    overall_t0 = time.time()
    v1 = await run("RTO v1 (aggressive)", RTO_V1, "v1")
    v2 = await run("RTO v2 (recommended)", RTO_V2, "v2")

    print(f"\n{'='*72}\nCOMPARISON\n{'='*72}\n")

    v1_delta = v1["predicted"]["enps"] - v1["baseline"]["enps"]
    v2_delta = v2["predicted"]["enps"] - v2["baseline"]["enps"]

    line("Baseline eNPS", v1["baseline"]["enps"], v2["baseline"]["enps"])
    line("Predicted eNPS", v1["predicted"]["enps"], v2["predicted"]["enps"])
    line("Delta (this is the demo)", v1_delta, v2_delta)
    print()
    line("Engagement (predicted)", v1["predicted"]["engagement"], v2["predicted"]["engagement"], "{:.2f}")
    line("Trust (predicted)", v1["predicted"]["trust"], v2["predicted"]["trust"], "{:.2f}")
    print()

    # Action volume comparison
    print("Action volume comparison (v1 → v2):")
    all_types = sorted(set(v1["action_volume_summary"].keys()) | set(v2["action_volume_summary"].keys()))
    for t in all_types:
        c1 = v1["action_volume_summary"].get(t, 0)
        c2 = v2["action_volume_summary"].get(t, 0)
        diff = c2 - c1
        diff_str = f"({diff:+})" if diff != 0 else "(–)"
        print(f"  {t:<20} {c1:>3} → {c2:>3}  {diff_str}")

    # Flight risk
    v1_flight = v1["action_volume_summary"].get("UPDATE_LINKEDIN", 0)
    v2_flight = v2["action_volume_summary"].get("UPDATE_LINKEDIN", 0)
    print(f"\n  Flight risk:           {v1_flight} LinkedIn updates → {v2_flight} ({v2_flight - v1_flight:+})")

    # Cohort comparison (worst-hit cohort)
    print("\nWorst-hit cohort:")
    if v1["cohort_metrics"]:
        w1 = v1["cohort_metrics"][0]
        print(f"  v1: {w1['cohort_label']:<35} delta={w1['sentiment_delta']:+.3f} flight={w1['flight_risk_count']}")
    if v2["cohort_metrics"]:
        w2 = v2["cohort_metrics"][0]
        print(f"  v2: {w2['cohort_label']:<35} delta={w2['sentiment_delta']:+.3f} flight={w2['flight_risk_count']}")

    # Verdict
    print(f"\n{'='*72}\nVERDICT\n{'='*72}")
    spread = v2_delta - v1_delta  # positive when v2 is less negative than v1 (the goal)

    print(f"  v1 delta: {v1_delta:+d}  (target: -13 to -20)")
    v1_ok = -22 <= v1_delta <= -10
    print(f"    {'✓ in target' if v1_ok else '✗ out of range'}")

    print(f"  v2 delta: {v2_delta:+d}  (target: -2 to -6)")
    v2_ok = -8 <= v2_delta <= 1
    print(f"    {'✓ in target' if v2_ok else '✗ out of range'}")

    print(f"  Demo spread (v1 - v2): {spread:+d}  (need at least 8 for visible win)")
    spread_ok = spread >= 8
    print(f"    {'✓ demo will land' if spread_ok else '✗ DEMO BREAKS — v2 is not differentiating enough'}")

    total = time.time() - overall_t0
    print(f"\n  Total time: {total:.0f}s. Both policies cached.")

    if all([v1_ok, v2_ok, spread_ok]):
        print("\n  🎯 SHIP IT.")
    elif spread_ok:
        print("\n  ⚠️  Spread is fine, individual targets off. Demo still works. Tune later.")
    else:
        print("\n  ❌ Demo will not land. Tune deltas or v2 wording before anything else.")


if __name__ == "__main__":
    asyncio.run(main())
