# Echo

> Building of Lattice (YC W16)

> A wind tunnel for HR decisions. Paste any policy, watch your workforce *act* — message peers, vent in channels, go quiet, update LinkedIn — and edit before you ship.

Echo simulates how 50 synthetic employees, modeled with motivators, sensitivities, and trust networks, will behave in the 30 days after you announce a workplace policy. You see the morale hit before it happens, the cohorts that will push back, and exactly what they'll say. Then you change a few words and watch the same workforce stay calm.

See [PRD.md](PRD.md) for the full product spec. Hacktech Project: Michael Gao, Jadon Lam, Jan Safrata, Nicholas Ciordas

---

## Live demo

**[echosim.tech](https://echosim.tech)**

The fastest path to seeing it work: open the site, click `Sample run`, then click the big amber **PLAY** button. A 30-day simulation of the canonical RTO mandate plays out in ~30 seconds.

---

## What it does

| Surface | What you do |
|---|---|
| `/` | Editorial landing page — overview + nav |
| `/graph` | "Sample run" — pre-loaded canonical RTO v1/v2 sims; toggle between them, hit play, watch sentiment cascade through the org graph day-by-day with a live action ledger |
| `/predict/new` | "Run your own" — paste any policy text, the live SSE stream populates the graph and timeline as 50 simulated employees react in real time |
| `/predict/[id]/results` | Full dashboard: cohort heat map, all themes, all quotes |
| `/predict/compare` | Side-by-side v1 vs v2 |

---

## How the simulation works

```
Policy text
   ↓
1. Policy parser           (1 LLM call, ~3s)   →  structured features
2. Persona enricher        (1 batched call,    →  scenario-specific context
                            ~40s for 50 agents)    per agent
3. Activity scheduler      (deterministic)     →  who acts on which day
4. Action selector         (~100 LLM calls,    →  one of 8 actions per
                            parallel batches)      (agent, day) slot
5. Sentiment aggregator    (deterministic)     →  per-day per-agent sentiment
6. Theme clusterer         (1 LLM call)        →  top 3 concerns
7. Recommendation gen      (1 LLM call)        →  rewritten policy
   ↓
SimulationResult JSON
```

Agents pick discrete **actions** rather than abstract sentiment scores:

```
VENT_TO_PEER · POST_IN_CHANNEL · MESSAGE_MANAGER · REQUEST_EXCEPTION
ADVOCATE · GO_QUIET · UPDATE_LINKEDIN · DO_NOTHING
```

Sentiment is *derived* from the action mix per cohort, then used to compute predicted eNPS. Influence propagates through reporting lines and a 33-edge collaboration graph (`is_visible_to` per action determines who sees what).

---

## Built with

**Languages.** TypeScript, Python 3.11.

**Frontend.** Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS 4 · React Flow · D3-Force · Framer Motion · Zustand · Server-Sent Events. Editorial type system with Fraunces / Instrument Sans / JetBrains Mono.

**Backend.** FastAPI · Uvicorn · Pydantic 2 · Anthropic SDK · httpx · python-dotenv.

**AI.** Anthropic Claude Sonnet 4.5 (hot-path: policy parser, persona enricher, ~100 action-selection calls per simulation). Claude Opus 4.5 (quality-critical: theme clustering, recommendation rewrite).

**Hosting.** Vercel (frontend) · Railway (backend) · GitHub (source + CI trigger). Nixpacks build pipeline.

**Inspiration.** [MiroFish](https://github.com/666ghj/MiroFish) (open-source swarm-intelligence engine) — informed the action-based agent simulation pattern. Echo retargets the same approach at workplace scenarios.

---

## Repo layout

```
echo/
├── backend/                Python FastAPI simulation core
│   ├── sim/                Simulation pipeline
│   │   ├── policy_parser.py        text → structured features
│   │   ├── persona_enricher.py     scenario-specific context per agent
│   │   ├── activity_scheduler.py   who acts on which day (deterministic)
│   │   ├── action_selector.py      LLM call per (agent, day) slot
│   │   ├── sentiment_aggregator.py action → derived sentiment math
│   │   ├── theme_clusterer.py      LLM call producing top 3 themes
│   │   ├── recommendation.py       LLM call producing rewritten policy
│   │   ├── simulator.py            top-level orchestrator
│   │   ├── simulator_stream.py     streaming variant for /simulate/stream
│   │   ├── llm.py                  Anthropic client wrapper
│   │   ├── cache.py                disk cache for canonical results
│   │   └── actions.py              8-action enum + sentiment-impact table
│   ├── cache/              Pre-warmed canonical RTO v1 + v2 simulations
│   ├── contracts/          Northwind workforce JSON, schema, demo policies
│   ├── tests/              Hour-4 gate, full-sim, wild policies, v1-vs-v2
│   ├── main.py             FastAPI app + endpoints
│   ├── requirements.txt
│   └── railway.json        Railway deploy config
│
├── frontend/               Next.js 16 app
│   ├── app/
│   │   ├── page.tsx                Editorial landing
│   │   ├── graph/page.tsx          Sample-run page (setup → playing → settled)
│   │   ├── predict/new/page.tsx    Scenario builder (idle → running → done)
│   │   ├── predict/compare/        v1 vs v2 side-by-side
│   │   ├── predict/[id]/results/   Full results dashboard
│   │   └── components/
│   │       ├── graph/              OrgGraph, AgentNode, AgentPopover,
│   │       │                       AnimationLayer, PolicyMemo,
│   │       │                       PlaybackControls, DayTimeline,
│   │       │                       FinalReport
│   │       ├── feed/               ActionFeed + ActionCard
│   │       ├── predict/            PolicyTextarea, LoadingProgress
│   │       └── compare/            SideStats, HeadlineDelta, ActionVolumeBar
│   ├── lib/
│   │   ├── store.ts                Zustand state machine
│   │   ├── sse.ts                  SSE consumer for /simulate/stream
│   │   ├── api.ts                  REST helpers + canonical policies
│   │   ├── actionStyle.ts          Per-action visual treatment
│   │   └── graph/                  layout, sentiment, animations,
│   │                               usePlayback, useActionAnimator
│   ├── package.json
│   └── (next config)
│
├── contracts/              Source-of-truth schema artifacts
│   ├── northwind.json              50-agent synthetic workforce
│   ├── simulation_result.schema.json
│   └── canonical_policies.md       The two demo RTO drafts
│
├── docs/                   Team briefings (P3 SSE format, P4 module specs)
└── PRD.md                  Full product spec
```

---

## Quickstart

### Backend (local)

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env       # paste ANTHROPIC_API_KEY
uvicorn main:app --port 8000 --reload
```

### Frontend (local, hits Railway by default)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

To point the frontend at a local backend instead:

```bash
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > frontend/.env.local
```

---

## API

The backend is a FastAPI app deployed on Railway. The hosted base URL is configured client-side in `frontend/lib/api.ts` and overridable via the `NEXT_PUBLIC_API_URL` env var.

| Endpoint | Method | What it does |
|---|---|---|
| `/health` | GET | Liveness probe |
| `/northwind` | GET | 50-agent workforce + 33 collaboration edges (frontend renders the org graph from this) |
| `/simulate` | POST | One-shot simulation. ~200ms cached canonical / ~140s live LLM |
| `/simulate/stream` | POST | Server-Sent Events stream. Cached canonical replays day-by-day at 1s/day (~30s total). Live runs stream actions as they're generated. |
| `/cache/warm` | POST | Re-run + cache canonical RTO v1 + v2. Run once after a fresh deploy. |

### SSE event types (from `/simulate/stream`)

```
event: stage     {stage: "parsing"|"enriching"|"scheduling"|"acting"|"aggregating"}
event: parsed    {parsed_policy: {...}}
event: action    {action: {agent_id, action_type, day, content, target, ...}}
event: tick      {completed, total}
event: result    {result: {...full SimulationResult...}}
event: error     {message}
```

---

## Demo flow

1. Open the frontend, navigate to `/graph`.
2. The page mounts with both canonical RTO v1 (firm) and v2 (recommended) pre-fetched. Read the policy on the left.
3. Click **PLAY THE SAMPLE**.
4. The layout shifts — graph slides to the left, daily ledger appears on the right. Sentiment cascades through 50 agents over 30 simulated days. Actions appear in the ledger as they happen, narrating what each employee said.
5. After ~30 seconds, **FinalReport** lands: predicted eNPS delta (e.g. `-14`), top 3 concerns, recommendation, and a single CTA: **PLAY THE REWRITE (V2)**.
6. Click that CTA. Same workforce, calmer cascade, much smaller eNPS drop.

For a custom policy: navigate to `/predict/new`, paste your own text, click Run. The live SSE stream populates the graph and timeline as the LLM pipeline emits actions.

---

## Key design decisions

**Action-based agents, not sentiment scores.** Following MiroFish's framing, agents choose what they *do* — vent, post, message manager, update LinkedIn — and sentiment is computed from the observed action mix. This produces stories ("Greg messaged manager day 0, requested formal exception day 5, vented to peer day 11 with 'manager hasn't responded', went quiet day 20, updated LinkedIn day 27") rather than just numbers.

**Pre-cached canonical results.** The two RTO sims (firm + recommended rewrite) are committed to disk as JSON. The `/simulate/stream` endpoint replays them day-by-day so the demo is instant and zero-cost. Live (custom) policies hit the full LLM pipeline.

**1 second per day, day-by-day bursts.** Both `/graph` (replay) and `/predict/new` (live SSE) animate at the same rhythm — 30 seconds for 30 days, with all of a day's actions bursting together so the eye can follow the cascade. Calibrated by `playbackMs = 30000` on the frontend and `DAY_MS = 1000` on the backend's cached replay.

**Editorial design language.** Warm-ink palette (off-black `#161210` background, bone `#ece4d6` text, burnished amber `#c4892b` accent). Fraunces / Instrument Sans / JetBrains Mono pairing. Hairline rules instead of cards. Avoids the generic "AI dashboard" aesthetic.

**Privacy-by-design.** Cohort-level outputs by default, no individual targeting; the underlying schema enforces minimum cohort sizes for sensitive metrics. Echo is positioned as decision support, not automated HR.

---

## Roadmap

| Module | Surface | Status |
|---|---|---|
| Policy Predict | Lattice Engagement | Live |
| Compensation Predict | Lattice Compensation | In build |
| Goals Predict | Lattice Goals | Horizon |
| Career Predict | Lattice Grow | Horizon |
| Reorg Predict | Lattice HRIS | Horizon |

Same simulation engine, different scenario inputs. Today's policy module proves the approach; the same action-based agent network extends to compensation strategies, OKR cadence changes, career-ladder redesigns, and reorg friction modeling.

---

## License

No license declared.
