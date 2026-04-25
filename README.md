# Lattice Predict

A wind tunnel for HR decisions. Paste any policy, watch your workforce act — message peers, vent in channels, go quiet, update LinkedIn — and edit before you ship.

Hackathon project. See [PRD.md](PRD.md) for the full spec.

## Repo layout

```
contracts/         schemas + canonical demo policies (locked, all teams build against these)
backend/           Python FastAPI simulation core (P1)
frontend/          Next.js app (P2 + P3) — coming
```

## Backend quick start

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then paste your ANTHROPIC_API_KEY
uvicorn main:app --port 8000 --reload
```

Endpoints:
- `GET  /health` — liveness
- `GET  /northwind` — the 50-agent workforce + collaboration edges (frontend renders the org graph from this)
- `POST /simulate` — full sim, returns SimulationResult JSON. Cached canonical policies return in ~10ms.
- `POST /simulate/stream` — SSE stream. Emits `stage`, `parsed`, `action`, `tick`, `result`, `error` events. The frontend's live action feed reads this.
- `POST /cache/warm` — pre-warms canonical RTO v1 + v2

## What's been built (P1, done)

- Policy parser, persona enricher, activity scheduler, action selector
- Sentiment aggregator (deterministic action → sentiment math)
- Top-level `simulate()` orchestrator
- Streaming variant with SSE endpoint
- Pre-cache layer (canonical results live in `backend/cache/`)

## What's pending

- **P2:** React Flow org graph with action edge animations
- **P3:** Scenario builder + results page + live action feed (SSE consumer)
- **P4:** Theme clusterer + recommendation generator (LLM modules)
- All: integration + polish

## Local demo

After backend is running:
```bash
curl -X POST http://localhost:8000/simulate \
  -H "content-type: application/json" \
  -d '{"policy_text": "Effective June 1, all employees in SF and NY must work in office Tue/Wed/Thu.", "policy_version": "v1"}'
```

First run takes ~140s (live LLM). Subsequent runs of the same text return instantly from cache.

## Deployment

Configured for Railway via `railway.json` + `nixpacks.toml`. Push to main, Railway auto-deploys. Set `ANTHROPIC_API_KEY` in Railway env vars.
