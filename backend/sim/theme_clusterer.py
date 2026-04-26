"""Theme Clusterer: action.content strings -> concern themes.

P4 module. Reads the messages employees actually produced and clusters them
into the schema's themes[] shape. The LLM can label and describe clusters, but
validation always snaps representative quotes back to real action.content
values so the frontend never shows invented quotes.
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from typing import Any

from .llm import MODEL_QUALITY, call_json


SYSTEM = """You are analyzing simulated employee reactions to a workplace policy.

Cluster employee messages into the 3 strongest concern themes. Use only the
messages provided. Do not invent quotes. Each representative quote must be a
real action.content string and include its action_id.

Prefer crisp HR-friendly labels like "Loss of flexibility", "Trust gap",
"Caregiving burden", "Compensation fairness", or "Attrition risk".

Respond ONLY with valid JSON. No prose, no code fences."""

USER_TEMPLATE = """Employee messages:
{messages}

Return JSON with this exact shape:
{{
  "themes": [
    {{
      "label": "short theme label",
      "description": "one sentence explaining the concern",
      "volume": <number of messages assigned to this theme>,
      "quote_action_ids": ["act_...", "act_...", "act_..."]
    }}
  ]
}}

Rules:
- Return 3 themes unless there are fewer than 3 meaningful clusters.
- quote_action_ids must refer to action IDs above.
- Use top 2-3 representative quote_action_ids per theme.
- Volume should be a count of messages, not a percentage.
"""


CONCERN_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    (
        "Caregiving burden",
        ("caregiving", "child", "kids", "school", "pickup", "parent", "elder", "medical", "accessibility"),
    ),
    (
        "Commute strain",
        ("commute", "train", "traffic", "bart", "subway", "drive", "minutes", "hour"),
    ),
    (
        "Loss of flexibility",
        ("flex", "remote", "hybrid", "schedule", "autonomy", "deep work", "choice", "mandate"),
    ),
    (
        "Trust gap",
        ("trust", "decided", "asked", "transparent", "rationale", "why", "manager discretion", "pr speak"),
    ),
    (
        "Compensation fairness",
        ("comp", "bonus", "salary", "raise", "merit", "pay", "401k", "freeze"),
    ),
    (
        "Career uncertainty",
        ("promotion", "career", "growth", "role", "manager", "reorg", "layoff", "security"),
    ),
    (
        "Attrition risk",
        ("linkedin", "recruiter", "leaving", "quit", "resign", "offer", "competitor"),
    ),
]

DEFAULT_LABEL = "Mixed concerns"


async def cluster_themes(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return schema-compliant themes[] from real action content."""
    content_actions = _content_actions(actions)
    if not content_actions:
        return _fallback_themes(actions)

    try:
        raw = await call_json(
            SYSTEM,
            USER_TEMPLATE.format(messages=_format_messages(content_actions)),
            max_tokens=1800,
            temperature=0.25,
            retries=1,
            model=MODEL_QUALITY,
        )
        return _validate_themes(raw.get("themes", raw), content_actions)
    except Exception:
        return _fallback_themes(content_actions)


