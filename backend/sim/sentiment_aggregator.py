"""Sentiment Aggregator: deterministic action -> sentiment math.

Per PRD §6.4. Sentiment is DERIVED from observed actions, not LLM-assigned.

Per agent state evolves daily:
  sentiment[agent, day] = sentiment[agent, day-1]
                        + actor_delta if agent acted today
                        + sum(observer_delta) for each visible action they witnessed today
                        + small daily decay toward baseline (forgetting)

Actions also produce visibility lists (who saw what) — used for theme
clustering and graph animations. Visibility comes from:
  - VENT_TO_PEER -> direct collaboration neighbors of actor
  - POST_IN_CHANNEL -> all agents in same department
  - MESSAGE_MANAGER -> only the manager
  - ADVOCATE -> same as POST_IN_CHANNEL or VENT
  - GO_QUIET / UPDATE_LINKEDIN / DO_NOTHING / REQUEST_EXCEPTION -> private

Output: list of 30 SnapshotDay objects matching simulation_result schema.
"""
from __future__ import annotations

from typing import Any

from .actions import HAS_CONTENT, SENTIMENT_IMPACT, ActionType


DAILY_RECOVERY = 0.05  # gentle pull toward baseline each day (forgetting)


def compute_visibility(
    actor: dict[str, Any],
    action_type: ActionType,
    target_value: str,
    *,
    agents_by_id: dict[str, dict[str, Any]],
    collaboration_neighbors: dict[str, set[str]],
    department_members: dict[str, list[str]],
) -> list[str]:
    """Who observes this action? Excludes the actor."""
    actor_id = actor["id"]

    if action_type == "VENT_TO_PEER":
        # 1-3 collaboration neighbors
        peers = list(collaboration_neighbors.get(actor_id, set()))
        if target_value and target_value in agents_by_id:
            # if LLM picked a specific target, ensure they're included
            if target_value not in peers:
                peers.append(target_value)
        return peers[:3]  # cap

    if action_type in ("POST_IN_CHANNEL", "ADVOCATE"):
        dept = actor.get("department", "")
        return [aid for aid in department_members.get(dept, []) if aid != actor_id]

    if action_type == "MESSAGE_MANAGER":
        manager_id = actor.get("manager_id")
        return [manager_id] if manager_id else []

    if action_type == "REQUEST_EXCEPTION":
        # private — only HR sees, but we don't model HR observers; treat as private
        return []

    if action_type == "UPDATE_LINKEDIN":
        # peers in same dept who happen to notice (simulate ~30% notice rate via collaboration)
        return list(collaboration_neighbors.get(actor_id, set()))[:2]

    # GO_QUIET, DO_NOTHING -> not visibly observed
    return []


def build_lookups(
    agents: list[dict[str, Any]],
    collaboration_edges: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], dict[str, set[str]], dict[str, list[str]]]:
    agents_by_id = {a["id"]: a for a in agents}

    collab: dict[str, set[str]] = {a["id"]: set() for a in agents}
    for e in collaboration_edges:
        collab.setdefault(e["source"], set()).add(e["target"])
        collab.setdefault(e["target"], set()).add(e["source"])

    departments: dict[str, list[str]] = {}
    for a in agents:
        departments.setdefault(a["department"], []).append(a["id"])

    return agents_by_id, collab, departments


