"""Policy Parser: raw policy text -> structured policy features.

Single LLM call. Output schema matches PRD §6.1.
Used by every downstream module so policy variation collapses to structure.
"""
from __future__ import annotations

from typing import Any

from .llm import call_json

VALID_SCENARIO_TYPES = {
    "policy_change",
    "compensation",
    "reorg",
    "layoff",
    "benefits",
    "other",
}

VALID_DIMENSIONS = {
    "commute",
    "flexibility",
    "compensation",
    "career_growth",
    "fairness",
    "autonomy",
    "caregiving",
    "trust",
    "workload",
    "culture",
}

SYSTEM = """You are an HR policy analyst. Read a draft workplace policy and extract its key features as structured JSON.

Be honest about tone and severity. If the policy is firm, say firm. If exceptions are vague, mark exception_authority as "manager" or "none". The downstream simulation depends on accurate signal extraction — do not soften your read.

Respond ONLY with a JSON object. No prose, no code fences."""

USER_TEMPLATE = """Analyze this policy and return a JSON object with EXACTLY these fields:

{{
  "scenario_type": one of {scenario_types},
  "category": short snake_case label like "return_to_office", "comp_freeze", "bonus_change", "layoff_round", "parental_leave_expansion",
  "summary": one sentence describing what's changing,
  "affected_groups": array of strings like ["all", "engineering", "sf_office", "managers", "remote_workers"],
  "effective_date_relative": one of "immediate", "weeks", "months", "unspecified",
  "tone": one of "firm", "conciliatory", "neutral", "vague",
  "has_business_rationale": boolean — does the policy explain WHY?,
  "has_exceptions": boolean,
  "exception_authority": one of "manager", "hr", "guaranteed", "none",
  "dimensions_affected": array, subset of {dimensions}. Pick what genuinely matters.,
  "severity": float 0.0 to 1.0 — how disruptive is this for affected employees? 0.2 = minor, 0.5 = significant, 0.8 = major shock.
}}

POLICY:
\"\"\"
{policy_text}
\"\"\"
"""


async def parse_policy(policy_text: str) -> dict[str, Any]:
    """Parse a policy. Returns validated dict matching schema."""
    user = USER_TEMPLATE.format(
        scenario_types=sorted(VALID_SCENARIO_TYPES),
        dimensions=sorted(VALID_DIMENSIONS),
        policy_text=policy_text.strip(),
    )
    raw = await call_json(SYSTEM, user, max_tokens=600, temperature=0.3)
    return _validate(raw)


def _validate(raw: dict[str, Any]) -> dict[str, Any]:
    """Coerce + validate. Fills sensible defaults on missing fields rather than crashing."""
    out: dict[str, Any] = {}
    out["scenario_type"] = (
        raw.get("scenario_type") if raw.get("scenario_type") in VALID_SCENARIO_TYPES else "other"
    )
    out["category"] = str(raw.get("category", "unspecified"))[:60]
    out["summary"] = str(raw.get("summary", ""))[:300]
    out["affected_groups"] = [str(x) for x in raw.get("affected_groups", ["all"])][:8]
    out["effective_date_relative"] = (
        raw.get("effective_date_relative")
        if raw.get("effective_date_relative") in {"immediate", "weeks", "months", "unspecified"}
        else "unspecified"
    )
    out["tone"] = (
        raw.get("tone") if raw.get("tone") in {"firm", "conciliatory", "neutral", "vague"} else "neutral"
    )
    out["has_business_rationale"] = bool(raw.get("has_business_rationale", False))
    out["has_exceptions"] = bool(raw.get("has_exceptions", False))
    out["exception_authority"] = (
        raw.get("exception_authority")
        if raw.get("exception_authority") in {"manager", "hr", "guaranteed", "none"}
        else "none"
    )
    dims = [d for d in raw.get("dimensions_affected", []) if d in VALID_DIMENSIONS]
    out["dimensions_affected"] = dims or ["culture"]
    sev = raw.get("severity", 0.5)
    try:
        out["severity"] = max(0.0, min(1.0, float(sev)))
    except (TypeError, ValueError):
        out["severity"] = 0.5
    return out
