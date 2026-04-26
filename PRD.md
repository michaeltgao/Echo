# PRD: Echo (Hackathon MVP v3)

**Posture:** Build for "works for anybody," demo the canonical path.
**Inspiration:** MiroFish-style action-based agent simulation, retargeted at workforce scenarios.

**One-line pitch:** A wind tunnel for HR decisions. Paste any policy, watch your workforce *act* — message peers, vent in channels, go quiet, update LinkedIn — and edit before you ship.

---

## 1. Product Goal

Two things true at once:

1. **Real product.** Any policy → coherent simulation. No scripted-only paths.
2. **Cinematic demo.** Open with canonical RTO v1 → v2 because it produces the most dramatic visual.

Success = a judge says "let me try mine" and walks away impressed.

## 2. The Big Architectural Shift (vs. v2)

**v2 modeled sentiment as a number.** Agents had a sentiment_delta; we propagated it across a graph.

**v3 models behavior, not feelings.** Each agent picks an *action* per active day:
- `VENT_TO_PEER` — DMs a coworker
- `POST_IN_CHANNEL` — broadcasts to department
- `MESSAGE_MANAGER` — 1:1 escalation
- `GO_QUIET` — withdrawal (a strong negative signal)
- `UPDATE_LINKEDIN` — flight risk surface
- `ADVOCATE` — defends the policy to peers
- `REQUEST_EXCEPTION` — formal HR ask
- `DO_NOTHING` — agent inactive this day

**Why this matters:**
- Cinematic: judges see actual messages flowing across the org graph, not abstract colors
- Realistic: matches how humans actually react (behavior-first, sentiment emerges)
- Differentiated: every other "AI HR" demo shows dashboards. We show a workforce *acting*.
- MiroFish-aligned: this is the core insight worth stealing — agents do things, sentiment is derived.

Sentiment becomes a *derived metric* aggregated from the action mix per cohort. eNPS still drops in the dashboard — it's just computed from observed behavior, not assigned by the LLM.

## 3. The Demo (Anchor Path)

| Time | Beat | Screen |
|------|------|--------|
| 0:00 | Hook | "Last year a company announced RTO on a Tuesday. By Friday, 40 engineers updated LinkedIn." |
| 0:20 | Open app | Northwind workforce loaded |
| 0:40 | Paste RTO v1 | Textbox + Run |
| 1:00 | **Animation** | Org graph + live action feed: "Day 1: Priya posted in #engineering: 'this feels like a trust issue.' Marcus liked it. 3 ICs viewed but stayed quiet." |
| 1:30 | Cascade visible | Day 3: vent edges pulsing across senior engineers. Day 7: 8 LinkedIn updates. Day 14: Sarah requests 1:1 with VP. |
| 1:45 | Results | eNPS +22 → +9, heat map, themes, quotes (taken from actual agent message content) |
| 2:30 | Apply Recommendation | Pre-fills v2 |
| 2:45 | Run v2 | Calmer feed: 1 vent, 4 advocates, no LinkedIn updates |
| 3:15 | Compare view | Side-by-side action volumes + eNPS deltas |
| 3:45 | **Bonus** | "Want to try yours?" — judge's policy, live |
| 4:30 | Close | "Wind tunnel for people decisions." |

The action feed is the new wow moment. Don't bury it.

## 4. What "Works for Anybody" Requires

System handles:
- Any policy type (RTO, comp, layoffs, benefits, dress code, hiring freeze, parental leave)
- Any tone (firm, conciliatory, vague, detailed)
- Any length (paragraph to multi-page)
- Edge inputs (very short, very long, off-topic) — degrades gracefully

Doesn't need:
- Non-English
- Industries Northwind doesn't represent (factory, retail)
- Pure nonsense — returns "low confidence, unclear scenario"

## 5. Architecture

```
Policy text
  ↓
Policy Parser (1 LLM call) → structured policy features
  ↓
Persona Enricher (1 batched LLM call) → policy-specific traits added to each agent
  ↓
Activity Scheduler (deterministic) → which agents act on which days
  ↓
For each simulation day (1–30):
  - Active agents picked (5–15/day, weighted by influence + day)
  - Each active agent: LLM picks ACTION + writes CONTENT, in parallel batches of 10
  - Actions update graph state (peer messages reach neighbors, channel posts reach department)
  - Action streamed to frontend feed
  ↓
Sentiment Aggregator (deterministic) → per-cohort sentiment derived from action mix
  ↓
Theme Clusterer (1 LLM call over all action contents) → top 3 themes + quotes
  ↓
Recommendation Generator (1 LLM call) → suggested rewrite + projected impact
  ↓
Result JSON
```

