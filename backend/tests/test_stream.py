"""Smoke test for /simulate/stream.

Connects to a running uvicorn (start it first: uvicorn main:app --port 8000)
and prints each event as it arrives. The 'action' events should land
progressively, NOT all at once — that's what proves streaming works.

Run from backend/:
  python -m tests.test_stream
"""
from __future__ import annotations

import asyncio
import json
import time

import httpx

RTO_V1 = """Effective June 1, 2026, all employees based in our San Francisco and New York offices are required to work from the office Tuesday, Wednesday, and Thursday each week. Exceptions will be reviewed case-by-case at manager discretion."""


async def main() -> None:
    t0 = time.time()
    action_count = 0
    first_action_at: float | None = None

    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream(
            "POST",
            "http://localhost:8000/simulate/stream",
            json={
                "policy_text": RTO_V1,
                "policy_version": "v1",
                "use_cache": False,  # force live to see streaming
            },
        ) as resp:
            event_type = None
            data_buf: list[str] = []
            async for line in resp.aiter_lines():
                if line.startswith("event:"):
                    event_type = line[6:].strip()
                elif line.startswith("data:"):
                    data_buf.append(line[5:].strip())
                elif line == "" and event_type:
                    payload = json.loads("\n".join(data_buf))
                    data_buf = []
                    elapsed = time.time() - t0

                    if event_type == "stage":
                        print(f"  [{elapsed:5.1f}s] STAGE {payload['stage']}")
                    elif event_type == "parsed":
                        p = payload["parsed_policy"]
                        print(f"  [{elapsed:5.1f}s] PARSED {p.get('category')} severity={p.get('severity')}")
                    elif event_type == "action":
                        action_count += 1
                        if first_action_at is None:
                            first_action_at = elapsed
                            print(f"  [{elapsed:5.1f}s] FIRST ACTION ARRIVED")
                        if action_count <= 5 or action_count % 20 == 0:
                            a = payload["action"]
                            content = (a.get("content") or f"[{a['action_type']}]")[:60]
                            print(f"  [{elapsed:5.1f}s] action #{action_count} d{a['day']:>2} "
                                  f"{a['agent_id']} {a['action_type']:<18} {content}")
                    elif event_type == "tick":
                        if payload["completed"] % 30 == 0:
                            print(f"  [{elapsed:5.1f}s] tick {payload['completed']}/{payload['total']}")
                    elif event_type == "result":
                        r = payload["result"]
                        d = r["predicted"]["enps"] - r["baseline"]["enps"]
                        print(f"\n  [{elapsed:5.1f}s] RESULT enps_delta={d:+d} "
                              f"actions={len(r['actions'])} computation_ms={r['computation_ms']}")
                    elif event_type == "error":
                        print(f"  [{elapsed:5.1f}s] ERROR: {payload['message']}")
                    event_type = None

    total = time.time() - t0
    print(f"\nTotal stream time: {total:.1f}s")
    print(f"Actions streamed: {action_count}")
    if first_action_at and action_count > 1:
        spread = total - first_action_at
        print(f"First action: {first_action_at:.1f}s | Action spread: {spread:.1f}s "
              f"({'STREAMING ✓' if spread > 2 else 'NOT STREAMING ✗ (all at once?)'})")


if __name__ == "__main__":
    asyncio.run(main())
