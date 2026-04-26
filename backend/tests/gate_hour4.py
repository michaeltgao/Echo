"""Hour 4 go/no-go gate (PRD §10).

Runs the policy parser + action selector across:
  3 policy types (RTO, comp freeze, layoff)
  x 5 personas (high-influence senior IC, caregiver PM, sales loyalist, junior, manager)
  = 15 combinations

For each, prints the chosen action + content. P1 reads the output and asks:
  - Does each persona's reaction sound like that specific person?
  - Is the action distribution sensible (not all VENT, not all DO_NOTHING)?
  - Does it work across policy types, not just RTO?

If yes -> gate passed, build the rest. If no -> tune prompts before moving on.

Run from backend/ dir:
  python -m tests.gate_hour4
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sim.action_selector import select_action  # noqa: E402
from sim.llm import gather_with_concurrency  # noqa: E402
from sim.policy_parser import parse_policy  # noqa: E402

# 3 representative policies (short forms, just enough signal)
POLICIES = {
    "RTO_aggressive": """Effective June 1, 2026, all employees based in our San Francisco and New York offices are required to work from the office Tuesday, Wednesday, and Thursday each week. The era of indefinite remote flexibility is ending. Exceptions will be reviewed case-by-case at manager discretion.""",

    "comp_freeze": """Due to current market conditions, all merit increases and bonuses are paused for fiscal year 2026. We will revisit this in Q1 2027 based on company performance. This applies to all employees globally except executive leadership.""",

    "layoff_round": """We are reducing headcount by approximately 12% effective next Friday. Affected employees will be notified individually by their manager tomorrow. Severance details and outplacement support will be communicated in those conversations. We thank everyone for their contributions to the company.""",
}

# 5 representative personas (subset of Northwind)
PERSONAS = [
    {
        "id": "emp_001",
        "name": "Priya Shah",
        "department": "Engineering",
        "role": "Senior IC Engineer",
        "location": "San Francisco",
        "tenure_years": 4,
        "manager_id": "emp_004",
        "motivators": ["autonomy", "technical_impact", "compensation_fairness"],
        "sensitivities": ["commute", "manager_process", "promotion_delay"],
        "baseline_sentiment": 0.71,
        "influence_weight": 0.82,
        "trust_in_leadership": 0.48,
        "is_caregiver": True,
    },
    {
        "id": "emp_011",
        "name": "Elena Vasquez",
        "department": "Product",
        "role": "Senior PM",
        "location": "New York",
        "tenure_years": 4,
        "manager_id": "emp_014",
        "motivators": ["impact", "cross_functional_collaboration"],
        "sensitivities": ["caregiving", "commute"],
        "baseline_sentiment": 0.72,
        "influence_weight": 0.78,
        "trust_in_leadership": 0.55,
        "is_caregiver": True,
    },
    {
        "id": "emp_019",
        "name": "Jordan Bailey",
        "department": "Sales",
        "role": "Account Executive",
        "location": "San Francisco",
        "tenure_years": 2,
        "manager_id": "emp_024",
        "motivators": ["compensation", "competition"],
        "sensitivities": ["quota_pressure", "territory"],
        "baseline_sentiment": 0.78,
        "influence_weight": 0.55,
        "trust_in_leadership": 0.70,
        "is_caregiver": False,
    },
    {
        "id": "emp_007",
        "name": "Tom Wallace",
        "department": "Engineering",
        "role": "Junior IC Engineer",
        "location": "San Francisco",
        "tenure_years": 1,
        "manager_id": "emp_004",
        "motivators": ["learning", "mentorship"],
        "sensitivities": ["isolation", "unclear_expectations"],
        "baseline_sentiment": 0.68,
        "influence_weight": 0.30,
        "trust_in_leadership": 0.62,
        "is_caregiver": False,
    },
    {
        "id": "emp_004",
        "name": "Sarah Kim",
        "department": "Engineering",
        "role": "Engineering Manager",
        "location": "San Francisco",
        "tenure_years": 5,
        "manager_id": "emp_005",
        "motivators": ["team_health", "delivery"],
        "sensitivities": ["attrition_risk", "burnout"],
        "baseline_sentiment": 0.62,
        "influence_weight": 0.75,
        "trust_in_leadership": 0.58,
        "is_caregiver": True,
    },
]


def short(s: str, n: int = 90) -> str:
    s = (s or "").replace("\n", " ").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


async def run_one_policy(policy_name: str, policy_text: str) -> None:
    print(f"\n{'='*80}\nPOLICY: {policy_name}\n{'='*80}")
    t0 = time.time()
    parsed = await parse_policy(policy_text)
    print(f"  parsed in {time.time() - t0:.1f}s")
    print(f"  category={parsed['category']} tone={parsed['tone']} "
          f"severity={parsed['severity']} dims={parsed['dimensions_affected']}")

    coros = [
        select_action(p, parsed, day=1, peer_tone="neutral", has_prior_action=False)
        for p in PERSONAS
    ]
    t0 = time.time()
    results = await gather_with_concurrency(coros, limit=5)
    print(f"  5 actions selected in {time.time() - t0:.1f}s\n")

    fallbacks = 0
    for persona, result in zip(PERSONAS, results):
        if isinstance(result, Exception):
            print(f"  ✗ {persona['name']:<20} ERROR: {result}")
            continue
        if result.get("_fallback"):
            fallbacks += 1
            tag = "[fallback]"
        else:
            tag = ""
        print(f"  {persona['name']:<20} ({persona['role'][:22]:<22}) "
              f"-> {result['action_type']:<18} {tag}")
        if result.get("content"):
            print(f"    \"{short(result['content'])}\"")
        else:
            target = result.get("target", {})
            print(f"    target={target.get('type')}:{target.get('value') or '-'}")

    if fallbacks:
        print(f"\n  WARNING: {fallbacks}/5 used heuristic fallback. Investigate prompt.")


async def main() -> None:
    print("Echo — Hour 4 Gate")
    print(f"Policies: {len(POLICIES)} | Personas: {len(PERSONAS)} | Total calls: {len(POLICIES) * (len(PERSONAS) + 1)}\n")

    overall_t0 = time.time()
    for name, text in POLICIES.items():
        await run_one_policy(name, text)
    print(f"\n{'='*80}\nTotal time: {time.time() - overall_t0:.1f}s")
    print("Gate passes if:")
    print("  - Every persona produced a sensible action (no all-VENT, no all-DO_NOTHING)")
    print("  - Content sounds like a real human in that role")
    print("  - All 3 policy types worked, not just RTO")


if __name__ == "__main__":
    asyncio.run(main())