**LLM calls per simulation:** ~110-150 (1 parse + 1 enrich + 100-130 actions + 1 themes + 1 rec)
**Target latency:** <60s with batched parallelism (10 concurrent)
**Model:** claude-sonnet-4-6 default

### Why this shape

- **Action choice is the LLM's hardest job** — make it the bulk of compute, with rich persona + neighborhood context
- **Sentiment is computed, not generated** — actions like UPDATE_LINKEDIN map to higher sentiment drop than VENT_TO_PEER. Deterministic mapping.
- **Activity scheduler is deterministic** — influencers more likely to act early, peers later. No LLM needed for who-acts-when.
- **Themes extracted from real content** — clusterer reads what agents actually wrote, not what they "felt"

## 6. Critical Contracts

P1 owns each. Lock these at kickoff.

### 6.1 Policy Parser Output
```json
{
  "scenario_type": "policy_change | compensation | reorg | layoff | benefits | other",
  "category": "return_to_office | comp_freeze | bonus_change | ...",
  "summary": "One sentence describing what's changing",
  "affected_groups": ["all", "engineering", "sf_office", ...],
  "effective_date_relative": "immediate | weeks | months | unspecified",
  "tone": "firm | conciliatory | neutral | vague",
  "has_business_rationale": true,
  "has_exceptions": true,
  "exception_authority": "manager | hr | guaranteed | none",
  "dimensions_affected": ["commute", "flexibility", "compensation", "career_growth", "fairness", "autonomy", "caregiving"],
  "severity": 0.7
}
```

### 6.2 Persona Enrichment Output (per agent)
```json
{
  "agent_id": "emp_001",
  "scenario_specific_context": "Has two kids; commute from Oakland is 90 minutes one-way; recently mentioned considering remote-first companies in last 1:1.",
  "predisposition": "negative | neutral | positive",
  "predisposition_strength": 0.85
}
```
Cached per (agent_id, policy_hash). Single LLM call processes all 50 agents in one prompt.

### 6.3 Agent Action Output (strict schema)
```json
{
  "agent_id": "emp_001",
  "day": 3,
  "action_type": "POST_IN_CHANNEL",
  "target": {
    "type": "channel",
    "value": "#engineering"
  },
  "content": "If the goal is collaboration, that's a team conversation, not a mandate from above. Disappointed.",
  "intensity": 0.75,
  "is_visible_to": ["emp_002", "emp_003", "emp_006", ...]
}
```
- Strict JSON mode + retry once
- Heuristic fallback if LLM fails: pick action from predisposition × policy.severity, generate templated content
- Actions never break the demo

### 6.4 Action → Sentiment Mapping (deterministic)

| Action | Sentiment delta on actor | Spread to visible agents |
|--------|-------------------------|------------------------|
| ADVOCATE | +0.05 | +0.03 |
| DO_NOTHING | 0 | 0 |
| VENT_TO_PEER | -0.10 | -0.05 |
| POST_IN_CHANNEL | -0.15 | -0.07 |
| MESSAGE_MANAGER | -0.12 | 0 (private) |
| REQUEST_EXCEPTION | -0.08 | 0 |
| GO_QUIET | -0.20 | 0 (signal not visible) |
| UPDATE_LINKEDIN | -0.30, flag flight risk | -0.05 to peers who notice |

Cohort sentiment = baseline + sum of (action deltas) over 30 days, clamped [0, 1].

### 6.5 Simulation Result (frontend contract)
See `contracts/simulation_result.schema.json` (will be updated to include actions array). P2 and P3 build against this.

## 7. Defensive Engineering

- Strict JSON mode for every LLM call
- Retry once on parse failure, then heuristic fallback
- Validate every field before returning to frontend
- Heuristic action selection: based on predisposition × policy.severity × persona sensitivities, choose action from a weighted distribution
- Templated content fallback: "I'm worried about [primary sensitivity] given the new policy."
- Never crash. Never return malformed JSON.

