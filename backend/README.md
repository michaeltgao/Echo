# Lattice Predict — Backend (P1)

Python FastAPI backend. Owns the simulation core: policy parsing, agent action selection, sentiment aggregation, theme clustering, recommendation generation.

## Setup

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env, set ANTHROPIC_API_KEY
```

## Hour 4 Go/No-Go Gate

**This is the first thing to run.** It validates that the action selector works across 3 policy types × 5 personas before building anything else.

```bash
source .venv/bin/activate
python -m tests.gate_hour4
```

Pass criteria (eyeball it):
- Every persona produced a sensible action (not all-VENT, not all-DO_NOTHING)
- Content sounds like a real person in that role, in their voice
- All 3 policy types worked (RTO, comp freeze, layoff)
- No more than 1-2 fallbacks across the 15 calls

If gate fails: tune the prompts in `sim/policy_parser.py` and `sim/action_selector.py` BEFORE building anything else.

## Layout

```
backend/
├── sim/
│   ├── llm.py             # Anthropic client + JSON helper + concurrency cap
│   ├── policy_parser.py   # Stage 1: text -> structured policy features
│   ├── actions.py         # Action enum + sentiment impact mapping
│   ├── action_selector.py # Stage 3: agent + policy + day -> action + content
│   ├── persona_enricher.py     # TODO Stage 2
│   ├── activity_scheduler.py   # TODO Stage 3 (which agents act on which day)
│   ├── sentiment_aggregator.py # TODO Stage 4 (deterministic math)
│   └── simulator.py       # TODO Top-level orchestrator
├── tests/
│   └── gate_hour4.py      # Hour 4 sanity check
├── main.py                # TODO FastAPI app
├── requirements.txt
└── .env.example
```

## Build Order (P1's plan)

1. ✅ Scaffolding + LLM client
2. ✅ Policy parser
3. ✅ Action selector + heuristic fallback
4. ✅ Hour 4 gate test
5. ⏳ Persona enricher (single batched call across 50 agents)
6. ⏳ Activity scheduler (deterministic — who acts on which day)
7. ⏳ Sentiment aggregator (deterministic action -> sentiment math)
8. ⏳ Top-level `simulate()` orchestrator
9. ⏳ FastAPI `POST /simulate` endpoint
10. ⏳ Pre-cache layer (hash policy text -> cached result)
```
