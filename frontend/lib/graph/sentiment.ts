// Sentiment → color mapping for the org graph.
// Spec (PRD/P2 task): <0.4 red, 0.4-0.6 yellow, 0.6-0.75 yellow-green, >0.75 green.
// We anchor at band boundaries and linearly interpolate between for smooth playback.

import type { SimulationResult } from "@/lib/types";

interface Stop {
  s: number; // sentiment value
  r: number;
  g: number;
  b: number;
}

const STOPS: Stop[] = [
  { s: 0.0, r: 239, g: 68, b: 68 }, // red-500
  { s: 0.4, r: 245, g: 158, b: 11 }, // amber-500
  { s: 0.6, r: 250, g: 204, b: 21 }, // yellow-400
  { s: 0.75, r: 132, g: 204, b: 22 }, // lime-500
  { s: 1.0, r: 34, g: 197, b: 94 }, // green-500
];

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function sentimentColor(sentiment: number): string {
  const s = clamp01(sentiment);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (s >= a.s && s <= b.s) {
      const t = (s - a.s) / (b.s - a.s || 1);
      const r = Math.round(a.r + (b.r - a.r) * t);
      const g = Math.round(a.g + (b.g - a.g) * t);
      const bl = Math.round(a.b + (b.b - a.b) * t);
      return `rgb(${r} ${g} ${bl})`;
    }
  }
  const last = STOPS[STOPS.length - 1];
  return `rgb(${last.r} ${last.g} ${last.b})`;
}

/** Linearly interpolate between two day's sentiment for a given agent. */
export function sentimentAtDay(
  series: number[] | undefined,
  dayFloat: number,
): number | null {
  if (!series || series.length === 0) return null;
  const i = Math.min(series.length - 1, Math.max(0, Math.floor(dayFloat)));
  const j = Math.min(series.length - 1, i + 1);
  const t = dayFloat - i;
  return series[i] + (series[j] - series[i]) * t;
}

/** Build {agentId -> sentiment[day]} once per result so per-node lookup is O(1). */
export function buildSentimentIndex(
  result: SimulationResult,
): Record<string, number[]> {
  const idx: Record<string, number[]> = {};
  for (const snap of result.snapshots ?? []) {
    for (const st of snap.agent_states ?? []) {
      const arr = (idx[st.agent_id] ??= []);
      arr.push(st.sentiment);
    }
  }
  return idx;
}

/** Build {agentId -> day -> flight_risk_flag} similarly. */
export function buildFlightRiskIndex(
  result: SimulationResult,
): Record<string, boolean[]> {
  const idx: Record<string, boolean[]> = {};
  for (const snap of result.snapshots ?? []) {
    for (const st of snap.agent_states ?? []) {
      const arr = (idx[st.agent_id] ??= []);
      arr.push(Boolean(st.flight_risk_flag));
    }
  }
  return idx;
}
