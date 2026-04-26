"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore as useReactFlowStore } from "reactflow";
import { useAppStore } from "@/lib/store";
import {
  ACTION_COLOR,
  type ActiveAnimation,
  easeInOutCubic,
  easeOutQuad,
} from "@/lib/graph/animations";
import { nodeRadius } from "@/lib/graph/layout";
import type { ActionRecord, NorthwindAgent } from "@/lib/types";

interface AnimationLayerProps {
  positions: Map<string, { x: number; y: number }>;
}

// SVG overlay that lives inside the React Flow container. Reads RF's
// viewport transform so its coordinates align with node positions.
//
// Single render per frame (rAF self-driven while there are active animations).
// Renders each ActiveAnimation per type:
//   VENT_TO_PEER       → moving dot(s) actor → each peer in is_visible_to (cap 3)
//   POST_IN_CHANNEL    → expanding ring from actor + dots → dept members (cap 6)
//   MESSAGE_MANAGER    → moving dot up the reporting line to manager
//   ADVOCATE           → green dot(s) actor → target(s)
//   REQUEST_EXCEPTION  → small yellow dot to manager
//   UPDATE_LINKEDIN    → halo glow rendered by AgentNode (no edge fx)
//   GO_QUIET           → desaturate handled by AgentNode (no edge fx)
export default function AnimationLayer({ positions }: AnimationLayerProps) {
  const transform = useReactFlowStore((s) => s.transform);
  const active = useAppStore((s) => s.activeAnimations);
  const nw = useAppStore((s) => s.northwind);

  const agentsById = useMemo(() => {
    const m = new Map<string, NorthwindAgent>();
    if (nw) for (const a of nw.agents) m.set(a.id, a);
    return m;
  }, [nw]);

  // Self-driven rAF tick while we have animations — bumps `frame` so the
  // SVG re-renders every frame even when active list is unchanged (positions
  // depend on time-since-start, not on active membership).
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (active.length === 0) return;
    let rafId: number | null = null;
    const loop = () => {
      setFrame((f) => (f + 1) % 1_000_000);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [active.length]);
  // (frame is read implicitly via state subscription)
  void frame;

  const now = performance.now();

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ overflow: "visible" }}
    >
      <g transform={`translate(${transform[0]}, ${transform[1]}) scale(${transform[2]})`}>
        {active.map((anim) => {
          const t = Math.min(1, (now - anim.startedAt) / anim.duration);
          return (
            <AnimationFx
              key={anim.id}
              anim={anim}
              t={t}
              positions={positions}
              agentsById={agentsById}
            />
          );
        })}
      </g>
    </svg>
  );
}

interface FxProps {
  anim: ActiveAnimation;
  t: number; // 0..1
  positions: Map<string, { x: number; y: number }>;
  agentsById: Map<string, NorthwindAgent>;
}

function AnimationFx({ anim, t, positions, agentsById }: FxProps) {
  const action = anim.action;
  const actorPos = positions.get(action.agent_id);
  if (!actorPos) return null;
  const color = ACTION_COLOR[action.action_type];

  switch (action.action_type) {
    case "VENT_TO_PEER":
      return (
        <PeerPulses
          action={action}
          actorPos={actorPos}
          positions={positions}
          color={color}
          t={t}
          maxTargets={3}
        />
      );

    case "POST_IN_CHANNEL":
      return (
        <ChannelRipple
          action={action}
          actorPos={actorPos}
          positions={positions}
          agentsById={agentsById}
          color={color}
          t={t}
        />
      );

    case "MESSAGE_MANAGER":
      return (
        <PeerPulses
          action={action}
          actorPos={actorPos}
          positions={positions}
          color={color}
          t={t}
          maxTargets={1}
          curveAmount={0}
        />
      );

    case "REQUEST_EXCEPTION":
      return (
        <PeerPulses
          action={action}
          actorPos={actorPos}
          positions={positions}
          color={color}
          t={t}
          maxTargets={1}
        />
      );

    case "ADVOCATE":
      return (
        <ChannelRipple
          action={action}
          actorPos={actorPos}
          positions={positions}
          agentsById={agentsById}
          color={color}
          t={t}
          peerCap={4}
        />
      );

    default:
      return null;
  }
}

