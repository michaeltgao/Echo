"""Pre-cache layer for canonical policies.

Per PRD §8: cache is a SPEEDUP, not a safety net. Same code path on hit/miss —
just skip the simulation when we have a frozen result for the policy hash.

Persisted to disk under cache/ so a redeploy keeps the canonical demos snappy.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "cache"


def _hash(text: str) -> str:
    return hashlib.sha256(text.strip().encode()).hexdigest()[:16]


def get(policy_text: str) -> dict[str, Any] | None:
    CACHE_DIR.mkdir(exist_ok=True)
    path = CACHE_DIR / f"{_hash(policy_text)}.json"
    if not path.exists():
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def put(policy_text: str, result: dict[str, Any]) -> None:
    CACHE_DIR.mkdir(exist_ok=True)
    path = CACHE_DIR / f"{_hash(policy_text)}.json"
    with open(path, "w") as f:
        json.dump(result, f)


def has(policy_text: str) -> bool:
    return get(policy_text) is not None
