"""Smoke test for the persona enricher.

Loads the full Northwind workforce, parses the canonical RTO v1 policy,
runs the enricher in ONE batched call, and prints results so P1 can eyeball
quality.

Run from backend/:
  python -m tests.test_enricher
"""
from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sim.persona_enricher import enrich_personas  # noqa: E402
from sim.policy_parser import parse_policy  # noqa: E402

CONTRACTS = ROOT.parent / "contracts"


RTO_V1 = """Effective June 1, 2026, all employees based in our San Francisco and New York offices are required to work from the office Tuesday, Wednesday, and Thursday each week. This policy applies to all departments and levels.

We believe in-person collaboration is essential to building the products our customers need and the culture we want to be known for. The era of indefinite remote flexibility is ending, and we are aligning with industry best practices.

Exceptions will be reviewed case-by-case at manager discretion. Employees who cannot meet the in-office requirement should discuss alternatives with their manager.

We are confident this change will accelerate execution, strengthen mentorship, and improve company performance. We appreciate your partnership in this transition."""


def short(s: str, n: int = 110) -> str:
    s = (s or "").replace("\n", " ").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


async def main() -> None:
    with open(CONTRACTS / "northwind.json") as f:
        northwind = json.load(f)
    agents = northwind["agents"]

    print(f"Loaded {len(agents)} agents from Northwind\n")

    print("Parsing RTO v1 policy...")
    t0 = time.time()
    parsed = await parse_policy(RTO_V1)
    print(f"  parsed in {time.time() - t0:.1f}s")
    print(f"  category={parsed['category']} severity={parsed['severity']}\n")

    print(f"Enriching {len(agents)} agents in ONE batched call...")
    t0 = time.time()
    enrichments = await enrich_personas(agents, parsed)
    elapsed = time.time() - t0
    print(f"  done in {elapsed:.1f}s\n")

    # spot-check a few
    sample_ids = ["emp_001", "emp_011", "emp_019", "emp_007", "emp_004", "emp_023", "emp_039", "emp_046"]
    print("Sample enrichments:\n")
    for aid in sample_ids:
        agent = next((a for a in agents if a["id"] == aid), None)
        if not agent:
            continue
        e = enrichments.get(aid, {})
        pred = e.get("predisposition", "?")
        strength = e.get("predisposition_strength", 0)
        ctx = e.get("scenario_specific_context", "(missing)")
        print(f"  {agent['name']:<20} ({agent['role'][:24]:<24}) "
              f"-> {pred:<8} strength={strength:.2f}")
        print(f"    \"{short(ctx)}\"")
        print()

    # coverage check
    covered = sum(1 for a in agents if enrichments.get(a["id"], {}).get("scenario_specific_context"))
    print(f"Coverage: {covered}/{len(agents)} agents enriched")

    # predisposition distribution
    counts = {"negative": 0, "neutral": 0, "positive": 0}
    for a in agents:
        counts[enrichments.get(a["id"], {}).get("predisposition", "neutral")] += 1
    print(f"Predisposition: negative={counts['negative']} neutral={counts['neutral']} positive={counts['positive']}")


if __name__ == "__main__":
    asyncio.run(main())
