# Briefing for P4 — Theme Clusterer + Recommendation Generator

**TL;DR.** Build two Python modules in `backend/sim/`: one that reads ~100 employee messages and clusters them into 3 themes, and one that reads themes + parsed policy and produces a rewritten v2 policy. Both use Claude Opus for quality. P1 will plug them into `simulator.py`.

---

## Where the Data Lives

Open `backend/tests/last_result.json` — that's a real cached simulation result. Read the `actions` array. ~120 entries. Each entry's `content` field is what your clusterer consumes.

Sample entries:

```json
{
  "id": "act_d00_00",
  "agent_id": "emp_031",
  "action_type": "MESSAGE_MANAGER",
  "content": "I was hired explicitly as remote from Portland because I'm caring for my mom with early dementia. This policy puts me in an impossible position — I can't relocate, and I can't leave her.",
  "intensity": 0.85
}
```

```json
{
  "id": "act_d05_03",
  "agent_id": "emp_023",
  "action_type": "REQUEST_EXCEPTION",
  "content": "Following up on our conversation — I need a formal exception for the Tuesday requirement. With my husband in Philly...",
  "intensity": 0.75
}
```

Read 20-30 of these to understand the texture before drafting your prompt.

---

## Narrative Arcs to Pay Attention To

These are emergent multi-day stories from a single agent. Your clusterer should treat them as part of the texture, not separate themes:

**Greg Stevens (emp_023):** message_manager → request_exception → vent_to_peer → go_quiet → update_linkedin. Theme: **stalled exception requests + manager non-responsiveness**.

**emp_009 (Olivia):** Hired remote 5 years ago in Boulder for kids' specialized therapy access. Multiple message_manager + post_in_channel actions. Theme: **remote-hire promise broken**.

**emp_031 (Isabel):** Marketing Director, Portland, dementia caregiver. Multiple escalations. Theme: **caregiving burden + leadership credibility**.

**emp_002 (Marcus):** Sacramento, 90-min Caltrain commute, Stripe counter-offer. Theme: **commute math + market alternatives**.

When you cluster, look for these archetypal stories. The themes that fall out should be ~3 punchy labels that each capture a different recurring pattern.

---

## Module 1: `backend/sim/theme_clusterer.py`

### Interface
```python
from typing import Any

async def cluster_themes(
    actions: list[dict[str, Any]],
    parsed_policy: dict[str, Any],
) -> list[dict[str, Any]]:
    """Cluster ~100 actions into 3 themes with representative quotes."""
```

### Output Schema
Match this exactly (from `contracts/simulation_result.schema.json` → `themes`):

```python
[
    {
        "label": "Caregiving burden",  # short, punchy, 2-4 words
        "description": "Caregivers face direct conflicts with school pickup, eldercare, and medical appointments.",  # 1 sentence
        "volume": 18,  # number of actions matching this theme
        "volume_pct": 36,
        "quotes": [
            {
                "text": "<verbatim from action.content>",
                "agent_id": "emp_001",
                "action_id": "act_d00_03",  # back-ref to the action
                "department": "Engineering",
                "role": "Senior IC Engineer"
            },
            # ... 2-3 quotes per theme
        ],
        "departments_affected": ["Engineering", "Product", "Marketing"]
    },
    # ... up to 3 themes total
]
```

### Prompt Strategy

System prompt: *"You are an HR analyst reading employee messages about a workplace policy. Your job is to identify the 2-3 distinct concern themes that emerge from these messages. Themes should be specific enough to be actionable (not 'people are upset') but broad enough to cluster multiple messages."*

User prompt structure:
```
POLICY: <parsed_policy.summary>

EMPLOYEE MESSAGES (action_id | dept | role | content):
act_d00_00 | Marketing | Director | "I was hired explicitly as remote from Portland..."
act_d00_03 | Product | Senior PM | "Hey, can we talk through the Tuesday-Thursday requirement?..."
... (all actions with content, sorted by day)

Identify the 3 dominant themes. For each:
- A 2-4 word label
- A 1-sentence description
- 2-3 representative quotes pulled VERBATIM from the messages above (with their action_id)
- Volume: how many messages map to this theme

Respond with JSON only, matching this shape: { ... }
```

### Critical Rules