## 8. Pre-Cache Layer (speed, not safety)

Cache canonical results by `hash(policy_text)`:
- RTO v1 → instant (~200ms)
- RTO v2 → instant
- Cache miss → run live (~60s)

Same code path. Pre-cache is a perf win for the demo flow only.

## 9. Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js + React + Tailwind + Framer Motion |
| Graph viz | React Flow (force-directed) |
| Charts | Recharts |
| Backend | Python FastAPI, async |
| LLM | Anthropic Claude (sonnet-4-6) |
| Workforce data | `contracts/northwind.json` |
| Cache | In-memory dict |
| Deployment | Vercel + Railway/Render |

## 10. Team Split (4 builders)

### P1 — Simulation Core
**The brain. Hardest job. Most LLM work.**

Deliverables:
- Policy parser (prompt + schema)
- Persona enricher (single batched call across 50 agents)
- Activity scheduler (deterministic — who acts on which day)
- Agent action selector (LLM call per active agent, parallel batches of 10)
- Action → sentiment aggregator (deterministic math)
- Heuristic fallback path for failed LLM calls
- `POST /simulate` endpoint returning full result
- Pre-cache layer

**Hour 4 go/no-go:** action selector produces clean structured output across 3 policy types (RTO, comp freeze, layoff) for 5 different personas. If broken, all-hands debug.

### P2 — Hero Visual + UI Polish
**Owns the wow moment.**

Deliverables:
- React Flow org graph with force layout
- Persona popover on hover
- **Action edge animations** — when an agent acts, animate a pulse from sender to recipient(s)
  - Vent: pulse along peer edge
  - Channel post: ripple out to whole department
  - LinkedIn update: node icon morphs, brief halo effect
  - Manager message: pulse up the reporting line
- Timeline scrubber (play/pause/scrub all 30 days)
- Sentiment color background as agents change state (derived layer behind action animations)
- Loading state: "Day 1 of 30… 12 agents reacted"
- Framer Motion polish across the app

### P3 — Scenario Builder + Results + Compare + Action Feed
**Owns product surface.**

Deliverables:
- Scenario builder: textarea, "Run Simulation," optional Northwind preset
- **Live action feed component** — scrolling list synced to timeline, showing each action as a card with timestamp, agent, action type icon, content text. THIS IS THE NEW HERO MOMENT.
- Results page: predicted pulse, heat map, theme cards, quotes (pulled from real action content)
- Recommendation card with "Apply to v2"
- Compare view: side-by-side v1 vs v2, including action volume comparison ("8 LinkedIn updates → 1")
- Empty/error/low-confidence states

### P4 — Theme Engine, Recommendations, Glue, Demo
**Owns integration + AI modules + pitch.**

Deliverables:
- **Theme clusterer** — takes all action.content strings, clusters into 3 themes with representative quotes (1 LLM call)
- **Recommendation generator** — takes themes + parsed policy → suggested rewrite + projected impact
- Frontend ↔ backend wiring
- Cache layer integration
- Deployment (Vercel + Railway)
- Demo script + 5+ rehearsals
- Slide deck
- Backup recorded demo
- Final pitch delivery

P4 is the "anything goes wrong, P4 catches it" role.

## 11. Build Schedule

### Day 1 — Foundations (~10 hrs)

**Hour 0–1: Kickoff (everyone)**
- Read PRD + contracts together
- Lock schemas (especially the action schema)
- Roles, branches, API keys
- Each person commits to Hour 4 deliverable

**Hour 1–4: Solo phase 1**
- P1: Policy parser + agent action selector. Test on 1 agent × 3 policies.
- P2: Static org graph rendering 50 nodes from northwind.json
- P3: Scenario builder + results shell + action feed component (mock data)
- P4: Slide outline, canonical policies finalized, deployment scaffolding

**Hour 4: Go/no-go gate**
- P1 demos action selector on 3 policy types × 5 personas
- All others check in

**Hour 4–10: Solo phase 2**
- P1: Persona enricher, activity scheduler, full /simulate endpoint
- P2: Action edge animations, timeline scrubber
- P3: Heat map, themes, recommendation card, compare view
- P4: Theme clusterer, recommendation generator, deployment live

### Day 2 — Integration & Polish (~10 hrs)

