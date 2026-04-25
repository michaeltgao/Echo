"""Streaming variant of simulate() — yields events as the pipeline runs.

Events emitted (as dicts that the SSE endpoint serializes):

  {type: "stage",  stage: "parsing"|"enriching"|"scheduling"|"acting"|"aggregating", elapsed_ms: int}
  {type: "parsed", parsed_policy: {...}}
  {type: "action", action: {...full action record...}}     <-- the wow moment
  {type: "tick",   completed: int, total: int}             <-- progress for loading bar
  {type: "result", result: {...full SimulationResult...}}  <-- final
  {type: "error",  message: str}

The action selector still runs at concurrency 10, but instead of waiting for
all 100+ to finish before returning, we use asyncio.as_completed to emit each
one the moment it lands. Frontend can render a live action feed in real time.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from .action_selector import select_action
from .actions import HAS_CONTENT
from .activity_scheduler import schedule_activity
from .persona_enricher import enrich_personas
from .policy_parser import parse_policy
from .sentiment_aggregator import (
    aggregate_sentiment,
    attach_impact,
    build_lookups,
    compute_visibility,
    derive_metrics,
)
from .simulator import (
    _compute_cohort_metrics,
    _hash_policy,
    _placeholder_recommendation,
    _placeholder_themes,
    load_northwind,
)


CONCURRENCY = 10


async def _bounded(sem: asyncio.Semaphore, idx: int, coro):
    """Wrap a coroutine so completion order is preserved as (idx, result)."""
    async with sem:
        try:
            return idx, await coro
        except Exception as e:
            return idx, e


async def simulate_stream(
    policy_text: str,
    *,
    policy_version: str = "v1",
    days: int = 30,
) -> AsyncIterator[dict[str, Any]]:
    t0 = time.time()
    elapsed_ms = lambda: int((time.time() - t0) * 1000)

    try:
        policy_hash = _hash_policy(policy_text)
        nw = load_northwind()
        agents = [dict(a) for a in nw["agents"]]
        collab_edges = nw.get("collaboration_edges", [])
        agents_by_id, collab, departments = build_lookups(agents, collab_edges)

        # ---- 1. parse ----
        yield {"type": "stage", "stage": "parsing", "elapsed_ms": elapsed_ms()}
        parsed = await parse_policy(policy_text)
        yield {"type": "parsed", "parsed_policy": parsed}

        # ---- 2. enrich ----
        yield {"type": "stage", "stage": "enriching", "elapsed_ms": elapsed_ms()}
        enrichments = await enrich_personas(agents, parsed)
        for a in agents:
            e = enrichments.get(a["id"], {})
            a["scenario_specific_context"] = e.get("scenario_specific_context", "")
            a["predisposition"] = e.get("predisposition", "neutral")
            a["predisposition_strength"] = e.get("predisposition_strength", 0.4)

        # ---- 3. schedule ----
        yield {"type": "stage", "stage": "scheduling", "elapsed_ms": elapsed_ms()}
        schedule = schedule_activity(agents, parsed, days=days, policy_hash=policy_hash)

        # ---- 4. act (streaming, day-by-day waves) ----
        yield {"type": "stage", "stage": "acting", "elapsed_ms": elapsed_ms()}

        actions: list[dict[str, Any]] = []
        prior_by_agent: dict[str, list[dict[str, Any]]] = {a["id"]: [] for a in agents}
        intra_day_counter: dict[int, int] = {}
        total = sum(len(schedule[d]) for d in schedule)
        completed = 0

        # Process days in 5-day chunks. Within a chunk, all calls fire
        # concurrently and stream as they complete. Between chunks,
        # prior_by_agent updates so later chunks reference earlier actions.
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

            sem = asyncio.Semaphore(CONCURRENCY)
            chunk_coros = [
                _bounded(
                    sem,
                    i,
                    select_action(
                        agents_by_id[aid],
                        parsed,
                        day=day,
                        peer_tone="neutral",
                        prior_actions=prior_by_agent[aid],
                    ),
                )
                for i, (day, aid) in enumerate(chunk_tasks)
            ]

            for fut in asyncio.as_completed(chunk_coros):
                i, result = await fut
                completed += 1
                day, aid = chunk_tasks[i]

                if isinstance(result, Exception):
                    yield {"type": "tick", "completed": completed, "total": total}
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

                # The wow moment: emit action immediately, in chronological day order
                yield {"type": "action", "action": action_record}
                yield {"type": "tick", "completed": completed, "total": total}

        # ---- 5. aggregate ----
        yield {"type": "stage", "stage": "aggregating", "elapsed_ms": elapsed_ms()}

        # sort actions by (day, intra_day_order) so the final array is deterministic
        actions.sort(key=lambda a: (a["day"], a["intra_day_order"]))

        snapshots = aggregate_sentiment(agents, actions, days=days)
        metrics = derive_metrics(agents, snapshots)
        cohort_metrics = _compute_cohort_metrics(agents, snapshots, actions)

        volume: dict[str, int] = {}
        for act in actions:
            volume[act["action_type"]] = volume.get(act["action_type"], 0) + 1

        themes_placeholder = _placeholder_themes(actions, agents_by_id)
        rec_placeholder = _placeholder_recommendation(parsed)

        delta = metrics["predicted"]["enps"] - metrics["baseline"]["enps"]
        li_count = volume.get("UPDATE_LINKEDIN", 0)
        summary = (
            f"Predicted {delta:+d} eNPS over 30 days. "
            f"{li_count} LinkedIn updates expected. "
            f"Top concern: {(themes_placeholder[0]['label'] if themes_placeholder else 'mixed')}."
        )

        result_obj = {
            "scenario_id": policy_hash,
            "policy_version": policy_version,
            "policy_text": policy_text,
            "parsed_policy": parsed,
            "model_version": "sim-0.3-action-based-stream",
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
            "computation_ms": elapsed_ms(),
            "fallback_used": False,
        }

        yield {"type": "result", "result": result_obj}

    except Exception as e:
        yield {"type": "error", "message": str(e)}
