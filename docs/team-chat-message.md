## 🚀 Backend deployed + briefings ready

**Live URL:** `https://echo-production-4ead.up.railway.app`
**Repo:** `https://github.com/michaeltgao/Echo`
**Schema:** `contracts/simulation_result.schema.json`

### Endpoints
- `GET /northwind` → 50 agents + collaboration edges (drives the org graph)
- `POST /simulate` → full sim, ~200ms cached / ~140s live
- `POST /simulate/stream` → SSE event stream for live action feed
- `GET /health` → probe

CORS is open. Localhost dev hits prod URL directly.

### Briefings (please read before starting)
- **P3 (frontend product surface):** `docs/briefing-p3.md`
- **P4 (theme clusterer + recommendation):** `docs/briefing-p4.md`
- **P2 (graph viz):** read both above; coordinate Next.js scaffolding with P3

### Action type enum (locked, do not extend)
`VENT_TO_PEER`, `POST_IN_CHANNEL`, `MESSAGE_MANAGER`, `GO_QUIET`, `UPDATE_LINKEDIN`, `ADVOCATE`, `REQUEST_EXCEPTION`, `DO_NOTHING`

### Agent ID format
`emp_001` → `emp_050`. See `contracts/northwind.json` for full roster.

### Quick smoke test (run this first to confirm your network can hit prod)
```bash
curl https://echo-production-4ead.up.railway.app/health
# expect: {"status":"ok","service":"echo"}
```

### When you hit problems
- Backend / API issues → ping me (P1)
- SSE not streaming → check `await resp.ok` first; events should land within ~2s of POST
- Schema mismatch → schema is the source of truth, not what's currently in the response — flag and we'll align

### Daily ritual
Post these every few hours:
1. Done since last post
2. Blocked on (and who can unblock)
3. Doing next

🪁 wind tunnel for HR decisions, let's ship.
