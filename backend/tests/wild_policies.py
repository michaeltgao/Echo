"""Run 3 wild (non-canonical) policies against the live API and sanity-check the output.

Validates "works for anybody" — judges can paste their own and we won't crash or produce nonsense.

Run from backend/:
  python -m tests.wild_policies
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

import httpx

URL = "https://echo-production-4ead.up.railway.app"

POLICIES = {
    "comp_freeze": {
        "text": """Due to current market conditions, all merit increases and bonuses are paused for fiscal year 2026. We will revisit this in Q1 2027 based on company performance. This policy applies to all employees globally except executive leadership and individual sales commissions, which remain on plan.

Stock refreshes will continue per the existing schedule, but will be weighted more heavily toward our highest performers as identified in the upcoming calibration cycle.

Managers will conduct one-on-ones to discuss this change with their teams over the next two weeks. Please direct further questions to your HR business partner.""",
        "expected": {
            "high_linkedin": True,  # comp freezes drive flight risk
            "high_fairness_themes": True,  # exec exemption is unfair
            "category_hint": "comp_freeze | compensation",
        },
    },
    "four_day_week": {
        "text": """Effective July 1, 2026, we are moving to a four-day work week. The standard work week becomes Monday through Thursday, with Friday designated as a no-meeting, no-email day. Compensation, benefits, and performance expectations remain unchanged.

We're adopting this based on our successful Q2 pilot, which showed productivity gains and significant improvement in employee wellbeing scores. We've worked through customer-facing coverage with sales and support leadership; on-call rotations will be redesigned to ensure continuity without burdening individuals.

We trust you to deliver the same outcomes in four days. If your team struggles with the transition, raise it with your manager so we can adjust together.""",
        "expected": {
            "high_advocate": True,  # this is a positive policy
            "low_linkedin": True,  # nobody quits over getting more time off
            "smaller_delta": True,  # eNPS should not drop much (might rise)
        },
    },
    "layoff_round": {
        "text": """We are reducing headcount by approximately 12% effective next Friday. Affected employees will be notified individually by their manager tomorrow. Severance details and outplacement support will be communicated in those one-on-one conversations.

The reductions are concentrated in middle-management and operations roles, with a smaller impact on engineering and product. We considered alternatives including comp reductions and hiring freezes, but determined that targeted reductions were the most responsible path given runway constraints.

We thank everyone affected for their contributions and are committed to supporting their transition.""",
        "expected": {
            "max_linkedin": True,  # everyone updates LinkedIn after layoffs
            "go_quiet_present": True,  # survivor's guilt / withdrawal
            "high_severity": True,
        },
    },
}


async def run_one(name: str, spec: dict) -> dict:
    print(f"\n{'='*72}\n{name}\n{'='*72}")
    t0 = time.time()
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(
            f"{URL}/simulate",
            json={
                "policy_text": spec["text"],
                "policy_version": "v1",
                "use_cache": True,  # OK to cache wild tests
            },
        )
    elapsed = time.time() - t0
    if resp.status_code != 200:
        print(f"  ❌ HTTP {resp.status_code}: {resp.text[:200]}")
        return {"ok": False}

    r = resp.json()
    cache_tag = " [cached]" if r.get("_cache_hit") else f" [live, {elapsed:.0f}s]"
    print(f"  Status: 200{cache_tag}")
    print(f"  Parsed: category={r['parsed_policy']['category']} "
          f"tone={r['parsed_policy']['tone']} severity={r['parsed_policy']['severity']}")

    delta = r['predicted']['enps'] - r['baseline']['enps']
    print(f"  eNPS:   {r['baseline']['enps']:+} → {r['predicted']['enps']:+}  (delta {delta:+})")

    vol = r["action_volume_summary"]
    print("  Action volume:")
    for action_type, count in sorted(vol.items(), key=lambda x: -x[1]):
        if count > 0:
            print(f"    {action_type:<20} {count}")

    print(f"  Total actions: {len(r['actions'])}")
    print(f"  Fallback used: {r.get('fallback_used', False)}")
    print(f"  Worst cohort: {r['cohort_metrics'][0]['cohort_label']} "
          f"(delta {r['cohort_metrics'][0]['sentiment_delta']:+.3f}, "
          f"flight={r['cohort_metrics'][0]['flight_risk_count']})")

    # Sample 3 action contents
    print("  Sample actions:")
    contents = [a for a in r["actions"] if a.get("content")]
    for a in contents[:3]:
        c = a["content"][:90] + ("…" if len(a["content"]) > 90 else "")
        print(f"    [{a['action_type']:<18}] {c}")

    # Validate expectations
    expected = spec["expected"]
    issues = []
    if expected.get("high_linkedin") and vol.get("UPDATE_LINKEDIN", 0) < 8:
        issues.append(f"  ⚠ expected high LinkedIn but got {vol.get('UPDATE_LINKEDIN', 0)}")
    if expected.get("low_linkedin") and vol.get("UPDATE_LINKEDIN", 0) > 4:
        issues.append(f"  ⚠ expected low LinkedIn but got {vol.get('UPDATE_LINKEDIN', 0)}")
    if expected.get("max_linkedin") and vol.get("UPDATE_LINKEDIN", 0) < 12:
        issues.append(f"  ⚠ expected max LinkedIn but got {vol.get('UPDATE_LINKEDIN', 0)}")
    if expected.get("high_advocate") and vol.get("ADVOCATE", 0) < 3:
        issues.append(f"  ⚠ expected high ADVOCATE but got {vol.get('ADVOCATE', 0)}")
    if expected.get("go_quiet_present") and vol.get("GO_QUIET", 0) < 1:
        issues.append("  ⚠ expected GO_QUIET present but got 0")
    if expected.get("smaller_delta") and delta < -10:
        issues.append(f"  ⚠ expected smaller eNPS drop but got {delta}")
    if expected.get("high_severity") and r['parsed_policy']['severity'] < 0.7:
        issues.append(f"  ⚠ expected high severity but got {r['parsed_policy']['severity']}")

    if issues:
        for issue in issues:
            print(issue)
    else:
        print("  ✓ All expectations met")

    return {"ok": True, "result": r, "issues": issues}


async def main() -> None:
    print(f"Wild policy tests against {URL}")
    print(f"Validating 'works for anybody' across 3 non-canonical scenarios.")

    results = {}
    for name, spec in POLICIES.items():
        results[name] = await run_one(name, spec)

    # Summary
    print(f"\n{'='*72}\nSUMMARY\n{'='*72}")
    total_issues = 0
    for name, r in results.items():
        if not r["ok"]:
            print(f"  ❌ {name}: HTTP error")
            total_issues += 1
        else:
            issue_count = len(r["issues"])
            total_issues += issue_count
            mark = "✓" if issue_count == 0 else "⚠"
            print(f"  {mark} {name}: {issue_count} issue(s)")

    if total_issues == 0:
        print("\n  🎯 All wild policies produce sensible output. Ship-ready.")
    else:
        print(f"\n  Total issues: {total_issues}. Review and tune if structural.")


if __name__ == "__main__":
    asyncio.run(main())
