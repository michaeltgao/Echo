"""Recommendation Generator: parsed policy + themes -> rewrite.

P4 module. Uses Opus for the quality-critical recommendation judges read, with
deterministic category fallbacks so simulations stay well-formed if the LLM is
unavailable.
"""
from __future__ import annotations

import json
from typing import Any

from .llm import MODEL_QUALITY, call_json

SYSTEM = """You are an expert People Ops policy advisor.

Given a parsed workplace policy and the strongest employee concern themes,
write one concrete recommendation that reduces risk while preserving the
business goal. The rewrite should sound like real HR policy text, not a generic
AI suggestion.

Respond ONLY with valid JSON. No prose, no code fences."""

USER_TEMPLATE = """PARSED POLICY:
{parsed_policy}

THEMES FROM EMPLOYEE ACTIONS:
{themes}

Return JSON with this exact shape:
{{
  "title": "short recommendation title",
  "rationale": "2-3 sentences explaining why this addresses the top concerns",
  "suggested_rewrite": "actual rewritten policy text HR could paste into the editor",
  "projected_impact": {{
    "negative_action_reduction_pct": <number 0-100>,
    "linkedin_updates_avoided": <integer>,
    "engagement_lift": <number, e.g. 0.04>,
    "confidence": "high" | "medium" | "low"
  }}
}}

Make the rewrite specific: dates, exception path, manager/HR owner, and what is
optional vs required where relevant.
"""


