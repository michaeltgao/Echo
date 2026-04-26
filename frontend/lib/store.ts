import { create } from "zustand";
import type { Northwind, SimulationResult, ActionRecord, Stage } from "./types";
import { buildFlightRiskIndex, buildSentimentIndex } from "./graph/sentiment";
import {
  MAX_CONCURRENT_ANIMATIONS,
  type ActiveAnimation,
} from "./graph/animations";

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface AppState {
  northwind: Northwind | null;
  northwindStatus: LoadStatus;
  northwindError: string | null;

  // Simulation state — populated by the SSE consumer (P3 owns the consumer; P2 reads).
  result: SimulationResult | null;
  actions: ActionRecord[];
  stage: Stage | "done" | null;
  parsedPolicy: Record<string, unknown> | null;
  progress: { completed: number; total: number };

  // Pre-indexed views for O(1) per-node lookup during playback.
  sentimentByAgent: Record<string, number[]> | null;
  flightRiskByAgent: Record<string, boolean[]> | null;

  // Timeline / scrubber state — owned by P2's graph.
  currentDay: number;
  isPlaying: boolean;
  playbackMs: number; // total playback length in ms (default ~3000)

  // Hover state for graph popover.
  hoveredAgentId: string | null;
  hoverPos: { x: number; y: number } | null;

  // Action animations — capped concurrency, with overflow queue.
  activeAnimations: ActiveAnimation[];
  animationQueue: ActiveAnimation[];

  setNorthwind: (n: Northwind) => void;
  setNorthwindStatus: (s: LoadStatus, error?: string | null) => void;

  appendAction: (a: ActionRecord) => void;
  setStage: (s: Stage | "done" | null) => void;
  setParsedPolicy: (p: Record<string, unknown> | null) => void;
  setProgress: (completed: number, total: number) => void;
  setResult: (r: SimulationResult | null) => void;
  resetSimulation: () => void;

  setCurrentDay: (d: number) => void;
  setIsPlaying: (p: boolean) => void;
  setPlaybackMs: (ms: number) => void;

  setHover: (agentId: string | null, pos?: { x: number; y: number } | null) => void;

  enqueueAnimations: (anims: ActiveAnimation[]) => void;
  expireAnimations: (nowMs: number) => void;
  clearAnimations: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  northwind: null,
  northwindStatus: "idle",
  northwindError: null,

  result: null,
  actions: [],
  stage: null,
  parsedPolicy: null,
  progress: { completed: 0, total: 0 },
  sentimentByAgent: null,
  flightRiskByAgent: null,

  currentDay: 0,
  isPlaying: false,
  playbackMs: 3000,

  hoveredAgentId: null,
  hoverPos: null,

  activeAnimations: [],
  animationQueue: [],

  setNorthwind: (n) => set({ northwind: n, northwindStatus: "ready", northwindError: null }),
  setNorthwindStatus: (s, error = null) => set({ northwindStatus: s, northwindError: error }),

  appendAction: (a) => set((st) => ({ actions: [...st.actions, a] })),
  setStage: (s) => set({ stage: s }),
  setParsedPolicy: (p) => set({ parsedPolicy: p }),
  setProgress: (completed, total) => set({ progress: { completed, total } }),
  setResult: (r) =>
    set({
      result: r,
      stage: r ? "done" : null,
      sentimentByAgent: r ? buildSentimentIndex(r) : null,
      flightRiskByAgent: r ? buildFlightRiskIndex(r) : null,
    }),
  resetSimulation: () =>
    set({
      result: null,
      actions: [],
      stage: null,
      parsedPolicy: null,
      progress: { completed: 0, total: 0 },
      sentimentByAgent: null,
      flightRiskByAgent: null,
      currentDay: 0,
      isPlaying: false,
      activeAnimations: [],
      animationQueue: [],
    }),

  setCurrentDay: (d) => set({ currentDay: d }),
  setIsPlaying: (p) => set({ isPlaying: p }),
  setPlaybackMs: (ms) => set({ playbackMs: ms }),

  setHover: (agentId, pos = null) => set({ hoveredAgentId: agentId, hoverPos: pos }),

  enqueueAnimations: (incoming) =>
    set((st) => {
      const room = MAX_CONCURRENT_ANIMATIONS - st.activeAnimations.length;
      const promote = incoming.slice(0, Math.max(0, room));
      const queueAdds = incoming.slice(promote.length);
      return {
        activeAnimations: [...st.activeAnimations, ...promote],
        animationQueue: [...st.animationQueue, ...queueAdds],
      };
    }),

  expireAnimations: (nowMs) =>
    set((st) => {
      const stillActive = st.activeAnimations.filter(
        (a) => nowMs - a.startedAt < a.duration,
      );
      // Promote queued items to fill freed slots.
      const room = MAX_CONCURRENT_ANIMATIONS - stillActive.length;
      const promotedFromQueue = st.animationQueue.slice(0, Math.max(0, room)).map(
        (a) => ({ ...a, startedAt: nowMs }),
      );
      const restQueue = st.animationQueue.slice(promotedFromQueue.length);
      if (
        stillActive.length === st.activeAnimations.length &&
        promotedFromQueue.length === 0
      ) {
        return st; // no change
      }
      return {
        activeAnimations: [...stillActive, ...promotedFromQueue],
        animationQueue: restQueue,
      };
    }),

  clearAnimations: () => set({ activeAnimations: [], animationQueue: [] }),
}));