/** Curve helper — produces a midpoint offset perpendicular to the segment. */
function curvedPath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  bend: number,
): string {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  // perpendicular unit
  const px = -dy / len;
  const py = dx / len;
  const cx = mx + px * bend;
  const cy = my + py * bend;
  return `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
}

/** Position along a quadratic Bezier at parameter u in [0,1]. */
function quadPoint(
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  bx: number,
  by: number,
  u: number,
): { x: number; y: number } {
  const ix = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * cx + u * u * bx;
  const iy = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * cy + u * u * by;
  return { x: ix, y: iy };
}

interface PeerPulsesProps {
  action: ActionRecord;
  actorPos: { x: number; y: number };
  positions: Map<string, { x: number; y: number }>;
  color: string;
  t: number;
  maxTargets: number;
  curveAmount?: number;
}

function PeerPulses({
  action,
  actorPos,
  positions,
  color,
  t,
  maxTargets,
  curveAmount = 24,
}: PeerPulsesProps) {
  const targets = (action.is_visible_to ?? []).slice(0, maxTargets);
  if (targets.length === 0) return null;
  const u = easeInOutCubic(t);
  // Fade out near the end.
  const opacity = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;

  return (
    <g opacity={opacity}>
      {/* Tiny actor pulse so the eye picks up the source. */}
      <circle
        cx={actorPos.x}
        cy={actorPos.y}
        r={6 + 18 * easeOutQuad(t)}
        fill="none"
        stroke={color}
        strokeOpacity={0.55 * (1 - t)}
        strokeWidth={2}
      />

      {targets.map((targetId, i) => {
        const tp = positions.get(targetId);
        if (!tp) return null;
        // Stagger multiple particles slightly for visual layering.
        const stagger = i * 0.06;
        const uu = Math.min(1, Math.max(0, u - stagger));
        // Alternate bend direction so multiple particles don't overlap.
        const bend = curveAmount * (i % 2 === 0 ? 1 : -1) * (i + 1) * 0.6;
        const mx = (actorPos.x + tp.x) / 2;
        const my = (actorPos.y + tp.y) / 2;
        const dx = tp.x - actorPos.x;
        const dy = tp.y - actorPos.y;
        const len = Math.hypot(dx, dy) || 1;
        const cx = mx - (dy / len) * bend;
        const cy = my + (dx / len) * bend;
        const p = quadPoint(actorPos.x, actorPos.y, cx, cy, tp.x, tp.y, uu);
        return (
          <g key={targetId}>
            <path
              d={curvedPath(actorPos.x, actorPos.y, tp.x, tp.y, bend)}
              fill="none"
              stroke={color}
              strokeOpacity={0.25 * (1 - t)}
              strokeWidth={1.4}
              strokeDasharray="3 3"
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={5}
              fill={color}
              filter="url(#fx-glow)"
            />
          </g>
        );
      })}
    </g>
  );
}

interface ChannelRippleProps {
  action: ActionRecord;
  actorPos: { x: number; y: number };
  positions: Map<string, { x: number; y: number }>;
  agentsById: Map<string, NorthwindAgent>;
  color: string;
  t: number;
  peerCap?: number;
}

function ChannelRipple({
  action,
  actorPos,
  positions,
  color,
  t,
  peerCap = 6,
}: ChannelRippleProps) {
  // Outgoing ring + dots flying to up to N visible peers.
  const visible = (action.is_visible_to ?? []).slice(0, peerCap);
  const ringR = 10 + 80 * easeOutQuad(t);
  const ringOpacity = 0.6 * (1 - t);
  const u = easeInOutCubic(t);
  const dotOpacity = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;

  return (
    <g>
      {/* Ripple ring */}
      <circle
        cx={actorPos.x}
        cy={actorPos.y}
        r={ringR}
        fill="none"
        stroke={color}
        strokeOpacity={ringOpacity}
        strokeWidth={2}
      />
      {/* Inner pulse */}
      <circle
        cx={actorPos.x}
        cy={actorPos.y}
        r={6 + 8 * easeOutQuad(t)}
        fill={color}
        opacity={0.85 * (1 - t)}
      />
      {/* Dots → each peer */}
      <g opacity={dotOpacity}>
        {visible.map((id, i) => {
          const tp = positions.get(id);
          if (!tp) return null;
          const stagger = i * 0.05;
          const uu = Math.min(1, Math.max(0, u - stagger));
          const x = actorPos.x + (tp.x - actorPos.x) * uu;
          const y = actorPos.y + (tp.y - actorPos.y) * uu;
          return (
            <circle
              key={id}
              cx={x}
              cy={y}
              r={3.5}
              fill={color}
              filter="url(#fx-glow)"
            />
          );
        })}
      </g>
    </g>
  );
}

// SVG filter defs we reference by id from Fx components. Place once in OrgGraph.
export function FxDefs() {
  return (
    <svg width={0} height={0} className="absolute" aria-hidden>
      <defs>
        <filter id="fx-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

// Helper: when an actor's UPDATE_LINKEDIN or GO_QUIET is active, surface that
// to AgentNode via a small Set selector. Avoids each node iterating active.
export function useActiveActorEffects() {
  const active = useAppStore((s) => s.activeAnimations);
  return useMemo(() => {
    const linkedin = new Set<string>();
    const quiet = new Set<string>();
    const advocate = new Set<string>();
    for (const a of active) {
      if (a.action.action_type === "UPDATE_LINKEDIN") linkedin.add(a.action.agent_id);
      else if (a.action.action_type === "GO_QUIET") quiet.add(a.action.agent_id);
      else if (a.action.action_type === "ADVOCATE") advocate.add(a.action.agent_id);
    }
    return { linkedin, quiet, advocate };
  }, [active]);
}

/** Width helper exported so the AnimationLayer + AgentNode share node radius. */
export function nodeR(agent: NorthwindAgent): number {
  return nodeRadius(agent.influence_weight);
}
