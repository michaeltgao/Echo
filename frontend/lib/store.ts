import { create } from "zustand";
import type { Northwind, SimulationResult, ActionRecord, Stage } from "./types";
import { buildFlightRiskIndex, buildSentimentIndex } from "./graph/sentiment";
import {
  ACTION_DURATION_MS,
  MAX_CONCURRENT_ANIMATIONS,
  type ActiveAnimation,
} from "./graph/animations";

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

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
  simulationError: string | null;

  // Comparison state — set when user clicks "Apply Recommendation". Holds the
  // v1 result so the compare view can render v1-vs-current side-by-side after
  // v2 runs.
  comparisonV1: SimulationResult | null;

  // Sample-run state used by /graph. Both canonical RTO results pre-fetched
  // on mount so toggling between versions is instant. `activeVersion` selects
  // which one is mirrored into the main `result` slot above.
  resultV1: SimulationResult | null;
  resultV2: SimulationResult | null;
  activeVersion: "v1" | "v2";

  // Live-streaming state used by /predict/new while SSE actions arrive. Lets
  // the org graph animate in real time per-action (sentiment cascades, edge
  // pulses, flight-risk halos) before the final `result` lands and we can
  // switch to snapshot-based playback.
  liveMode: boolean;
  liveSentimentByAgent: Record<string, number> | null;
  liveFlightRiskByAgent: Record<string, boolean> | null;

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
  setSimulationError: (msg: string | null) => void;
  setComparisonV1: (r: SimulationResult | null) => void;
  setVersionResult: (v: "v1" | "v2", r: SimulationResult | null) => void;
  setActiveVersion: (v: "v1" | "v2") => void;
  beginLiveRun: () => void;
  endLiveRun: () => void;
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
  simulationError: null,
  comparisonV1: null,
  resultV1: null,
  resultV2: null,
  activeVersion: "v1",
  liveMode: false,
  liveSentimentByAgent: null,
  liveFlightRiskByAgent: null,
  sentimentByAgent: null,
  flightRiskByAgent: null,

  currentDay: 0,
  isPlaying: false,
  playbackMs: 30000,

  hoveredAgentId: null,
  hoverPos: null,

  activeAnimations: [],
  animationQueue: [],

  setNorthwind: (n) => set({ northwind: n, northwindStatus: "ready", northwindError: null }),
  setNorthwindStatus: (s, error = null) => set({ northwindStatus: s, northwindError: error }),

  appendAction: (a) =>
    set((st) => {
      const patch: Partial<AppState> = { actions: [...st.actions, a] };

      // ── Live mode: mutate per-agent sentiment + flight risk in real time
      // so the org graph animates frame-perfectly as each SSE action arrives.
      if (st.liveMode && st.liveSentimentByAgent) {
        const ls = { ...st.liveSentimentByAgent };
        const fr = st.liveFlightRiskByAgent
          ? { ...st.liveFlightRiskByAgent }
          : {};

        const impact = a.sentiment_impact;
        const actorDelta = impact?.actor_delta ?? 0;
        const observerDelta = impact?.observer_delta ?? 0;
        if (a.agent_id in ls) {
          ls[a.agent_id] = clamp01(ls[a.agent_id] + actorDelta);
        }
        for (const obs of a.is_visible_to ?? []) {
          if (obs in ls) {
            ls[obs] = clamp01(ls[obs] + observerDelta);
          }
        }
        if (a.action_type === "UPDATE_LINKEDIN") {
          fr[a.agent_id] = true;
        }

        patch.liveSentimentByAgent = ls;
        patch.liveFlightRiskByAgent = fr;

        // ── Enqueue an animation immediately. Capped concurrency, with the
        // overflow queue draining via expireAnimations as each fx finishes.
        if (a.action_type !== "DO_NOTHING") {
          const anim: ActiveAnimation = {
            id: a.id,
            action: a,
            startedAt: performance.now(),
            duration: ACTION_DURATION_MS[a.action_type] ?? 700,
          };
          const room = MAX_CONCURRENT_ANIMATIONS - st.activeAnimations.length;
          if (room > 0) {
            patch.activeAnimations = [...st.activeAnimations, anim];
          } else {
            patch.animationQueue = [...st.animationQueue, anim];
          }
        }
      }

      return patch;
    }),
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
  setSimulationError: (msg) => set({ simulationError: msg, stage: null }),
  setComparisonV1: (r) => set({ comparisonV1: r }),
  setVersionResult: (v, r) =>
    set((st) => {
      const patch: Partial<AppState> =
        v === "v1" ? { resultV1: r } : { resultV2: r };
      // If the user is currently viewing this version and we have a fresh
      // result, mirror it into the active result slot too.
      if (st.activeVersion === v && r) {
        return {
          ...patch,
          result: r,
          stage: "done",
          sentimentByAgent: buildSentimentIndex(r),
          flightRiskByAgent: buildFlightRiskIndex(r),
        };
      }
      return patch;
    }),
  setActiveVersion: (v) =>
    set((st) => {
      const target = v === "v1" ? st.resultV1 : st.resultV2;
      return {
        activeVersion: v,
        result: target,
        stage: target ? "done" : null,
        sentimentByAgent: target ? buildSentimentIndex(target) : null,
        flightRiskByAgent: target ? buildFlightRiskIndex(target) : null,
        currentDay: 0,
        isPlaying: false,
        activeAnimations: [],
        animationQueue: [],
      };
    }),

  // Flip on live mode + seed per-agent sentiment from the workforce baseline,
  // so the graph paints reactions as soon as the SSE stream begins.
  beginLiveRun: () =>
    set((st) => {
      const seed: Record<string, number> = {};
      const fr: Record<string, boolean> = {};
      if (st.northwind) {
        for (const agent of st.northwind.agents) {
          seed[agent.id] = clamp01(agent.baseline_sentiment ?? 0.7);
          fr[agent.id] = false;
        }
      }
      return {
        liveMode: true,
        liveSentimentByAgent: seed,
        liveFlightRiskByAgent: fr,
        activeAnimations: [],
        animationQueue: [],
      };
    }),

  // Flip off live mode once the final `result` lands. The snapshot-based
  // playback (sentimentByAgent series indexed by day) takes over from here.
  endLiveRun: () =>
    set({
      liveMode: false,
      liveSentimentByAgent: null,
      liveFlightRiskByAgent: null,
    }),
  resetSimulation: () =>
    set({
      result: null,
      actions: [],
      stage: null,
      parsedPolicy: null,
      progress: { completed: 0, total: 0 },
      simulationError: null,
      sentimentByAgent: null,
      flightRiskByAgent: null,
      liveMode: false,
      liveSentimentByAgent: null,
      liveFlightRiskByAgent: null,
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