async def generate_recommendation(
    parsed_policy: dict[str, Any],
    themes: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return schema-compliant recommendation."""
    try:
        raw = await call_json(
            SYSTEM,
            USER_TEMPLATE.format(
                parsed_policy=json.dumps(parsed_policy, indent=2),
                themes=json.dumps(_compact_themes(themes), indent=2),
            ),
            max_tokens=1800,
            temperature=0.35,
            retries=1,
            model=MODEL_QUALITY,
        )
        return _validate_recommendation(raw, parsed_policy, themes)
    except Exception:
        return _fallback_recommendation(parsed_policy, themes)


def _compact_themes(themes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    compact = []
    for theme in themes[:5]:
        compact.append({
            "label": theme.get("label", ""),
            "description": theme.get("description", ""),
            "volume": theme.get("volume", 0),
            "quotes": [
                {
                    "text": q.get("text", ""),
                    "action_id": q.get("action_id", ""),
                    "department": q.get("department", ""),
                    "role": q.get("role", ""),
                }
                for q in theme.get("quotes", [])[:3]
            ],
        })
    return compact


def _validate_recommendation(
    raw: dict[str, Any],
    parsed_policy: dict[str, Any],
    themes: list[dict[str, Any]],
) -> dict[str, Any]:
    fallback = _fallback_recommendation(parsed_policy, themes)

    title = str(raw.get("title", "")).strip()[:90] or fallback["title"]
    rationale = str(raw.get("rationale", "")).strip()[:700] or fallback["rationale"]
    rewrite = str(raw.get("suggested_rewrite", "")).strip()
    if len(rewrite) < 80:
        rewrite = fallback["suggested_rewrite"]
    rewrite = rewrite[:2500]

    impact_raw = raw.get("projected_impact", {})
    if not isinstance(impact_raw, dict):
        impact_raw = {}

    impact = fallback["projected_impact"]
    impact["negative_action_reduction_pct"] = _coerce_number(
        impact_raw.get("negative_action_reduction_pct"),
        impact["negative_action_reduction_pct"],
        0,
        100,
    )
    impact["linkedin_updates_avoided"] = int(_coerce_number(
        impact_raw.get("linkedin_updates_avoided"),
        impact["linkedin_updates_avoided"],
        0,
        50,
    ))
    impact["engagement_lift"] = round(_coerce_number(
        impact_raw.get("engagement_lift"),
        impact["engagement_lift"],
        0,
        0.25,
    ), 3)
    confidence = impact_raw.get("confidence")
    impact["confidence"] = confidence if confidence in {"high", "medium", "low"} else impact["confidence"]

    return {
        "title": title,
        "rationale": rationale,
        "suggested_rewrite": rewrite,
        "projected_impact": impact,
    }


def _fallback_recommendation(
    parsed_policy: dict[str, Any],
    themes: list[dict[str, Any]],
) -> dict[str, Any]:
    category = str(parsed_policy.get("category", "other"))
    scenario_type = str(parsed_policy.get("scenario_type", "other"))
    top_theme = themes[0]["label"] if themes else "policy clarity"

    if category == "return_to_office":
        title = "Move to a phased hybrid rollout with guaranteed exceptions"
        rewrite = """Starting September 1, we will move to a hybrid collaboration model for office-assigned employees. Teams will use two shared anchor days per week for planning, mentorship, and customer-facing collaboration; any third in-office day is optional and set by each team based on the work.

Caregiving, medical, disability, commute-hardship, and previously remote role exceptions are guaranteed through People Ops, not manager discretion. June through August will be a ramp period with no attendance tracking while teams test schedules and share feedback. We will publish the business rationale, review pulse results after 30 and 90 days, and adjust the policy before making it permanent."""
        lift = 0.06
        avoided = 6
    elif category in {"comp_freeze", "bonus_change"} or scenario_type == "compensation":
        title = "Pair the compensation change with transparency and targeted retention protection"
        rewrite = """For the upcoming compensation cycle, we will hold broad increases flat only where necessary while protecting promotion adjustments, critical retention cases, and employees below market band. Leaders will publish the business reason for the change, the expected duration, and the criteria for exceptions.

Managers will receive a written FAQ and a review path through People Ops for employees whose compensation, equity, or bonus outcome creates retention risk. We will revisit the decision within one quarter and share what would need to change for normal compensation planning to resume."""
        lift = 0.05
        avoided = 4
    elif category in {"layoff_round", "layoff"} or scenario_type == "layoff":
        title = "Lead with scope, support, and survivor clarity"
        rewrite = """We are reducing roles only after reviewing alternatives, and affected employees will receive severance, healthcare continuation, recruiting support, and clear timing before any public announcement. Managers will have team-specific talking points that explain what is changing, what is not changing, and how workloads will be reset.

For remaining employees, leaders will publish the new operating plan, pause nonessential work for one week, and hold listening sessions by function so teams can raise workload, trust, and role-clarity concerns directly."""
        lift = 0.04
        avoided = 8
    elif scenario_type == "benefits":
        title = "Add eligibility clarity and a transition window"
        rewrite = """We will introduce the benefits change with a 60-day transition period, plain-language eligibility rules, and a dedicated People Ops review path for edge cases. No employee will lose access without direct notice, a comparison of current versus new coverage, and a chance to ask questions confidentially.

We will publish the reason for the change, the employee groups affected, and the support available before the policy takes effect."""
        lift = 0.04
        avoided = 3
    else:
        title = "Clarify rationale, ownership, and exception paths before rollout"
        rewrite = """Before this policy takes effect, we will publish the business rationale, who is affected, what is required versus optional, and the exact process for exceptions or accommodations. Managers will receive consistent guidance, and People Ops will own sensitive exception decisions so employees do not have to negotiate personal circumstances with their direct manager.

We will treat the first 30 days as a feedback window, review cohort-level pulse results, and adjust the policy where the impact is higher than intended."""
        lift = 0.035
        avoided = 3

    severity = float(parsed_policy.get("severity", 0.5) or 0.5)
    negative_reduction = round(min(70, max(25, 35 + severity * 35)))
    if any("Attrition" in str(t.get("label", "")) for t in themes):
        avoided += 2

    return {
        "title": title,
        "rationale": (
            f"The strongest theme is {top_theme}. This recommendation reduces ambiguity, "
            "moves sensitive exceptions out of ad hoc manager discretion, and gives employees "
            "a visible feedback loop before the policy becomes permanent."
        ),
        "suggested_rewrite": rewrite,
        "projected_impact": {
            "negative_action_reduction_pct": negative_reduction,
            "linkedin_updates_avoided": avoided,
            "engagement_lift": lift,
            "confidence": "medium" if themes else "low",
        },
    }


def _coerce_number(value: Any, default: float, lo: float, hi: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = float(default)
    return max(lo, min(hi, number))
