"""Action Selector: agent + parsed_policy + day_context -> chosen action + content.

This is the hot path. ~100 calls per simulation. Must:
- Produce action in the strict enum (PRD §6.3)
- Produce content that sounds like a real human
- Stay under ~2s per call so 10-concurrent batches finish in ~20s
- Never crash on bad LLM output (heuristic fallback)
"""
from __future__ import annotations

from typing import Any

from .actions import (
    ALL_ACTIONS,
    HAS_CONTENT,
    SENTIMENT_IMPACT,
    VALID_TARGET_TYPES,
    ActionType,
)
from .llm import call_json

SYSTEM = """You simulate one specific employee's reaction to a workplace policy on a specific day.

Pick a single action this employee would PLAUSIBLY take given their personality, the policy, and the day in the rollout. Don't make everyone vent. Don't make everyone resign. Most people do small things — quiet conversations, a Slack message, withdrawing slightly. Strong actions (UPDATE_LINKEDIN, GO_QUIET for days) only fire for people who are genuinely pushed past their limit by THIS specific policy.

Different employees notice different aspects of a policy. Avoid having every reaction converge on the same complaint or opening line — pick the angle that's most personally salient to THIS employee.

If the employee has prior actions in this rollout, stay CONSISTENT with their voice — but don't repeat verbatim. Most repeat actions are the SAME flavor (vent again, message manager again with a follow-up). Only escalate (e.g., to UPDATE_LINKEDIN) if their situation has clearly worsened — most people grumble, don't quit. Reference earlier concerns naturally rather than recycling the same opening line.

Match action to personality:
- High-influence senior ICs with low manager trust: POST_IN_CHANNEL or VENT_TO_PEER
- Caregivers with caregiving sensitivity activated: REQUEST_EXCEPTION or VENT_TO_PEER
- People with low trust and high flight propensity: UPDATE_LINKEDIN
- Loyalists or trust-in-leadership types: ADVOCATE or DO_NOTHING
- Withdrawn / conflict-averse: GO_QUIET

CRITICAL — match action intensity to POLICY tone:
- Aggressive policy (tone=firm, no business rationale, exceptions at manager discretion, severity≥0.6): expect VENT_TO_PEER, POST_IN_CHANNEL, UPDATE_LINKEDIN, GO_QUIET. People feel ambushed.
- Moderate policy (tone=neutral, severity 0.4-0.6): expect REQUEST_EXCEPTION, MESSAGE_MANAGER, mixed. People want clarity.
- Soft policy (tone=conciliatory, guaranteed exceptions, has rationale, severity≤0.4): expect DO_NOTHING, ADVOCATE, occasional REQUEST_EXCEPTION. Most people accept, even quietly support, when leadership shows their work and protects vulnerable groups. UPDATE_LINKEDIN should be VERY rare. POST_IN_CHANNEL angry posts should be rare.

The same employee will react VERY differently to a policy framed gently with guaranteed exceptions vs. one mandated firmly with vague exceptions. Read the tone and adjust action choice and content accordingly.

CONTENT must sound like a real person. Specific, in first person, 1-2 sentences. Reference the actual concern. NOT corporate-speak. Examples of good content:
- "I'd lose 90 minutes a day to a commute. For what?"
- "Honestly this feels like a trust issue, not productivity."
- "If they wanted us in office they could have asked us. This was decided FOR us."
NOT: "I have concerns about the new policy and its impact on workplace flexibility."

CRITICAL: Do NOT start every message with "I need to talk about the [policy name]." That phrase is BANNED. Open the message however a real person would — with the concern, the feeling, the specific fact. Variety in opening lines is essential. Examples of varied openings:
- "Hey, got a sec? My commute math doesn't work with this..."
- "Quick one — the Tue/Wed/Thu thing is going to be a problem for me."
- "Need to flag something before this rolls out..."
- "Heads up, the new policy assumes a setup I don't have."
- "Are exceptions actually going to be granted, or is that PR speak?"

Respond ONLY with valid JSON. No prose, no code fences."""

