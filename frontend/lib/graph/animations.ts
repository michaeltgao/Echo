// Action animation primitives. Action-type → duration + color, plus the
// shape that the renderer iterates over.

import type { ActionRecord, ActionType } from "@/lib/types";

export const MAX_CONCURRENT_ANIMATIONS = 5;

export const ACTION_DURATION_MS: Record<ActionType, number> = {
  VENT_TO_PEER: 700,
  POST_IN_CHANNEL: 950,
  MESSAGE_MANAGER: 700,
  GO_QUIET: 850,
  UPDATE_LINKEDIN: 1100,
  ADVOCATE: 700,
  REQUEST_EXCEPTION: 650,
  DO_NOTHING: 0,
};

// Tuned for the warm-ink editorial canvas. Functional differentiation kept
// (each type is visually distinct), but pulled toward the palette so the
// graph reads as part of the product, not a Tailwind dashboard.
export const ACTION_COLOR: Record<ActionType, string> = {
  VENT_TO_PEER: "#dba03f", // amber-bright (heated, but ours)
  POST_IN_CHANNEL: "#c4892b", // amber (loud, broadcast)
  MESSAGE_MANAGER: "#a39a8c", // bone-muted (private, structural)
  GO_QUIET: "#736a5e", // bone-faint (withdrawal)
  UPDATE_LINKEDIN: "#a85a3e", // rust (flight, gravity)
  ADVOCATE: "#7a9b62", // sage (positive)
  REQUEST_EXCEPTION: "#d8b870", // sand (formal ask)
  DO_NOTHING: "transparent",
};

export interface ActiveAnimation {
  id: string;
  action: ActionRecord;
  startedAt: number; // performance.now()
  duration: number;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
