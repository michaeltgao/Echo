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

const DEPT_TINT: Record<string, string> = {
  Engineering: "border-sky-700/60",
  Product: "border-violet-700/60",
  Sales: "border-amber-700/60",
  Marketing: "border-rose-700/60",
  Ops: "border-emerald-700/60",
};

function AgentNodeImpl({ data }: NodeProps<AgentNodeData>) {
  const { agent } = data;
  const r = nodeRadius(agent.influence_weight);
  const size = r * 2;
  const setHover = useAppStore((s) => s.setHover);

  // Per-day sentiment for this agent. Falls back to baseline before a
  // simulation runs. Re-runs every frame while playback advances currentDay.
  const series = useAppStore((s) => s.sentimentByAgent?.[agent.id]);
  const day = useAppStore((s) => s.currentDay);
  const sentiment = series ? sentimentAtDay(series, day) : agent.baseline_sentiment;
  const fillColor = sentimentColor(sentiment ?? agent.baseline_sentiment);

  // Flight-risk persists once an UPDATE_LINKEDIN happens. The transient halo
  // from `linkedin` set runs for ~1.1s; this Boolean keeps a subtle briefcase
  // marker afterward.
  const flightRisk = useAppStore((s) =>
    s.flightRiskByAgent?.[agent.id]?.[Math.min(
      (s.flightRiskByAgent?.[agent.id]?.length ?? 1) - 1,
      Math.floor(s.currentDay),
    )] ?? false,
  );

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

  const tint = DEPT_TINT[agent.department] ?? "border-neutral-600";

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

      {/* Influencer aura — soft glow while this high-influence node is acting */}
      {showInfluencerGlow && (
        <div
          className="pointer-events-none absolute -inset-3 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)",
            animation: "fx-pulse 1s ease-out infinite",
          }}
        />
      )}

      {/* LinkedIn halo — purple ring + briefcase indicator */}
      {(isLinkedIn || flightRisk) && (
        <div
          className="pointer-events-none absolute -inset-1.5 rounded-full"
          style={{
            boxShadow: isLinkedIn
              ? "0 0 0 2px #a855f7, 0 0 16px 2px rgba(168,85,247,0.55)"
              : "0 0 0 1.5px rgba(168,85,247,0.5)",
            transition: "box-shadow 200ms ease",
          }}
        />
      )}

      {/* ADVOCATE green pulse on actor */}
      {isAdvocating && (
        <div
          className="pointer-events-none absolute -inset-2 rounded-full"
          style={{
            boxShadow: "0 0 0 2px #22c55e, 0 0 14px 2px rgba(34,197,94,0.55)",
            animation: "fx-pulse 0.7s ease-out 1",
          }}
        />
      )}

      <div
        className={`flex h-full w-full items-center justify-center rounded-full border-2 ${tint} text-[10px] font-semibold shadow-md transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-white/40`}
        style={{
          backgroundColor: fillColor,
          color: "rgba(0,0,0,0.78)",
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
          className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-purple-500 text-white shadow-sm"
          style={{ fontSize: 9, padding: "1px 4px", lineHeight: 1 }}
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