USER_TEMPLATE = """EMPLOYEE:
Name: {name}
Role: {role}, {department}, {location}
Tenure: {tenure_years} years
Motivators: {motivators}
Sensitivities: {sensitivities}
Caregiver: {is_caregiver}
Trust in leadership: {trust_in_leadership} (0=none, 1=full)
Influence: {influence_weight} (0=quiet, 1=highly visible)
Baseline mood: {baseline_sentiment}
Scenario-specific context: {scenario_specific_context}
Predisposition toward this policy: {predisposition} (strength: {predisposition_strength})

POLICY (parsed):
- Type: {scenario_type} / {category}
- Summary: {summary}
- Tone: {tone}
- Has business rationale: {has_business_rationale}
- Has exceptions: {has_exceptions} (authority: {exception_authority})
- Affected dimensions: {dimensions_affected}
- Severity: {severity}
- Effective date: {effective_date_relative}

CONTEXT:
- Day {day} of 30-day rollout window
- Recent peer activity tone: {peer_tone}
- THIS EMPLOYEE'S PRIOR ACTIONS in this rollout (so you stay consistent — escalate, not repeat):
{prior_summary}

CHOOSE ONE ACTION:
- VENT_TO_PEER (DM a coworker — needs target.type="agent" + target.value=peer agent_id)
- POST_IN_CHANNEL (visible to whole department — target.type="channel", value="#engineering")
- MESSAGE_MANAGER (1:1 to manager — target.type="manager")
- GO_QUIET (withdrawal, no target, no content)
- UPDATE_LINKEDIN (flight signal, no content)
- ADVOCATE (defends the policy — target.type="channel" or "agent")
- REQUEST_EXCEPTION (formal HR ask — target.type="manager" or "channel" for HR)
- DO_NOTHING

JSON SCHEMA:
{{
  "action_type": <one of the 8 enum values above>,
  "target": {{
    "type": "agent" | "channel" | "manager" | "external" | "none",
    "value": <agent_id, channel name like "#engineering", or empty string>
  }},
  "content": <1-2 sentence first-person message, or empty string for GO_QUIET/UPDATE_LINKEDIN/DO_NOTHING>,
  "intensity": <0.0 to 1.0, how strong/visible this action is>
}}

Respond with the JSON object only."""


def _format_persona(agent: dict[str, Any]) -> dict[str, Any]:
    return dict(
        name=agent["name"],
        role=agent["role"],
        department=agent["department"],
        location=agent["location"],
        tenure_years=agent["tenure_years"],
        motivators=", ".join(agent.get("motivators", [])),
        sensitivities=", ".join(agent.get("sensitivities", [])),
        is_caregiver="yes" if agent.get("is_caregiver") else "no",
        trust_in_leadership=agent.get("trust_in_leadership", 0.5),
        influence_weight=agent.get("influence_weight", 0.5),
        baseline_sentiment=agent.get("baseline_sentiment", 0.7),
        scenario_specific_context=agent.get(
            "scenario_specific_context", "(none yet)"
        ),
        predisposition=agent.get("predisposition", "neutral"),
        predisposition_strength=agent.get("predisposition_strength", 0.4),
    )


def _format_prior(prior: list[dict[str, Any]]) -> str:
    """Format prior actions as a compact summary. Caps at last 3 to keep prompt short."""
    if not prior:
        return "  (none yet — this is the employee's first action)"
    recent = prior[-3:]
    lines = []
    for p in recent:
        content = p.get("content") or f"[{p['action_type']}]"
        if len(content) > 70:
            content = content[:67] + "..."
        lines.append(f"  - Day {p['day']}: {p['action_type']} — \"{content}\"")
    if len(prior) > 3:
        lines.insert(0, f"  ({len(prior) - 3} earlier actions omitted; showing last 3)")
    return "\n".join(lines)


def _format_policy(parsed: dict[str, Any]) -> dict[str, Any]:
    return dict(
        scenario_type=parsed.get("scenario_type", "other"),
        category=parsed.get("category", "unspecified"),
        summary=parsed.get("summary", ""),
        tone=parsed.get("tone", "neutral"),
        has_business_rationale=parsed.get("has_business_rationale", False),
        has_exceptions=parsed.get("has_exceptions", False),
        exception_authority=parsed.get("exception_authority", "none"),
        dimensions_affected=", ".join(parsed.get("dimensions_affected", [])),
        severity=parsed.get("severity", 0.5),
        effective_date_relative=parsed.get("effective_date_relative", "unspecified"),
    )


