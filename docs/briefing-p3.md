# Briefing for P3 — Scenario Builder, Live Feed, Results, Compare

**TL;DR.** Hit `POST https://echo-production-4ead.up.railway.app/simulate/stream` with a policy text. Parse Server-Sent Events (SSE) frames. Render the live action feed as `action` events arrive, render the dashboard once the `result` event lands.

---

## The Live URL
```
https://echo-production-4ead.up.railway.app
```

CORS is `*`, so localhost dev works directly. No proxy needed.

---

## Endpoints You'll Hit

| Endpoint | Purpose | Latency |
|----------|---------|---------|
| `GET /northwind` | Workforce + collaboration edges. Coordinate with P2 — share this fetch. | ~500ms once |
| `POST /simulate` | Non-streaming full result. Use for v2 in compare view. | ~200ms cached, ~140s live |
| `POST /simulate/stream` | SSE event stream. **Use this for v1 in scenario flow.** | streams |

---

## SSE Event Format

Each frame:
```
event: <type>
data: <JSON payload>
<blank line>
```

Event types (parse and dispatch each):

### `stage`
Pipeline stage transitions. Drive your loading-state UX.
```json
{"type": "stage", "stage": "parsing", "elapsed_ms": 0}
```
Stages: `parsing` → `enriching` → `scheduling` → `acting` → `aggregating`

### `parsed`
Fires once after policy parser. Lets you show the parsed summary card immediately.
```json
{
  "type": "parsed",
  "parsed_policy": {
    "scenario_type": "policy_change",
    "category": "return_to_office",
    "summary": "...",
    "tone": "firm",
    "severity": 0.7,
    "dimensions_affected": ["autonomy", "flexibility", "commute"]
  }
}
```

### `action` (the wow moment — 100+ of these)
Each action is one agent doing one thing on one day.
```json
{
  "type": "action",
  "action": {
    "id": "act_d00_00",
    "day": 0,
    "intra_day_order": 0,
    "agent_id": "emp_001",
    "action_type": "MESSAGE_MANAGER",
    "target": {"type": "manager", "value": ""},
    "content": "I need to talk before this rolls out — my husband works night shifts...",
    "intensity": 0.78,
    "is_visible_to": ["emp_004"],
    "sentiment_impact": {"actor_delta": -0.013, "observer_delta": 0.0}
  }
}
```

### `tick`
Progress signal. Updates a "23 / 121 actions reacted" counter.
```json
{"type": "tick", "completed": 23, "total": 121}
```

### `result`
Fires once at the end with the full SimulationResult. Use this for the dashboard, heat map, themes, recommendation.
```json
{"type": "result", "result": { /* full SimulationResult, see schema */ }}
```

### `error`
Pipeline failure (rare). Show error UI.
```json
{"type": "error", "message": "..."}
```

---

## Action Type Enum (lock this down)

```ts
type ActionType =
  | "VENT_TO_PEER"
  | "POST_IN_CHANNEL"
  | "MESSAGE_MANAGER"
  | "GO_QUIET"
  | "UPDATE_LINKEDIN"
  | "ADVOCATE"
  | "REQUEST_EXCEPTION"
  | "DO_NOTHING";
```

Suggested visual treatment per type:
| Type | Color | Icon | Note |
|------|-------|------|------|
| VENT_TO_PEER | orange | message-circle | shows in feed with content |
| POST_IN_CHANNEL | red | hash | shows in feed with content |
| MESSAGE_MANAGER | blue | mail | shows in feed with content |
| REQUEST_EXCEPTION | yellow | file-text | shows in feed with content |
| ADVOCATE | green | thumbs-up | shows in feed with content |
| UPDATE_LINKEDIN | purple | briefcase | feed card without content, dramatic |
| GO_QUIET | gray | x-circle | feed card without content, somber |
| DO_NOTHING | (don't show) | — | skip in feed for noise reduction |

---

## Frontend SSE Parsing Pattern

```typescript
const resp = await fetch(`${API_URL}/simulate/stream`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ policy_text, policy_version: 'v1' })
});

const reader = resp.body!.getReader();
const decoder = new TextDecoder();
let buf = '';

while (true) {
  const {done, value} = await reader.read();
  if (done) break;
  buf += decoder.decode(value, {stream: true});
  let frames = buf.split('\n\n');
  buf = frames.pop()!;  // incomplete frame stays in buffer
  for (const frame of frames) {
    const lines = frame.split('\n');
    const eventLine = lines.find(l => l.startsWith('event:'));
    const dataLine = lines.find(l => l.startsWith('data:'));
    if (!eventLine || !dataLine) continue;
    const type = eventLine.slice(6).trim();
    const data = JSON.parse(dataLine.slice(5).trim());
    handleEvent(type, data);  // dispatch to your store
  }
}
```

---

## Important Quirks

1. **Cached canonical policies replay at 50ms/action.** When users paste the canonical RTO v1 (or click the demo button), the actions stream in instantly. Same code path — your UI shouldn't care.

2. **For non-cached policies, actions arrive in chronological-ish day order**, with concurrency within each 5-day chunk. Expect bursts of actions from days 0-4, then 5-9, etc.

3. **`is_visible_to` is the audience for that action.** Use it for graph animations (which agents see this) and to compute sentiment spread visualizations.

4. **`target.type` varies by action**: `agent` (vent), `channel` (post / advocate), `manager` (message), `none` (quiet), `external` (linkedin).

5. **`fallback_used` flag on the final result.** If true, surface a "Confidence: medium" badge on the dashboard.

---

## Narrative Arcs (look for these in the feed UI)

Same `agent_id` may appear multiple times. Group them so judges see the story:

> **Greg Stevens (emp_023)**
> Day 0: MESSAGE_MANAGER — "Need to talk through the new office schedule..."
> Day 5: REQUEST_EXCEPTION — "Following up on our conversation..."
> Day 11: VENT_TO_PEER — "Manager hasn't responded, eleven days in"
> Day 20: GO_QUIET
> Day 27: UPDATE_LINKEDIN

That's the cinematic story. If your feed UI can collapse-then-expand by agent, judges will lean forward.

---

## Schema Source of Truth

`contracts/simulation_result.schema.json` (also at `backend/contracts/simulation_result.schema.json`).

Generate TypeScript types from it:
```bash
npx json-schema-to-typescript contracts/simulation_result.schema.json > frontend/types/simulation.ts
```

---

## What to Build First (your task #1)

1. Scaffold Next.js scenario builder page with textarea + run button
2. Wire SSE consumer to a Zustand store with action `addAction(action)`
3. Render a dead-simple feed component that renders new actions as they come in
4. Test with the live Railway URL — paste any policy, watch feed populate

That's enough to confirm the pipe works. Then build the dashboard around the `result` event.

---

## When Things Break

Backend issues → ping P1 (me). I'll diagnose in <5 min from Railway logs.

If the SSE stream just hangs and never produces events: most likely the Anthropic key on Railway is rate-limited or the policy text is malformed. The backend should still emit an `error` event — if you don't see one, check `await resp.ok` first.