def _content_actions(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for act in actions:
        content = str(act.get("content", "")).strip()
        if content:
            copied = dict(act)
            copied["content"] = content
            out.append(copied)
    return out


def _format_messages(actions: list[dict[str, Any]]) -> str:
    rows = []
    for act in actions[:160]:
        payload = {
            "action_id": act.get("id", ""),
            "agent_id": act.get("agent_id", ""),
            "day": act.get("day", 0),
            "action_type": act.get("action_type", ""),
            "department": act.get("department", ""),
            "role": act.get("role", ""),
            "content": act.get("content", ""),
        }
        rows.append(json.dumps(payload, ensure_ascii=False))
    return "\n".join(rows)


def _validate_themes(raw_themes: Any, actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(raw_themes, dict):
        raw_themes = list(raw_themes.values())
    if not isinstance(raw_themes, list):
        return _fallback_themes(actions)

    by_id = {str(a.get("id")): a for a in actions if a.get("id")}
    total = max(1, len(actions))
    validated = []
    used_quote_ids: set[str] = set()

    for raw in raw_themes[:5]:
        if not isinstance(raw, dict):
            continue
        label = _clean_label(str(raw.get("label", "") or DEFAULT_LABEL))
        description = str(raw.get("description", "")).strip()[:220]

        quote_ids = _extract_quote_ids(raw)
        quotes = []
        for action_id in quote_ids:
            if action_id in used_quote_ids:
                continue
            act = by_id.get(action_id)
            if not act:
                continue
            quotes.append(_quote_from_action(act))
            used_quote_ids.add(action_id)
            if len(quotes) >= 3:
                break

        if not quotes:
            quotes = _quotes_by_label(label, actions, used_quote_ids)

        if not quotes:
            continue

        try:
            volume = int(raw.get("volume", len(quotes)))
        except (TypeError, ValueError):
            volume = len(quotes)
        volume = max(len(quotes), min(total, volume))

        validated.append({
            "label": label,
            "description": description or _description_for(label),
            "volume": volume,
            "volume_pct": round(100 * volume / total),
            "quotes": quotes,
            "departments_affected": sorted({
                q.get("department", "") for q in quotes if q.get("department")
            }),
        })

    if not validated:
        return _fallback_themes(actions)

    validated.sort(key=lambda t: t["volume"], reverse=True)
    return validated[:5]


def _extract_quote_ids(raw: dict[str, Any]) -> list[str]:
    ids: list[str] = []
    for key in ("quote_action_ids", "action_ids"):
        value = raw.get(key)
        if isinstance(value, list):
            ids.extend(str(v) for v in value)

    raw_quotes = raw.get("quotes", [])
    if isinstance(raw_quotes, list):
        for quote in raw_quotes:
            if isinstance(quote, dict) and quote.get("action_id"):
                ids.append(str(quote["action_id"]))

    return ids


def _fallback_themes(actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    content_actions = _content_actions(actions)
    if not content_actions:
        return []

    concern_actions = [
        act for act in content_actions if act.get("action_type") != "ADVOCATE"
    ] or content_actions

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for act in concern_actions:
        grouped[_infer_concern(act)].append(act)

    ranked = sorted(grouped.items(), key=lambda kv: len(kv[1]), reverse=True)[:3]
    total = len(concern_actions)
    themes = []
    for label, acts in ranked:
        quotes = [_quote_from_action(act) for act in acts[:3]]
        themes.append({
            "label": label,
            "description": _description_for(label),
            "volume": len(acts),
            "volume_pct": round(100 * len(acts) / max(1, total)),
            "quotes": quotes,
            "departments_affected": sorted({
                q.get("department", "") for q in quotes if q.get("department")
            }),
        })
    return themes


def _infer_concern(action: dict[str, Any]) -> str:
    explicit = action.get("primary_concern_dimension")
    if explicit:
        return _clean_label(str(explicit).replace("_", " "))

    text = f"{action.get('content', '')} {action.get('action_type', '')}".lower()
    scores: Counter[str] = Counter()
    for label, keywords in CONCERN_KEYWORDS:
        for keyword in keywords:
            if keyword in text:
                scores[label] += 1

    if scores:
        return scores.most_common(1)[0][0]

    action_type = action.get("action_type")
    if action_type == "REQUEST_EXCEPTION":
        return "Exception process uncertainty"
    if action_type == "MESSAGE_MANAGER":
        return "Manager escalation"
    if action_type == "ADVOCATE":
        return "Leadership rationale landed"
    return DEFAULT_LABEL


def _quotes_by_label(
    label: str,
    actions: list[dict[str, Any]],
    used_quote_ids: set[str],
) -> list[dict[str, Any]]:
    quotes = []
    for act in actions:
        action_id = str(act.get("id", ""))
        if action_id in used_quote_ids:
            continue
        if _infer_concern(act) != label:
            continue
        quotes.append(_quote_from_action(act))
        used_quote_ids.add(action_id)
        if len(quotes) >= 3:
            break
    return quotes


def _quote_from_action(action: dict[str, Any]) -> dict[str, Any]:
    return {
        "text": str(action.get("content", "")).strip(),
        "agent_id": str(action.get("agent_id", "")),
        "action_id": str(action.get("id", "")),
        "department": str(action.get("department", "")),
        "role": str(action.get("role", "")),
    }


def _description_for(label: str) -> str:
    descriptions = {
        "Caregiving burden": "Employees are worried the policy does not account for caregiving, medical, or accessibility constraints.",
        "Commute strain": "Employees expect the change to create meaningful time and energy costs outside work.",
        "Loss of flexibility": "Employees read the policy as reducing autonomy and flexibility they rely on to do good work.",
        "Trust gap": "Employees question whether leadership explained the decision clearly or involved affected teams.",
        "Compensation fairness": "Employees are reacting to perceived unfairness in pay, bonuses, or benefits.",
        "Career uncertainty": "Employees are worried the policy creates unclear career, manager, or role expectations.",
        "Attrition risk": "Employee reactions indicate higher likelihood of job-search or retention risk.",
        "Exception process uncertainty": "Employees need clearer, safer paths for exceptions and accommodations.",
        "Manager escalation": "Employees are raising policy concerns privately through management channels.",
        "Leadership rationale landed": "Some employees are repeating leadership's rationale and encouraging peers to try the change.",
    }
    return descriptions.get(label, "Employee messages cluster around a shared concern in the policy rollout.")


def _clean_label(label: str) -> str:
    label = re.sub(r"[^A-Za-z0-9 /&-]+", "", label).strip()
    label = re.sub(r"\s+", " ", label)
    if not label:
        return DEFAULT_LABEL
    return label[:60].title() if label.islower() else label[:60]
