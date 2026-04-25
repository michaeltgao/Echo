"""Activity Scheduler: deterministic plan of WHO acts on WHICH day.

Inspired by MiroFish's time-aware activity multipliers — agents don't all
fire every day. Influencers go first, peers react in waves. Manager
responses come days later. Most agents act 1-3 times across the 30 days.

No LLM. Pure math. Output: dict[day -> list[agent_id]].

Logic:
  - Each agent has a per-day activation probability driven by:
      base_rate (low; most days, do nothing)
      + influence_weight × early_bias[day]   (influencers act early)
      + predisposition_strength × pressure_curve[day]  (strong feelings emerge over time)
  - Total target: ~5-12 active agents/day, spread across 30 days
  - Same agent CAN act multiple times if pressure stays high
  - Seeded RNG so a given (policy_hash, agents) deterministically produces
    the same schedule (helps cache + makes the demo reproducible)
"""
from __future__ import annotations

import hashlib
import random
from typing import Any

# Day curve: how strongly the average agent feels pressure to act on each day.
# Day 0 = announcement; days 1-3 = strongest reaction wave; then a slow tail.
PRESSURE_CURVE = [
    0.30, 0.55, 0.80, 0.75, 0.60,  # days 0-4: announcement shock + initial reactions
    0.50, 0.45, 0.40, 0.35, 0.32,  # days 5-9: peer influence spreading
    0.30, 0.28, 0.27, 0.26, 0.25,  # days 10-14: stabilizing
    0.24, 0.23, 0.22, 0.21, 0.20,  # days 15-19: slow tail
    0.20, 0.19, 0.18, 0.17, 0.16,  # days 20-24
    0.15, 0.15, 0.14, 0.14, 0.13,  # days 25-29
]

# How much earlier days favor influencers (high-influence agents act first)
EARLY_BIAS = [
    0.6, 0.5, 0.4, 0.3, 0.2,
    0.15, 0.1, 0.08, 0.06, 0.04,
] + [0.02] * 20

DEFAULT_BASE_RATE = 0.04


def _seed_for(policy_hash: str, agents: list[dict[str, Any]]) -> int:
    """Stable seed from policy + roster so schedule is reproducible per run."""
    h = hashlib.sha256()
    h.update(policy_hash.encode())
    for a in agents:
        h.update(a["id"].encode())
    return int(h.hexdigest()[:8], 16)


def schedule_activity(
    agents: list[dict[str, Any]],
    parsed_policy: dict[str, Any],
    *,
    days: int = 30,
    target_per_day: tuple[int, int] = (3, 7),
    policy_hash: str = "",
    fatigue_decay: float = 0.7,
    fatigue_recovery: float = 0.05,
) -> dict[int, list[str]]:
    """Returns {day: [agent_ids]} mapping.

    Uses per-agent fatigue so the same loud agents don't speak every day.
    After an agent acts, their score is multiplied by fatigue_decay; they
    recover by fatigue_recovery each subsequent day.
    """
    rng = random.Random(_seed_for(policy_hash or parsed_policy.get("category", ""), agents))
    severity = parsed_policy.get("severity", 0.5)

    schedule: dict[int, list[str]] = {d: [] for d in range(days)}
    fatigue: dict[str, float] = {a["id"]: 1.0 for a in agents}  # 1.0 = fully fresh

    for day in range(days):
        pressure = PRESSURE_CURVE[day] if day < len(PRESSURE_CURVE) else 0.1
        early = EARLY_BIAS[day] if day < len(EARLY_BIAS) else 0.0

        scored: list[tuple[float, str]] = []
        for a in agents:
            influence = a.get("influence_weight", 0.5)
            pred_strength = a.get("predisposition_strength", 0.4)
            predisposition = a.get("predisposition", "neutral")

            pred_mult = (
                1.0 if predisposition == "negative"
                else 0.7 if predisposition == "positive"
                else 0.3
            )

            base_score = (
                DEFAULT_BASE_RATE
                + influence * early
                + pred_strength * pressure * pred_mult * severity
            )
            score = base_score * fatigue[a["id"]] + rng.uniform(0, 0.05)
            scored.append((score, a["id"]))

        k_min, k_max = target_per_day
        # Scale by severity^2 so gentle policies produce dramatically fewer actions.
        # severity 0.7 -> ~1.08x, 0.5 -> ~0.6x, 0.3 -> ~0.28x. The simulation should
        # FEEL different — fewer voices speaking on a calmer policy.
        severity_scale = max(0.2, min(1.3, severity ** 2 * 2.0 + 0.1))
        target_k = int((k_min + (k_max - k_min) * pressure) * severity_scale)
        target_k = max(0, min(len(agents), target_k))

        scored.sort(key=lambda x: x[0], reverse=True)
        active_today = [aid for _, aid in scored[:target_k]]
        schedule[day] = active_today

        # apply fatigue: agents who acted get tired; everyone recovers a bit
        active_set = set(active_today)
        for aid in fatigue:
            if aid in active_set:
                fatigue[aid] *= fatigue_decay
            else:
                fatigue[aid] = min(1.0, fatigue[aid] + fatigue_recovery)

    return schedule


def summarize(schedule: dict[int, list[str]]) -> dict[str, Any]:
    """Quick stats for sanity-checking."""
    total_actions = sum(len(v) for v in schedule.values())
    per_day = [len(schedule[d]) for d in sorted(schedule)]
    unique_agents = len({aid for ids in schedule.values() for aid in ids})
    return {
        "total_actions": total_actions,
        "unique_agents": unique_agents,
        "actions_per_day": per_day,
        "peak_day": per_day.index(max(per_day)) if per_day else 0,
    }
