# P4 Demo Brief

## Product Spine

Lattice Predict is a wind tunnel for HR decisions. Paste a policy, simulate how the Northwind workforce acts over 30 days, then use the action evidence to forecast pulse outcomes and rewrite the policy before rollout.

MiroFish inspiration: seed material creates a parallel world where agents interact and produce an emergent report.

Our product difference: the seed is an HR policy, the world is a Lattice-style workforce graph, the actions are workplace behaviors, and the report is a pulse forecast plus policy rewrite.

## Backend Contract For P2/P3

Schema: `contracts/simulation_result.schema.json`

Agent IDs: `emp_001` through `emp_050`

Action enum:

```text
VENT_TO_PEER
POST_IN_CHANNEL
MESSAGE_MANAGER
GO_QUIET
UPDATE_LINKEDIN
ADVOCATE
REQUEST_EXCEPTION
DO_NOTHING
```

Streaming endpoint: `POST /simulate/stream`

SSE events:

```text
stage
parsed
action
tick
result
error
```

The frontend should treat each `action` event as the live feed and graph animation trigger. The final `result` event has `actions`, `snapshots`, `cohort_metrics`, `themes`, and `recommendation`.

## Narrative Arcs From Cached RTO V1

Source: `backend/tests/last_result.json`

1. Priya Shah, `emp_001`: manager message on day 1, formal exception on day 5, channel post on day 11, LinkedIn update on day 17, then goes quiet on day 25.

2. Greg Stevens, `emp_023`: manager message on day 1, formal exception on day 6, then venting on day 11 after radio silence. Good for showing that the simulator captures slow escalation, not only instant outrage.

3. Olivia Brooks, `emp_009`: Boulder care-plan backstory on day 1, exception request on day 5, repeated channel posts later. This is the strongest human quote to reference live.

4. Isabel Garcia, `emp_031`: remote caregiver for her mother, repeated escalation, then LinkedIn signal. Use this for caregiver and remote-hire risk.

5. Gabriel Santos, `emp_047`: updates LinkedIn on day 2, later says he is lining up interviews. Use this when the graph shows visible flight risk.

6. Sarah Kim, `emp_004`: engineering manager warns the VP that the mandate may accelerate senior-engineer departures. Use this to show manager-level friction.

## P4 Modules Landed

Theme clusterer:

```text
backend/sim/theme_clusterer.py
async def cluster_themes(actions: list[dict]) -> list[dict]
```

Recommendation generator:

```text
backend/sim/recommendation.py
async def generate_recommendation(parsed_policy: dict, themes: list[dict]) -> dict
```

Simulator integration:

```text
backend/sim/simulator.py
backend/sim/simulator_stream.py
```

Cohort `top_concern` now uses real theme output when available.

## 90-Second Pitch

HR teams are reactive. They announce a policy on Tuesday and learn what broke through Slack rumors, pulse surveys, and resignations days or weeks later.

Lattice Predict is a wind tunnel for people decisions. Paste your draft policy and we simulate how 50 employee personas act over 30 days.

Not abstract sentiment. Real behavior. They message managers, vent to peers, post in channels, request exceptions, go quiet, advocate, and update LinkedIn.

In the RTO v1 demo, watch Priya escalate from a manager message to an exception request, then a public channel post, then LinkedIn. Watch Olivia's Boulder care-plan backstory turn into a formal exception request. The pulse score drops because the workforce acted.

Then we cluster the actual messages into themes, generate an HR-ready rewrite, run v2, and compare the action volume. Privacy-safe, cohort-level, decision support, not automation.

The close: a 50 million dollar reorg or RTO mistake turned into a 5-minute simulation.

## Backup Video Checklist

1. Start on Scenario Builder.
2. Paste canonical RTO v1.
3. Run cached SSE stream.
4. Show org graph action pulses and live feed.
5. Click into results: eNPS, heat map, themes, quotes.
6. Apply recommendation and run v2.
7. Open compare view and show LinkedIn updates dropping.
8. End on "Want to try yours?"

## Slide Deck

Editable deck: `presentation/output/output.pptx`

Rendered previews: `presentation/scratch/slide-01.png` through `presentation/scratch/slide-18.png`

Saved-PPTX render previews: `presentation/scratch/pptx-slide-01.png` through `presentation/scratch/pptx-slide-18.png`

Deck intentionally stops at slide 18.
