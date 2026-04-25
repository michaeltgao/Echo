"""Thin Anthropic client wrapper with structured-output helpers.

All LLM calls go through here. Centralizes:
- API key loading
- Model selection
- JSON-mode prompting (Claude doesn't have native JSON mode, we enforce via prompt + parse)
- Retry-once on parse failure
- Async batching helper
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from anthropic import AsyncAnthropic
from dotenv import load_dotenv

load_dotenv()

# Model selection per use case. Sonnet for the bulk hot-path calls (action selection),
# Opus for the 2 quality-critical calls that judges read closely (themes + recommendations).
MODEL_FAST = os.getenv("LLM_MODEL_FAST", "claude-sonnet-4-5-20250929")
MODEL_QUALITY = os.getenv("LLM_MODEL_QUALITY", "claude-opus-4-5-20250929")
MODEL = MODEL_FAST  # default
_client: AsyncAnthropic | None = None


def client() -> AsyncAnthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set. Copy .env.example to .env.")
        _client = AsyncAnthropic(api_key=api_key)
    return _client


def _extract_json(text: str) -> dict[str, Any]:
    """Pull a JSON object out of model text. Tolerates code fences and surrounding prose."""
    text = text.strip()
    if text.startswith("```"):
        # strip ```json ... ``` fences
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.rsplit("```", 1)[0]
    # find first { and last } as a fallback
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found in: {text[:200]}")
    return json.loads(text[start : end + 1])


async def call_json(
    system: str,
    user: str,
    *,
    max_tokens: int = 1024,
    temperature: float = 0.7,
    retries: int = 1,
    model: str | None = None,
) -> dict[str, Any]:
    """Call Claude expecting a JSON object back. Retries once on parse failure.

    model defaults to MODEL_FAST (sonnet). Pass MODEL_QUALITY (opus) for theme
    clustering and recommendations where quality matters more than latency.
    """
    last_err: Exception | None = None
    chosen_model = model or MODEL_FAST
    for attempt in range(retries + 1):
        try:
            resp = await client().messages.create(
                model=chosen_model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            text = resp.content[0].text  # type: ignore[attr-defined]
            return _extract_json(text)
        except Exception as e:
            last_err = e
            if attempt < retries:
                # nudge model harder on retry
                user = user + "\n\nIMPORTANT: respond with VALID JSON only. No prose, no code fences."
                continue
    raise RuntimeError(f"call_json failed after {retries + 1} attempts: {last_err}")


async def gather_with_concurrency(coros, limit: int = 10):
    """Run coroutines with a concurrency cap. Returns results in input order."""
    sem = asyncio.Semaphore(limit)

    async def _bounded(coro):
        async with sem:
            return await coro

    return await asyncio.gather(*[_bounded(c) for c in coros], return_exceptions=True)
