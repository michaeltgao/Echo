"""FastAPI app exposing POST /simulate.

The frontend calls this and gets back a SimulationResult matching
contracts/simulation_result.schema.json.

Cache is checked first — canonical RTO v1/v2 return in ~10ms. Cache miss
runs the live simulation pipeline (~70-130s) and caches the result on the
way out.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import json as _json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from sim import cache
from sim.simulator import load_northwind, simulate
from sim.simulator_stream import simulate_stream

ROOT = Path(__file__).resolve().parent

app = FastAPI(title="Echo", version="0.3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before deploy
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimulateRequest(BaseModel):
    policy_text: str = Field(min_length=10, max_length=8000)
    policy_version: str = Field(default="v1", pattern=r"^v\d+$")
    days: int = Field(default=30, ge=7, le=60)
    use_cache: bool = True


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "echo"}


@app.get("/northwind")
def northwind() -> dict[str, Any]:
    """Frontend fetches the workforce roster + collaboration edges to render the org graph."""
    return load_northwind()


@app.post("/simulate")
async def post_simulate(req: SimulateRequest) -> dict[str, Any]:
    if req.use_cache:
        cached = cache.get(req.policy_text)
        if cached is not None:
            cached["_cache_hit"] = True
            cached["policy_version"] = req.policy_version  # honor caller override
            return cached

    try:
        result = await simulate(
            req.policy_text,
            policy_version=req.policy_version,
            days=req.days,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {e}") from e

    cache.put(req.policy_text, result)
    result["_cache_hit"] = False
    return result


@app.post("/simulate/stream")
async def post_simulate_stream(req: SimulateRequest) -> StreamingResponse:
    """Server-Sent Events endpoint. Emits stage transitions, individual actions
    as they complete, and the final result.

    Frontend usage:
      const resp = await fetch('/simulate/stream', {method: 'POST', body: ...})
      const reader = resp.body.getReader()  // parse SSE frames
    Or with EventSource semantics, hit GET variant /simulate/stream-get.

    On cache hit we still stream — emit the cached actions one by one so the
    feed UX is identical for canonical demos. ~50ms between actions for pacing.
    """
    if req.use_cache:
        cached = cache.get(req.policy_text)
        if cached is not None:
            return StreamingResponse(
                _replay_cached(cached, req.policy_version),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

    async def event_source():
        result_to_cache = None
        async for event in simulate_stream(
            req.policy_text,
            policy_version=req.policy_version,
            days=req.days,
        ):
            if event["type"] == "result":
                result_to_cache = event["result"]
            yield _sse_frame(event)
        if result_to_cache is not None:
            cache.put(req.policy_text, result_to_cache)

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _sse_frame(event: dict) -> str:
    """Format a dict as one SSE frame. event field is the type, data is the payload."""
    et = event.get("type", "message")
    payload = _json.dumps(event)
    return f"event: {et}\ndata: {payload}\n\n"


async def _replay_cached(cached: dict, policy_version: str):
    """Replay a cached result as an SSE stream so frontend behavior is identical."""
    import asyncio

    cached = dict(cached)
    cached["policy_version"] = policy_version

    yield _sse_frame({"type": "stage", "stage": "parsing", "elapsed_ms": 0, "_cached": True})
    yield _sse_frame({"type": "parsed", "parsed_policy": cached.get("parsed_policy", {})})
    yield _sse_frame({"type": "stage", "stage": "enriching", "elapsed_ms": 5, "_cached": True})
    yield _sse_frame({"type": "stage", "stage": "scheduling", "elapsed_ms": 10, "_cached": True})
    yield _sse_frame({"type": "stage", "stage": "acting", "elapsed_ms": 15, "_cached": True})

    actions = cached.get("actions", [])
    total = len(actions)
    # Pace cached replay at 250ms/action so a typical ~120-action canonical
    # run lands in ~30s — same beat as /graph's 1s-per-day playback.
    # Frontend cards appear in real time with room to read each one and
    # graph animations have room to play out (cap is 5 concurrent at 700ms).
    PACE_MS = 250
    for i, act in enumerate(actions):
        yield _sse_frame({"type": "action", "action": act})
        yield _sse_frame({"type": "tick", "completed": i + 1, "total": total})
        await asyncio.sleep(PACE_MS / 1000)

    yield _sse_frame({"type": "stage", "stage": "aggregating", "elapsed_ms": int(total * PACE_MS) + 20})
    yield _sse_frame({"type": "result", "result": cached})


@app.post("/cache/warm")
async def warm_cache() -> dict[str, Any]:
    """Run + cache the two canonical RTO policies. Call once after deploy."""
    canonical_path = ROOT.parent / "contracts" / "canonical_policies.md"
    # Ad-hoc parsing — the canonical_policies.md file structure isn't formal,
    # but the two policy bodies are stable. Hardcode here for reliability.
    policies = _load_canonical_policies()

    results = {}
    for name, text in policies.items():
        result = await simulate(text, policy_version="v1" if "v1" in name else "v2")
        cache.put(text, result)
        results[name] = {
            "computation_ms": result["computation_ms"],
            "enps_delta": result["predicted"]["enps"] - result["baseline"]["enps"],
        }
    return {"warmed": results}


def _load_canonical_policies() -> dict[str, str]:
    return {
        "rto_v1": """Effective June 1, 2026, all employees based in our San Francisco and New York offices are required to work from the office Tuesday, Wednesday, and Thursday each week. This policy applies to all departments and levels.

We believe in-person collaboration is essential to building the products our customers need and the culture we want to be known for. The era of indefinite remote flexibility is ending, and we are aligning with industry best practices.

Exceptions will be reviewed case-by-case at manager discretion. Employees who cannot meet the in-office requirement should discuss alternatives with their manager.

We are confident this change will accelerate execution, strengthen mentorship, and improve company performance. We appreciate your partnership in this transition.""",
        "rto_v2": """Starting September 1, 2026, we are moving to a hybrid collaboration model for our San Francisco and New York offices. The default expectation is two days per week in-office (Tuesday and Wednesday), with the third day flexible at the team level.

Why we're doing this: Customer-facing teams have asked for more in-person time for cross-functional planning, and our engineering retros consistently rate hybrid sprints highest. We piloted this model with the Sales team in Q1 and saw measurable lift in pipeline velocity.

What's changing for you:
- Two anchor days (Tue/Wed) for cross-team collaboration
- One flexible team-choice day, owned by your manager and team
- Caregiving, medical, and accessibility exceptions are guaranteed, not discretionary — apply through People Ops, not your manager
- Fully-remote roles remain fully-remote; this policy applies to those already assigned to an office
- Three-month ramp: optional in June–August, expected starting September

We'll run a pulse survey 30 and 90 days after rollout and adjust based on what we learn. This is a starting point, not a final answer.""",
    }
