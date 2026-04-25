"""Smoke test for activity_scheduler. No LLM calls — runs instantly."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sim.activity_scheduler import schedule_activity, summarize  # noqa: E402

CONTRACTS = ROOT.parent / "contracts"


def main() -> None:
    with open(CONTRACTS / "northwind.json") as f:
        agents = json.load(f)["agents"]

    # simulate enricher having added predispositions
    for a in agents:
        # placeholder — in real flow these come from enrich_personas
        a["predisposition"] = "negative" if a.get("is_caregiver") else "neutral"
        a["predisposition_strength"] = 0.7 if a.get("is_caregiver") else 0.3

    parsed = {"severity": 0.7, "category": "return_to_office"}

    sched = schedule_activity(agents, parsed)
    stats = summarize(sched)

    print(f"Total actions across 30 days: {stats['total_actions']}")
    print(f"Unique agents who acted at least once: {stats['unique_agents']} / {len(agents)}")
    print(f"Peak day: day {stats['peak_day']}")
    print(f"Actions per day: {stats['actions_per_day']}\n")

    # show day 0-5 detail
    print("First 6 days:")
    name_lookup = {a["id"]: a["name"] for a in agents}
    for d in range(6):
        names = [name_lookup[aid].split()[0] for aid in sched[d]]
        print(f"  Day {d}: {len(sched[d])} agents — {', '.join(names)}")


if __name__ == "__main__":
    main()
