"""P4 module checks: themes, recommendations, and cohort concern wiring.

Run from backend/:
  python -m tests.test_p4_modules
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sim import recommendation, theme_clusterer  # noqa: E402
from sim.simulator import _compute_cohort_metrics  # noqa: E402


SAMPLE_ACTIONS = [
    {
        "id": "act_d01_00",
        "day": 1,
        "agent_id": "emp_001",
        "action_type": "POST_IN_CHANNEL",
        "content": "Honestly this feels like a trust issue, not productivity.",
        "department": "Engineering",
        "role": "Senior IC Engineer",
    },
    {
        "id": "act_d01_01",
        "day": 1,
        "agent_id": "emp_006",
        "action_type": "VENT_TO_PEER",
        "content": "My childcare pickup does not work if the office days are fixed.",
        "department": "Engineering",
        "role": "Senior IC Engineer",
    },
    {
        "id": "act_d02_00",
        "day": 2,
        "agent_id": "emp_021",
        "action_type": "MESSAGE_MANAGER",
        "content": "The comp freeze lands badly when my quota just went up.",
        "department": "Sales",
        "role": "Account Executive",
    },
]


def assert_theme_quote_integrity(themes):
    original = {a["id"]: a["content"] for a in SAMPLE_ACTIONS}
    assert themes, "expected at least one theme"
    for theme in themes:
        assert theme["label"], "theme label missing"
        assert theme["volume"] >= len(theme["quotes"]), "volume should cover quotes"
        for quote in theme["quotes"]:
            assert quote["action_id"] in original, "quote references unknown action"
            assert quote["text"] == original[quote["action_id"]], "quote text must be real action.content"


async def test_theme_fallback():
    original_call_json = theme_clusterer.call_json

    async def fail_call_json(*args, **kwargs):
        raise RuntimeError("force fallback")

    theme_clusterer.call_json = fail_call_json
    try:
        themes = await theme_clusterer.cluster_themes(SAMPLE_ACTIONS)
    finally:
        theme_clusterer.call_json = original_call_json

    assert_theme_quote_integrity(themes)
    labels = {t["label"] for t in themes}
    assert "Trust gap" in labels
    assert "Caregiving burden" in labels


async def test_theme_validation_snaps_to_real_quotes():
    original_call_json = theme_clusterer.call_json

    async def fake_call_json(*args, **kwargs):
        return {
            "themes": [
                {
                    "label": "Trust gap",
                    "description": "Employees question leadership's rationale.",
                    "volume": 2,
                    "quotes": [
                        {
                            "text": "invented quote should not survive",
                            "action_id": "act_d01_00",
                        }
                    ],
                }
            ]
        }

    theme_clusterer.call_json = fake_call_json
    try:
        themes = await theme_clusterer.cluster_themes(SAMPLE_ACTIONS)
    finally:
        theme_clusterer.call_json = original_call_json

    assert themes[0]["quotes"][0]["text"] == SAMPLE_ACTIONS[0]["content"]


async def test_recommendation_fallback_shape():
    original_call_json = recommendation.call_json

    async def fail_call_json(*args, **kwargs):
        raise RuntimeError("force fallback")

    recommendation.call_json = fail_call_json
    try:
        rec = await recommendation.generate_recommendation(
            {
                "scenario_type": "policy_change",
                "category": "return_to_office",
                "severity": 0.72,
            },
            [{"label": "Trust gap", "volume": 3, "quotes": []}],
        )
    finally:
        recommendation.call_json = original_call_json

    assert rec["title"]
    assert "suggested_rewrite" in rec
    assert len(rec["suggested_rewrite"]) > 80
    impact = rec["projected_impact"]
    assert 0 <= impact["negative_action_reduction_pct"] <= 100
    assert impact["confidence"] in {"high", "medium", "low"}


def test_cohort_top_concern_uses_themes():
    agents = [
        {
            "id": "emp_001",
            "department": "Engineering",
            "location": "San Francisco",
            "baseline_sentiment": 0.7,
        },
        {
            "id": "emp_002",
            "department": "Engineering",
            "location": "San Francisco",
            "baseline_sentiment": 0.7,
        },
    ]
    snapshots = [
        {
            "day": 0,
            "agent_states": [
                {"agent_id": "emp_001", "sentiment": 0.63, "flight_risk_flag": False},
                {"agent_id": "emp_002", "sentiment": 0.65, "flight_risk_flag": False},
            ],
        }
    ]
    themes = [
        {
            "label": "Trust gap",
            "quotes": [{"department": "Engineering"}],
            "departments_affected": ["Engineering"],
        }
    ]

    cohorts = _compute_cohort_metrics(agents, snapshots, [], themes)
    assert cohorts[0]["top_concern"] == "Trust gap"


async def main():
    await test_theme_fallback()
    await test_theme_validation_snaps_to_real_quotes()
    await test_recommendation_fallback_shape()
    test_cohort_top_concern_uses_themes()
    print("P4 module checks passed")


if __name__ == "__main__":
    asyncio.run(main())
