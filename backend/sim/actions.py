"""Action types + sentiment impact mapping.

Single source of truth. PRD §6.4 maps action -> sentiment delta.
Frontend uses the same action_type strings; do not rename without coordinating.
"""
from __future__ import annotations

from typing import Literal

ActionType = Literal[
    "VENT_TO_PEER",
    "POST_IN_CHANNEL",
    "MESSAGE_MANAGER",
    "GO_QUIET",
    "UPDATE_LINKEDIN",
    "ADVOCATE",
    "REQUEST_EXCEPTION",
    "DO_NOTHING",
]

ALL_ACTIONS: tuple[ActionType, ...] = (
    "VENT_TO_PEER",
    "POST_IN_CHANNEL",
    "MESSAGE_MANAGER",
    "GO_QUIET",
    "UPDATE_LINKEDIN",
    "ADVOCATE",
    "REQUEST_EXCEPTION",
    "DO_NOTHING",
)

# (actor_delta, observer_delta). Applied to actor's sentiment + each observer's sentiment.
# Tuned so 30 days of accumulated actions produce realistic eNPS swings (-10 to -25
# for a major policy shock), not catastrophic crashes. An agent who acts 4-5 times
# negatively over 30 days should drop ~0.15-0.20 in sentiment, not 0.6+.
SENTIMENT_IMPACT: dict[ActionType, tuple[float, float]] = {
    "ADVOCATE": (0.025, 0.010),
    "DO_NOTHING": (0.0, 0.0),
    "VENT_TO_PEER": (-0.010, -0.005),
    "POST_IN_CHANNEL": (-0.016, -0.007),
    "MESSAGE_MANAGER": (-0.013, 0.0),
    "REQUEST_EXCEPTION": (-0.008, 0.0),
    "GO_QUIET": (-0.020, 0.0),
    "UPDATE_LINKEDIN": (-0.034, -0.005),
}

# Targets that make sense per action. Used to validate LLM output and shape prompts.
VALID_TARGET_TYPES: dict[ActionType, set[str]] = {
    "VENT_TO_PEER": {"agent"},
    "POST_IN_CHANNEL": {"channel"},
    "MESSAGE_MANAGER": {"manager"},
    "GO_QUIET": {"none"},
    "UPDATE_LINKEDIN": {"external"},
    "ADVOCATE": {"channel", "agent"},
    "REQUEST_EXCEPTION": {"manager", "channel"},  # channel = HR
    "DO_NOTHING": {"none"},
}

# Whether the action produces visible content (for theme clusterer + feed).
HAS_CONTENT: dict[ActionType, bool] = {
    "VENT_TO_PEER": True,
    "POST_IN_CHANNEL": True,
    "MESSAGE_MANAGER": True,
    "GO_QUIET": False,
    "UPDATE_LINKEDIN": False,
    "ADVOCATE": True,
    "REQUEST_EXCEPTION": True,
    "DO_NOTHING": False,
}
