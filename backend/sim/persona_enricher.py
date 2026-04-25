"""Persona Enricher: 50 agents + parsed_policy -> scenario-specific context per agent.

ONE batched LLM call (not 50). Adds:
  - scenario_specific_context: 1-2 sentences anchoring the persona to THIS policy
  - predisposition: negative | neutral | positive
  - predisposition_strength: 0-1

The action selector reads this context to make reactions feel grounded in
specific personal circumstances ("90-min commute from Oakland with two kids")
rather than generic role-based reactions.

The activity scheduler reads predisposition_strength to weight day-0 activation —
strongly-predisposed agents act first, others react over time.
"""
from __future__ import annotations

import json
from typing import Any

from .llm import call_json

VALID_PRED = {"negative", "neutral", "positive"}

SYSTEM = """You are an HR analyst building scenario-specific context for a workforce simulation.

Given a workplace policy and a roster of employees, write 1-2 sentences PER EMPLOYEE describing the *specific personal circumstances* that determine how this policy lands for them. Use their motivators, sensitivities, role, location, tenure, and caregiver status to invent plausible specific details — like "90-minute commute from Oakland" or "recently turned down a counter-offer at a competitor" or "just promoted to senior, still proving herself."

Be specific and varied. Different employees should have different anchoring details. Reference real geography, plausible life circumstances, recent career moves. Do NOT just restate their motivators — INVENT specific facts that would make this policy hit them differently than someone else.

Then judge their predisposition toward THIS specific policy:
- negative: opposed, will likely push back
- neutral: indifferent or balanced
- positive: supportive, may advocate

And predisposition_strength: how strong is that lean? 0.1 = mild, 0.9 = intense.

Respond ONLY with valid JSON. No prose, no code fences."""

USER_TEMPLATE = """POLICY:
- Type: {scenario_type} / {category}
- Summary: {summary}
- Tone: {tone}
- Severity: {severity}
- Affected dimensions: {dimensions_affected}
- Has exceptions: {has_exceptions} ({exception_authority})

EMPLOYEES (id | role | dept | location | tenure | trust | caregiver | sensitivities):
{roster}

For EACH employee_id above, output:
{{
  "<employee_id>": {{
    "scenario_specific_context": "<1-2 sentences inventing specific personal circumstances that determine how this policy lands>",
    "predisposition": "negative" | "neutral" | "positive",
    "predisposition_strength": <0.0 to 1.0>
  }},
  ...
}}

Cover ALL {n} employees. Respond with the JSON object only."""


def _format_roster(agents: list[dict[str, Any]]) -> str:
    lines = []
    for a in agents:
        sens = ",".join(a.get("sensitivities", [])[:3])
        cg = "Y" if a.get("is_caregiver") else "N"
        trust = a.get("trust_in_leadership", 0.5)
        lines.append(
            f"{a['id']} | {a['role']} | {a['department']} | {a['location']} | "
            f"{a.get('tenure_years', 0)}y | trust={trust:.2f} | caregiver={cg} | "
            f"sens=[{sens}]"
        )
    return "\n".join(lines)


BATCH_SIZE = 17  # 50 agents -> 3 batches of ~17, run in parallel


async def _enrich_batch(
    agents_batch: list[dict[str, Any]], parsed_policy: dict[str, Any]
) -> dict[str, Any]:
    user = USER_TEMPLATE.format(
        scenario_type=parsed_policy.get("scenario_type", ""),
        category=parsed_policy.get("category", ""),
        summary=parsed_policy.get("summary", ""),
        tone=parsed_policy.get("tone", ""),
        severity=parsed_policy.get("severity", 0.5),
        dimensions_affected=", ".join(parsed_policy.get("dimensions_affected", [])),
        has_exceptions=parsed_policy.get("has_exceptions", False),
        exception_authority=parsed_policy.get("exception_authority", "none"),
        roster=_format_roster(agents_batch),
        n=len(agents_batch),
    )
    return await call_json(SYSTEM, user, max_tokens=4000, temperature=0.8)


async def enrich_personas(
    agents: list[dict[str, Any]], parsed_policy: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    """Returns dict keyed by agent_id. Splits into parallel batches for latency.

    50 agents -> 3 concurrent calls of ~17 each -> ~30s instead of ~90s.
    """
    import asyncio

    batches = [agents[i : i + BATCH_SIZE] for i in range(0, len(agents), BATCH_SIZE)]

    async def _safe_batch(batch: list[dict[str, Any]]) -> dict[str, Any]:
        try:
            return await _enrich_batch(batch, parsed_policy)
        except Exception:
            return {}  # whole batch failed; fall through to heuristic per-agent below

    raw_per_batch = await asyncio.gather(*[_safe_batch(b) for b in batches])

    # merge all batch outputs
    merged: dict[str, Any] = {}
    for batch_out in raw_per_batch:
        merged.update(batch_out)

    out: dict[str, dict[str, Any]] = {}
    for a in agents:
        entry = merged.get(a["id"]) or {}
        out[a["id"]] = _validate_enrichment(entry, a, parsed_policy)
    return out


def _validate_enrichment(
    entry: dict[str, Any], agent: dict[str, Any], parsed_policy: dict[str, Any]
) -> dict[str, Any]:
    ctx = str(entry.get("scenario_specific_context", "")).strip()[:300]
    pred = entry.get("predisposition")
    if pred not in VALID_PRED:
        pred = "neutral"
    try:
        strength = max(0.0, min(1.0, float(entry.get("predisposition_strength", 0.4))))
    except (TypeError, ValueError):
        strength = 0.4

    if not ctx:
        # use heuristic for context but keep LLM's predisposition if present
        fallback = _heuristic_enrichment(agent, parsed_policy)
        ctx = fallback["scenario_specific_context"]

    return {
        "scenario_specific_context": ctx,
        "predisposition": pred,
        "predisposition_strength": strength,
    }


def _heuristic_enrichment(
    agent: dict[str, Any], parsed_policy: dict[str, Any]
) -> dict[str, Any]:
    """Fallback if LLM call fails or skips an agent."""
    dims = set(parsed_policy.get("dimensions_affected", []))
    sens = set(agent.get("sensitivities", []))
    overlap = dims & sens
    severity = parsed_policy.get("severity", 0.5)
    trust = agent.get("trust_in_leadership", 0.5)

    # predisposition: severity x sensitivity overlap x inverse trust
    score = severity * (1 - trust) * (0.4 + 0.4 * len(overlap))
    if score > 0.4:
        pred = "negative"
    elif score < 0.15 and trust > 0.65:
        pred = "positive"
    else:
        pred = "neutral"

    primary = next(iter(overlap), "this policy")
    ctx = (
        f"As a {agent.get('role', 'team member')} in {agent.get('location', 'the office')} "
        f"with {agent.get('tenure_years', 0)}-year tenure, the {primary} dimension is "
        f"personally salient."
    )
    return {
        "scenario_specific_context": ctx,
        "predisposition": pred,
        "predisposition_strength": min(1.0, score),
    }
