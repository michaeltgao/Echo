// SSE event shapes emitted by POST /simulate/stream.
// Source of truth: backend/sim/simulator_stream.py.

import type { SimulationResult } from "./simulation";

export type ActionType =
  | "VENT_TO_PEER"
  | "POST_IN_CHANNEL"
  | "MESSAGE_MANAGER"
  | "GO_QUIET"
  | "UPDATE_LINKEDIN"
  | "ADVOCATE"
  | "REQUEST_EXCEPTION"
  | "DO_NOTHING";

export type Stage = "parsing" | "enriching" | "scheduling" | "acting" | "aggregating";

export interface ActionTarget {
  type: "agent" | "channel" | "manager" | "external" | "none";
  value: string;
}

export interface ActionRecord {
  id: string;
  day: number;
  intra_day_order: number;
  agent_id: string;
  action_type: ActionType;
  target: ActionTarget;
  content: string;
  intensity: number;
  is_visible_to: string[];
  sentiment_impact?: { actor_delta: number; observer_delta: number };
}

export type SSEEvent =
  | { type: "stage"; stage: Stage; elapsed_ms: number; _cached?: boolean }
  | { type: "parsed"; parsed_policy: Record<string, unknown> }
  | { type: "action"; action: ActionRecord }
  | { type: "tick"; completed: number; total: number }
  | { type: "result"; result: SimulationResult }
  | { type: "error"; message: string };
