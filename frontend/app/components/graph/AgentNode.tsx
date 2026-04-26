"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { nodeRadius } from "@/lib/graph/layout";
import { sentimentAtDay, sentimentColor } from "@/lib/graph/sentiment";
import { useActiveActorEffects } from "./AnimationLayer";
import { useAppStore } from "@/lib/store";
import type { NorthwindAgent } from "@/lib/types";

export interface AgentNodeData {
  agent: NorthwindAgent;
}

// Department tint = a subtle border accent so depts cluster visually without
// stealing focus from the sentiment fill. Hand-picked warm-canvas hex values.
const DEPT_TINT: Record<string, string> = {
  Engineering: "#5e7a8c", // cool slate-blue
  Product: "#7e6685", // muted plum
  Sales: "#a8754a", // warm rust
  Marketing: "#789166", // soft moss
  Ops: "#a39a8c", // bone-muted (the "house" neutral)
};
const DEPT_TINT_FALLBACK = "#4a4338";

function AgentNodeImpl({ data }: NodeProps<AgentNodeData>) {
  const { agent } = data;
  const r = nodeRadius(agent.influence_weight);
  const size = r * 2;
  const setHover = useAppStore((s) => s.setHover);

  // Sentiment source. In live mode (SSE streaming on /predict/new) we read
  // a single number per agent that mutates as actions arrive. After the
  // final `result` lands, we switch to the snapshot-based time series and
  // sentimentAtDay scrubs through it as `currentDay` advances during
  // playback in /graph or /predict/[id]/results.
  const liveMode = useAppStore((s) => s.liveMode);
  const liveSentiment = useAppStore(
    (s) => s.liveSentimentByAgent?.[agent.id],
  );
  const series = useAppStore((s) => s.sentimentByAgent?.[agent.id]);
  const day = useAppStore((s) => s.currentDay);

  let sentiment: number | null;
  if (liveMode) {
    sentiment = liveSentiment ?? agent.baseline_sentiment;
  } else if (series) {
    sentiment = sentimentAtDay(series, day);
  } else {
    sentiment = agent.baseline_sentiment;
  }
  const fillColor = sentimentColor(sentiment ?? agent.baseline_sentiment);

  // Flight risk: live boolean while streaming, snapshot-indexed during replay.
  const liveFlight = useAppStore(
    (s) => s.liveFlightRiskByAgent?.[agent.id] ?? false,
  );
  const replayFlight = useAppStore((s) =>
    s.flightRiskByAgent?.[agent.id]?.[
      Math.min(
        (s.flightRiskByAgent?.[agent.id]?.length ?? 1) - 1,
        Math.floor(s.currentDay),
      )
    ] ?? false,
  );
  const flightRisk = liveMode ? liveFlight : replayFlight;

  const fx = useActiveActorEffects();
  const isLinkedIn = fx.linkedin.has(agent.id);
  const isQuiet = fx.quiet.has(agent.id);
  const isAdvocating = fx.advocate.has(agent.id);

  // Influencer pulse: only fire while *this* node is the actor of an active
  // animation AND its influence is high. Reads cleanest as an aura on whoever
  // is "speaking right now" with high reach.
  const isHighInfluence = agent.influence_weight >= 0.7;
  const isActiveActor = isLinkedIn || isQuiet || isAdvocating || fx.linkedin.size > 0
    ? isLinkedIn || isQuiet || isAdvocating
    : false;
  // Detect any active animation by this actor for the influencer glow.
  const anyActiveByThis = useAppStore((s) =>
    s.activeAnimations.some((a) => a.action.agent_id === agent.id),
  );
  const showInfluencerGlow = isHighInfluence && anyActiveByThis;

  const initials = agent.name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  const tintColor = DEPT_TINT[agent.department] ?? DEPT_TINT_FALLBACK;

  void isActiveActor; // reserved for future per-state styling tweaks

  const onEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setHover(agent.id, { x: e.clientX, y: e.clientY });
    },
    [agent.id, setHover],
  );
  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setHover(agent.id, { x: e.clientX, y: e.clientY });
    },
    [agent.id, setHover],
  );
  const onLeave = useCallback(() => setHover(null, null), [setHover]);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      data-agent-id={agent.id}
      onMouseEnter={onEnter}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
      />

      {/* Influencer aura — soft amber glow while this high-influence node acts */}
      {showInfluencerGlow && (
        <div
          className="pointer-events-none absolute -inset-3 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(219,160,63,0.20) 0%, transparent 70%)",
            animation: "fx-pulse 1s ease-out infinite",
          }}
        />
      )}

      {/* LinkedIn halo — rust ring (flight risk gravity) + briefcase indicator */}
      {(isLinkedIn || flightRisk) && (
        <div
          className="pointer-events-none absolute -inset-1.5 rounded-full"
          style={{
            boxShadow: isLinkedIn
              ? "0 0 0 2px #a85a3e, 0 0 16px 2px rgba(168,90,62,0.55)"
              : "0 0 0 1.5px rgba(168,90,62,0.5)",
            transition: "box-shadow 200ms ease",
          }}
        />
      )}

      {/* ADVOCATE pulse on actor — sage ring */}
      {isAdvocating && (
        <div
          className="pointer-events-none absolute -inset-2 rounded-full"
          style={{
            boxShadow: "0 0 0 2px #7a9b62, 0 0 14px 2px rgba(122,155,98,0.55)",
            animation: "fx-pulse 0.7s ease-out 1",
          }}
        />
      )}

      <div
        className="flex h-full w-full items-center justify-center rounded-full font-mono font-medium tabular-nums transition-all duration-200 hover:ring-2 hover:ring-amber/50"
        style={{
          // Subtle radial gradient gives nodes depth without fighting the
          // sentiment color. Highlight at top-left, slight darkening at base.
          background: `radial-gradient(circle at 30% 25%, color-mix(in oklab, ${fillColor} 100%, white 12%) 0%, ${fillColor} 60%, color-mix(in oklab, ${fillColor} 85%, black 8%) 100%)`,
          color: "rgba(15,12,10,0.92)",
          fontSize: r >= 18 ? 11 : 9.5,
          letterSpacing: "0.02em",
          border: `1.5px solid ${tintColor}`,
          borderColor: `color-mix(in oklab, ${tintColor} 75%, transparent)`,
          boxShadow: isHighInfluence
            ? `0 1px 0 rgba(15,12,10,0.6), 0 4px 12px -4px ${fillColor}66`
            : `0 1px 0 rgba(15,12,10,0.4), 0 2px 6px -2px rgba(0,0,0,0.3)`,
          filter: isQuiet ? "saturate(0.15) brightness(0.7)" : undefined,
          opacity: isQuiet ? 0.55 : 1,
        }}
      >
        {flightRisk ? (
          <span title="Flight risk">{initials}</span>
        ) : (
          initials
        )}
      </div>

      {/* Briefcase corner indicator post-LinkedIn (lasts beyond the halo) */}
      {flightRisk && (
        <span
          className="pointer-events-none absolute -right-1 -top-1 rounded-full text-bone shadow-sm"
          style={{
            fontSize: 9,
            padding: "1px 4px",
            lineHeight: 1,
            background: "#a85a3e",
          }}
          title="Updated LinkedIn"
        >
          💼
        </span>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </div>
  );
}

export default memo(AgentNodeImpl);
