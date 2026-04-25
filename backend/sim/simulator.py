"""Top-level simulate() orchestrator.

Wires the full pipeline from PRD §5:
  policy text
    -> parse_policy
    -> enrich_personas (50 agents in 3 parallel batches)
    -> schedule_activity (deterministic)
    -> select_action × N (parallel batches of 10)
    -> aggregate_sentiment (deterministic)
    -> derive_metrics (deterministic)
    -> [theme clusterer + recommendation TODO P4]
    -> SimulationResult JSON

Everything except themes + recommendation. Those are P4's modules; this
returns a result with placeholder themes/rec so frontend can integrate
end-to-end before P4 lands.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .action_selector import select_action
from .actions import HAS_CONTENT
from .activity_scheduler import schedule_activity
from .llm import gather_with_concurrency
from .persona_enricher import enrich_personas
from .policy_parser import parse_policy
from .sentiment_aggregator import (
    aggregate_sentiment,
    attach_impact,
    build_lookups,
    compute_visibility,
    derive_metrics,
)

def _find_northwind() -> Path:
    """northwind.json lives at <repo>/contracts/northwind.json locally, but on
    Railway the Root Directory is backend/ so contracts/ ships under
    backend/contracts/. Try both."""
    here = Path(__file__).resolve()
    candidates = [
        here.parent.parent.parent / "contracts" / "northwind.json",  # repo root layout
        here.parent.parent / "contracts" / "northwind.json",         # backend-as-root layout
    ]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError(f"northwind.json not found. Tried: {candidates}")


def load_northwind() -> dict[str, Any]:
    with open(_find_northwind()) as f:
        return json.load(f)


def _hash_policy(text: str) -> str:
    return hashlib.sha256(text.strip().encode()).hexdigest()[:16]


async def simulate(
    policy_text: str,
    *,
    policy_version: str = "v1",
    days: int = 30,
    on_progress: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    t0 = time.time()
    policy_hash = _hash_policy(policy_text)

    nw = load_northwind()
    agents = [dict(a) for a in nw["agents"]]  # copy so we can attach enrichment
    collab_edges = nw.get("collaboration_edges", [])
    agents_by_id, collab, departments = build_lookups(agents, collab_edges)

    # ---- 1. parse policy ----
    if on_progress:
        on_progress({"stage": "parsing", "elapsed": time.time() - t0})
    parsed = await parse_policy(policy_text)

    # ---- 2. enrich personas ----
    if on_progress:
        on_progress({"stage": "enriching", "elapsed": time.time() - t0})
    enrichments = await enrich_personas(agents, parsed)
    for a in agents:
        e = enrichments.get(a["id"], {})
        a["scenario_specific_context"] = e.get("scenario_specific_context", "")
        a["predisposition"] = e.get("predisposition", "neutral")
        a["predisposition_strength"] = e.get("predisposition_strength", 0.4)

    # ---- 3. schedule activity ----
    if on_progress:
        on_progress({"stage": "scheduling", "elapsed": time.time() - t0})
    schedule = schedule_activity(agents, parsed, days=days, policy_hash=policy_hash)

    # ---- 4. select actions, day-by-day so each call has the agent's history ----
    if on_progress:
        on_progress({"stage": "acting", "elapsed": time.time() - t0})

    actions: list[dict[str, Any]] = []
    prior_by_agent: dict[str, list[dict[str, Any]]] = {a["id"]: [] for a in agents}
    intra_day_counter: dict[int, int] = {}
    raw_actions: list[Any] = []  # for fallback flag tracking

    # Process days in 5-day chunks. Within a chunk, all (day, agent) calls run
    # concurrently. Between chunks, prior_by_agent is updated so later chunks
    # see earlier actions. Trade-off: an agent who acts twice in the same chunk
    # won't see their own first action — acceptable, the persona dominates.
    DAY_CHUNK = 5
    chunk_starts = list(range(0, max(schedule.keys(), default=0) + 1, DAY_CHUNK))
    for chunk_start in chunk_starts:
        chunk_days = [d for d in sorted(schedule) if chunk_start <= d < chunk_start + DAY_CHUNK]
        chunk_tasks: list[tuple[int, str]] = []  # (day, agent_id)
        for d in chunk_days:
            for aid in schedule[d]:
                chunk_tasks.append((d, aid))
        if not chunk_tasks:
            continue

        chunk_coros = [
            select_action(
                agents_by_id[aid],
                parsed,
                day=day,
                peer_tone="neutral",
                prior_actions=prior_by_agent[aid],
            )
            for (day, aid) in chunk_tasks
        ]
        chunk_results = await gather_with_concurrency(chunk_coros, limit=10)
        raw_actions.extend(chunk_results)

        for (day, aid), result in zip(chunk_tasks, chunk_results):
            if isinstance(result, Exception):
                continue
            seq = intra_day_counter.get(day, 0)
            intra_day_counter[day] = seq + 1

            actor = agents_by_id[aid]
            action_type = result["action_type"]
            target = result.get("target", {"type": "none", "value": ""})

            visible_to = compute_visibility(
                actor,
                action_type,
                target.get("value", ""),
                agents_by_id=agents_by_id,
                collaboration_neighbors=collab,
                department_members=departments,
            )

            action_record = {
                "id": f"act_d{day:02d}_{seq:02d}",
                "day": day,
                "intra_day_order": seq,
                "agent_id": aid,
                "action_type": action_type,
                "target": target,
                "content": result.get("content", "") if HAS_CONTENT.get(action_type, False) else "",
                "intensity": result.get("intensity", 0.5),
                "is_visible_to": visible_to,
            }
            attach_impact(action_record)
            actions.append(action_record)
            prior_by_agent[aid].append(action_record)

    # ---- 6. aggregate sentiment into snapshots ----
    if on_progress:
        on_progress({"stage": "aggregating", "elapsed": time.time() - t0})

    snapshots = aggregate_sentiment(agents, actions, days=days)
    metrics = derive_metrics(agents, snapshots)

    # ---- 7. cohort metrics ----
    cohort_metrics = _compute_cohort_metrics(agents, snapshots, actions)

    # ---- 8. action volume summary ----
    volume: dict[str, int] = {}
    for act in actions:
        volume[act["action_type"]] = volume.get(act["action_type"], 0) + 1

    # ---- 9. placeholder themes + recommendation (P4 will replace) ----
    themes_placeholder = _placeholder_themes(actions, agents_by_id)
    rec_placeholder = _placeholder_recommendation(parsed)

    # ---- 10. summary line ----
    li_count = volume.get("UPDATE_LINKEDIN", 0)
    delta = metrics["predicted"]["enps"] - metrics["baseline"]["enps"]
    summary = (
        f"Predicted {delta:+d} eNPS over 30 days. "
        f"{li_count} LinkedIn updates expected. "
        f"Top concern: {(themes_placeholder[0]['label'] if themes_placeholder else 'mixed')}."
    )

    return {
        "scenario_id": policy_hash,
        "policy_version": policy_version,
        "policy_text": policy_text,
        "parsed_policy": parsed,
        "model_version": "sim-0.3-action-based",
        "baseline": metrics["baseline"],
        "predicted": metrics["predicted"],
        "actions": actions,
        "action_volume_summary": volume,
        "snapshots": snapshots,
        "cohort_metrics": cohort_metrics,
        "themes": themes_placeholder,
        "recommendation": rec_placeholder,
        "summary": summary,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "computation_ms": int((time.time() - t0) * 1000),
        "fallback_used": any(r.get("_fallback") for r in raw_actions if isinstance(r, dict)),
    }


def _compute_cohort_metrics(
    agents: list[dict[str, Any]],
    snapshots: list[dict[str, Any]],
    actions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    final = {s["agent_id"]: s for s in snapshots[-1]["agent_states"]}

    # group by (department, location)
    cohorts: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for a in agents:
        cohorts.setdefault((a["department"], a["location"]), []).append(a)

    actions_by_actor: dict[str, list[dict[str, Any]]] = {}
    for act in actions:
        actions_by_actor.setdefault(act["agent_id"], []).append(act)

    out = []
    for (dept, loc), members in cohorts.items():
        if len(members) < 2:
            continue  # respect minimum cohort size in spirit
        baseline = sum(m.get("baseline_sentiment", 0.7) for m in members) / len(members)
        predicted = sum(final[m["id"]]["sentiment"] for m in members) / len(members)
        delta = predicted - baseline

        flight_count = sum(1 for m in members if final[m["id"]]["flight_risk_flag"])

        # action volume by type within cohort
        type_counts: dict[str, int] = {}
        for m in members:
            for act in actions_by_actor.get(m["id"], []):
                type_counts[act["action_type"]] = type_counts.get(act["action_type"], 0) + 1
        loudest = max(type_counts.items(), key=lambda kv: kv[1])[0] if type_counts else "DO_NOTHING"

        # rough enps delta: -10 per 0.1 sentiment drop
        enps_delta = round(delta * 100)

        risk = "high" if delta < -0.10 else "medium" if delta < -0.04 else "low"
        top_concern = "Loss of flexibility" if dept == "Engineering" else "Compensation fairness"  # crude default; themes will refine

        out.append({
            "cohort_label": f"{dept} – {loc}",
            "department": dept,
            "location": loc,
            "headcount": len(members),
            "baseline_sentiment": round(baseline, 3),
            "predicted_sentiment": round(predicted, 3),
            "sentiment_delta": round(delta, 3),
            "enps_delta": enps_delta,
            "top_concern": top_concern,
            "risk_level": risk,
            "flight_risk_count": flight_count,
            "loudest_action_type": loudest,
        })

    out.sort(key=lambda c: c["sentiment_delta"])  # worst first
    return out


def _placeholder_themes(
    actions: list[dict[str, Any]], agents_by_id: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    """Naive theme placeholder until P4 wires the LLM clusterer.

    Just picks the 3 highest-intensity actions with content as a single bucket.
    """
    with_content = [a for a in actions if a.get("content")]
    with_content.sort(key=lambda a: a.get("intensity", 0), reverse=True)
    quotes = []
    for act in with_content[:3]:
        agent = agents_by_id.get(act["agent_id"], {})
        quotes.append({
            "text": act["content"],
            "agent_id": act["agent_id"],
            "action_id": act["id"],
            "department": agent.get("department", ""),
            "role": agent.get("role", ""),
        })
    if not quotes:
        return []
    return [{
        "label": "Mixed concerns",
        "description": "Theme clustering pending (P4 module).",
        "volume": len(with_content),
        "volume_pct": round(100 * len(with_content) / max(1, len(actions))),
        "quotes": quotes,
        "departments_affected": list({q["department"] for q in quotes if q["department"]}),
    }]


def _placeholder_recommendation(parsed: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": "Recommendation pending",
        "rationale": "Recommendation generator is a P4 module — placeholder shown here.",
        "suggested_rewrite": "(P4 will replace this with the rewritten policy.)",
        "projected_impact": {
            "negative_action_reduction_pct": 0,
            "linkedin_updates_avoided": 0,
            "engagement_lift": 0.0,
            "confidence": "low",
        },
    }
