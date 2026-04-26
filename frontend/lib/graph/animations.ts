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

// Tuned for a dark canvas. Used both for edge pulses (P2 hero visual) and as
// the action-feed accent (P3 will reuse).
export const ACTION_COLOR: Record<ActionType, string> = {
  VENT_TO_PEER: "#fb923c", // orange-400
  POST_IN_CHANNEL: "#ef4444", // red-500
  MESSAGE_MANAGER: "#3b82f6", // blue-500
  GO_QUIET: "#a3a3a3", // neutral-400
  UPDATE_LINKEDIN: "#a855f7", // purple-500
  ADVOCATE: "#22c55e", // green-500
  REQUEST_EXCEPTION: "#facc15", // yellow-400
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