**Hour 0–4: Wire it together**
- Real backend in. Mocks out.
- Find contract mismatches, fix.
- P4 leads.

**Hour 4–6: End-to-end testing**
- Canonical RTO v1 → v2: 10 runs, fix bugs
- 5 random policies (Reddit/HN), fix breakages
- Cache canonical results

**Hour 6–9: Polish**
- P2 leads. No new features.
- Animations, transitions, copy, color
- P4 records backup demo

### Final 2–4 hrs — Rehearsal
- Demo script 5+ times
- Cut anything that breaks twice
- Final deploy. Tag release. Stop coding.

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| LLM latency >60s | Parallel batching (10 concurrent), sonnet-4-6, only 5-15 actions/day not 50 |
| LLM produces malformed JSON | Strict JSON mode, retry once, heuristic action fallback |
| Action content sounds generic | Persona-rich prompts include enriched scenario context |
| Action feed scrolls too fast/slow | Tunable playback speed, pause-to-read affordance |
| Animation overload (too many edges firing) | Cap simultaneous animations at 3-5; queue overflow |
| Demo wifi fails | Pre-cached canonical + recorded backup |
| Judge pastes weird input | Defensive validation, low-confidence output, never crash |
| Integration day chaos | Locked contracts day 1, P4 owns integration |
| Polish gets cut | Day 2 hour 6–9 reserved, no new features after hour 6 |
| Action types wrong / missing | Lock action enum at kickoff. No additions after Hour 4. |

## 13. Non-Goals

- Auth, multi-tenant, real Lattice integration
- Compensation or reorg modules (slides as "next")
- Backtesting infrastructure
- Privacy/RBAC enforcement (UI labels only)
- Persistence beyond in-memory
- Real-time collab
- Mobile-first
- i18n
- Twitter/Reddit-style threading and likes (we're a workplace, not social media)
- Karma, followers, viral thresholds

## 14. Stretch Goals (only if Day 2 hr 4 ahead)

In priority:
1. **Manager FAQ generator** — exportable doc for v2 policy
2. **Comm channel toggle** — Slack vs. all-hands changes initial action distribution
3. **Voice input** — speak the policy
4. **Custom workforce upload** — upload your own org
5. **Agent interview** — click an agent post-sim, ask "why did you go quiet?" → LLM responds in character

## 15. The Pitch (90 sec)

> HR teams are reactive. They announce a policy on Tuesday and learn what went wrong on Friday — through pulse surveys, Slack rumors, and resignations.
>
> Echo is a wind tunnel for people decisions. Paste your draft policy and we simulate how 50 employee personas — modeled on real archetypes with motivators, sensitivities, trust networks, and scenario-specific context — will *act* over 30 days.
>
> Not abstract sentiment. Real behavior. They DM peers. Vent in channels. Go quiet. Update LinkedIn. Request exceptions.
>
> [DEMO: RTO v1 — watch the cascade]
>
> You see eNPS drop *because* you watched 8 senior engineers update LinkedIn. Then you edit the policy and watch the same workforce stay engaged.
>
> [v2 demo]
>
> Privacy-safe — cohort-level. Decision support, not automated HR. And it works on any policy. [Paste judge's input live.]
>
> A $50M reorg or RTO mistake — turned into a 5-minute simulation.

## 16. Acceptance Criteria

MVP ships when:

- [ ] Anyone can paste any policy and get a complete simulation in <90s
- [ ] Output always well-formed (themes, numbers, quotes, action feed populated)
- [ ] Org graph animates action edges over 30 simulated days, ~3-5s playback
- [ ] Action feed scrolls in sync with animation, readable
- [ ] Action quotes feel like real human voice, not LLM boilerplate
- [ ] Compare view renders v1 vs v2 with action-volume + eNPS deltas
- [ ] Canonical RTO v1 → v2 hits target deltas (-13 eNPS → -3 eNPS)
- [ ] Demo runs cleanly 3 times in a row
- [ ] Backup demo exists
- [ ] Both apps deployed
- [ ] Slides done, pitch rehearsed

## 17. The One Thing That Matters

If we cut everything else: **a judge pastes their own policy and watches a workforce of agents act, not just colors change.** That's what beats every other AI HR demo. That's the MiroFish lesson — agents *do things*, sentiment is downstream.