1. **Quotes must be verbatim.** Don't paraphrase. The action_id must reference a real action you saw.
2. **Use Opus** (`MODEL_QUALITY` from `llm.py`). Quality matters here — judges will read these themes carefully.
3. **Strict JSON output.** Wrap in `call_json` with retries.
4. **Heuristic fallback** if LLM fails: cluster by `action_type`, return generic labels like "Caregiving concerns" / "Trust issues" / "Flight risk signals".
5. **Skip actions where content is empty** (UPDATE_LINKEDIN, GO_QUIET, DO_NOTHING — those have no message text).

### Test it locally
```bash
cd backend
python -m tests.last_result_to_themes  # you'll write this
```

Quick test scaffold:
```python
import asyncio, json
from sim.theme_clusterer import cluster_themes

with open("tests/last_result.json") as f:
    r = json.load(f)

themes = asyncio.run(cluster_themes(r["actions"], r["parsed_policy"]))
for t in themes:
    print(f"{t['label']}: {t['volume']} actions")
    for q in t['quotes']:
        print(f"  - {q['text'][:80]}...")
```

---

## Module 2: `backend/sim/recommendation.py`

### Interface
```python
async def generate_recommendation(
    parsed_policy: dict[str, Any],
    themes: list[dict[str, Any]],
) -> dict[str, Any]:
    """Generate a rewritten policy that addresses the top themes."""
```

### Output Schema
```python
{
    "title": "Add explicit flexibility exception process",  # short, action-oriented
    "rationale": "Caregivers drove 41% of negative reactions — guaranteeing exceptions through HR (not manager discretion) addresses the top concern.",  # 1-2 sentences
    "suggested_rewrite": "<the actual rewritten policy text — multiple paragraphs, ready to paste back into the scenario builder>",
    "projected_impact": {
        "negative_action_reduction_pct": 60,
        "linkedin_updates_avoided": 7,
        "engagement_lift": 0.05,
        "confidence": "medium"
    }
}
```

### Prompt Strategy

System prompt: *"You are an HR policy advisor. You will receive an original policy that received negative employee reactions, and the top concerns those reactions raised. Your job: rewrite the policy to address the top concerns while preserving the business intent. Output a complete, ready-to-publish policy — not bullet points, not 'consider adding'."*

User prompt:
```
ORIGINAL POLICY:
<full parsed_policy.summary + rebuild from raw if available>

TOP CONCERNS THAT EMERGED:
1. <theme 1 label>: <description> (cited by <volume> employees)
2. <theme 2 label>: ...
3. <theme 3 label>: ...

Rewrite the policy to:
- Preserve the original business intent
- Directly address each of the top 3 concerns
- Use clear, conciliatory tone (NOT defensive, NOT vague)
- Specify guaranteed exception paths (not "manager discretion")
- Include explicit business rationale
- Add a phased/grace timeline if applicable

Return JSON: { "title": "...", "rationale": "...", "suggested_rewrite": "<full policy text>", "projected_impact": {...} }
```

### Critical Rules

1. **`suggested_rewrite` is the actual policy text users will paste back in.** It needs to read like real HR comms.
2. Use Opus.
3. Heuristic fallback: hardcoded rewrite snippets per `parsed_policy.category`.
4. **Don't make `projected_impact` numbers up randomly.** Estimate from theme volume — e.g., if "caregiving burden" had volume 18, the rewrite addressing it could reasonably reduce 60-80% of those reactions.

---

## Integration (P1 will do this)

When your modules are ready, P1 swaps:

```python
# In backend/sim/simulator.py:
from .theme_clusterer import cluster_themes
from .recommendation import generate_recommendation

# Replace _placeholder_themes(...) with:
themes = await cluster_themes(actions, parsed)

# Replace _placeholder_recommendation(...) with:
recommendation = await generate_recommendation(parsed, themes)
```

That's it. Make sure your output shapes match the schema *exactly* and integration is a 4-line change.

---

## Beyond the Modules — Your Other Tasks

Per the workplan, you also own:
- **Slide deck** (5 slides: problem, demo handoff, governance, architecture, ask)
- **Pitch script** (memorize 90s version)
- **Backup demo video** (full screen capture of working flow — insurance vs. wifi failure)
- **Demo rehearsal** with team (5+ runs)
- **Final pitch delivery**

Start theme clusterer first since P1 + integration block on it. Slides + rehearsal can happen later.

---

## When Things Break

LLM giving you bad clusters → tighten the prompt with concrete examples ("good label: 'Caregiving burden' / bad label: 'People are upset'").

Output validation failing → check `call_json` is returning the shape you expect, log raw LLM output, iterate prompt.

Anything else → ping P1.