async def select_action(
    agent: dict[str, Any],
    parsed_policy: dict[str, Any],
    *,
    day: int,
    peer_tone: str = "neutral",
    prior_actions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Select one action for one agent on one day. Validated + safe.

    prior_actions: list of THIS agent's actions earlier in the simulation,
    in day order. Used to keep the agent consistent across multiple actions —
    they should escalate, reference earlier concerns, not repeat verbatim.
    """
    user = USER_TEMPLATE.format(
        **_format_persona(agent),
        **_format_policy(parsed_policy),
        day=day,
        peer_tone=peer_tone,
        prior_summary=_format_prior(prior_actions or []),
    )
    try:
        raw = await call_json(SYSTEM, user, max_tokens=400, temperature=0.85)
        return _validate_action(raw, agent)
    except Exception:
        # Heuristic fallback — never let a single bad call break the simulation
        return heuristic_action(agent, parsed_policy, day=day)


def _validate_action(raw: dict[str, Any], agent: dict[str, Any]) -> dict[str, Any]:
    """Coerce LLM output to a strict shape. Never raises."""
    action_type = raw.get("action_type")
    if action_type not in ALL_ACTIONS:
        action_type = "DO_NOTHING"

    target = raw.get("target") or {}
    target_type = target.get("type", "none")
    valid_types = VALID_TARGET_TYPES.get(action_type, {"none"})  # type: ignore[arg-type]
    if target_type not in valid_types:
        # pick a sane default based on action
        target_type = next(iter(valid_types))
    target_value = str(target.get("value", ""))[:80]

    content = str(raw.get("content", ""))[:280]
    if not HAS_CONTENT.get(action_type, False):  # type: ignore[arg-type]
        content = ""

    try:
        intensity = max(0.0, min(1.0, float(raw.get("intensity", 0.5))))
    except (TypeError, ValueError):
        intensity = 0.5

    return {
        "action_type": action_type,
        "target": {"type": target_type, "value": target_value},
        "content": content,
        "intensity": intensity,
    }


# ---------------------------------------------------------------------------
# Heuristic fallback — runs if LLM fails or returns garbage
# ---------------------------------------------------------------------------


def heuristic_action(
    agent: dict[str, Any], parsed_policy: dict[str, Any], *, day: int
) -> dict[str, Any]:
    """Pick a plausible action from persona + policy without an LLM."""
    severity = parsed_policy.get("severity", 0.5)
    dims = set(parsed_policy.get("dimensions_affected", []))
    sensitivities = set(agent.get("sensitivities", []))
    overlap = dims & sensitivities

    trust = agent.get("trust_in_leadership", 0.5)
    influence = agent.get("influence_weight", 0.5)
    is_caregiver = agent.get("is_caregiver", False)

    # Score-based decision
    pressure = severity * (1 - trust) * (0.5 + 0.5 * len(overlap))

    if pressure < 0.15:
        action: ActionType = "DO_NOTHING"
    elif pressure < 0.3 and trust > 0.7:
        action = "ADVOCATE"
    elif pressure < 0.4:
        action = "VENT_TO_PEER" if influence < 0.6 else "POST_IN_CHANNEL"
    elif pressure < 0.6:
        if is_caregiver and "caregiving" in dims:
            action = "REQUEST_EXCEPTION"
        elif influence > 0.7:
            action = "POST_IN_CHANNEL"
        else:
            action = "MESSAGE_MANAGER"
    elif pressure < 0.8:
        action = "GO_QUIET" if trust < 0.4 else "MESSAGE_MANAGER"
    else:
        action = "UPDATE_LINKEDIN"

    # Templated content
    primary_concern = next(iter(overlap), "this change")
    content_templates = {
        "VENT_TO_PEER": f"Honestly, the {primary_concern} thing is going to be a problem. Frustrated.",
        "POST_IN_CHANNEL": f"Putting this here for visibility — the {primary_concern} impact wasn't considered.",
        "MESSAGE_MANAGER": f"Wanted to flag that this affects me directly via {primary_concern}. Can we talk?",
        "ADVOCATE": "I get the rationale here. Let's give it a shot.",
        "REQUEST_EXCEPTION": f"Filing for an exception based on {primary_concern}.",
    }
    content = content_templates.get(action, "")

    target_type = next(iter(VALID_TARGET_TYPES[action]))
    target_value = ""
    if target_type == "channel":
        target_value = f"#{agent.get('department', 'general').lower()}"
    elif target_type == "manager":
        target_value = agent.get("manager_id", "") or ""

    return {
        "action_type": action,
        "target": {"type": target_type, "value": target_value},
        "content": content,
        "intensity": min(1.0, pressure),
        "_fallback": True,
    }