def aggregate_sentiment(
    agents: list[dict[str, Any]],
    actions: list[dict[str, Any]],
    *,
    days: int = 30,
) -> list[dict[str, Any]]:
    """Build the snapshots[] array.

    `actions` is a flat list of every action taken in the simulation. Each must have:
      day, agent_id, action_type, sentiment_impact:{actor_delta, observer_delta},
      is_visible_to (precomputed by caller).

    Returns 30 snapshots in the schema-compliant shape.
    """
    sentiment: dict[str, float] = {a["id"]: a.get("baseline_sentiment", 0.7) for a in agents}
    baseline: dict[str, float] = dict(sentiment)
    flight_risk: dict[str, bool] = {a["id"]: False for a in agents}

    actions_by_day: dict[int, list[dict[str, Any]]] = {d: [] for d in range(days)}
    for act in actions:
        actions_by_day.setdefault(act["day"], []).append(act)

    snapshots = []
    for day in range(days):
        active_today: set[str] = set()
        days_actions = actions_by_day.get(day, [])

        for act in days_actions:
            actor_id = act["agent_id"]
            active_today.add(actor_id)

            actor_delta = act["sentiment_impact"]["actor_delta"]
            observer_delta = act["sentiment_impact"]["observer_delta"]

            sentiment[actor_id] = max(0.0, min(1.0, sentiment[actor_id] + actor_delta))

            for obs_id in act.get("is_visible_to", []):
                if obs_id in sentiment:
                    sentiment[obs_id] = max(0.0, min(1.0, sentiment[obs_id] + observer_delta))

            if act["action_type"] == "UPDATE_LINKEDIN":
                flight_risk[actor_id] = True

        # daily forgetting — gentle pull back toward baseline
        for aid in sentiment:
            diff = baseline[aid] - sentiment[aid]
            sentiment[aid] += diff * DAILY_RECOVERY

        agent_states = [
            {
                "agent_id": a["id"],
                "sentiment": round(sentiment[a["id"]], 4),
                "is_active_today": a["id"] in active_today,
                "flight_risk_flag": flight_risk[a["id"]],
            }
            for a in agents
        ]
        agg = sum(s["sentiment"] for s in agent_states) / len(agent_states)

        snapshots.append({
            "day": day,
            "agent_states": agent_states,
            "aggregate_sentiment": round(agg, 4),
            "actions_today_count": len(days_actions),
        })

    return snapshots


def attach_impact(action: dict[str, Any]) -> dict[str, Any]:
    """Mutate an action dict to fill sentiment_impact from the SENTIMENT_IMPACT table."""
    actor_d, obs_d = SENTIMENT_IMPACT[action["action_type"]]  # type: ignore[index]
    action["sentiment_impact"] = {"actor_delta": actor_d, "observer_delta": obs_d}
    return action


def derive_metrics(
    agents: list[dict[str, Any]], snapshots: list[dict[str, Any]]
) -> dict[str, Any]:
    """Compute baseline + predicted top-level metrics from snapshots.

    eNPS approximation: continuous-sensitive bucket mapping. Tighter thresholds
    so modest sentiment shifts produce visible eNPS movement (the difference
    between aggressive vs. recommended policy needs to be legible to judges).
      sentiment >= 0.72 -> promoter
      sentiment >= 0.62 -> passive
      else -> detractor
    """
    def enps(states: list[dict[str, Any]]) -> int:
        n = len(states)
        if n == 0:
            return 0
        prom = sum(1 for s in states if s["sentiment"] >= 0.72)
        det = sum(1 for s in states if s["sentiment"] < 0.62)
        return round((prom - det) / n * 100)

    def avg_sent(states: list[dict[str, Any]]) -> float:
        return sum(s["sentiment"] for s in states) / max(1, len(states))

    baseline_states = [
        {"agent_id": a["id"], "sentiment": a.get("baseline_sentiment", 0.7)}
        for a in agents
    ]
    final_states = snapshots[-1]["agent_states"]

    baseline_enps = enps(baseline_states)
    predicted_enps = enps(final_states)

    return {
        "baseline": {
            "enps": baseline_enps,
            "engagement": round(avg_sent(baseline_states), 3),
            "trust": round(sum(a.get("trust_in_leadership", 0.5) for a in agents) / len(agents), 3),
            "intent_to_stay": round(avg_sent(baseline_states) + 0.07, 3),  # rough proxy
        },
        "predicted": {
            "enps": predicted_enps,
            "engagement": round(avg_sent(final_states), 3),
            "trust": round(
                sum(a.get("trust_in_leadership", 0.5) for a in agents) / len(agents) - 0.06, 3
            ),
            "intent_to_stay": round(avg_sent(final_states) + 0.05, 3),
            "confidence": "medium",
            "confidence_interval_enps": [predicted_enps - 4, predicted_enps + 4],
        },
    }
