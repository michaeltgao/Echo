"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import { useAppStore } from "@/lib/store";
import {
  GRAPH_VIEWPORT,
  buildLayout,
  easeOutCubic,
  nodeRadius,
} from "@/lib/graph/layout";
import { usePlayback } from "@/lib/graph/usePlayback";
import { useActionAnimator } from "@/lib/graph/useActionAnimator";
import AgentNode, { type AgentNodeData } from "./AgentNode";
import AgentPopover from "./AgentPopover";
import AnimationLayer, { FxDefs } from "./AnimationLayer";
import type { Northwind } from "@/lib/types";

const NODE_TYPES: NodeTypes = { agent: AgentNode };
const SETTLE_MS = 1000;

interface BuiltGraph {
  nodes: Node<AgentNodeData>[];
  edges: Edge[];
}

function buildGraph(
  nw: Northwind,
  positions: Map<string, { x: number; y: number }>,
): BuiltGraph {
  const nodes: Node<AgentNodeData>[] = nw.agents.map((agent) => {
    const pos = positions.get(agent.id) ?? { x: 0, y: 0 };
    const r = nodeRadius(agent.influence_weight);
    return {
      id: agent.id,
      type: "agent",
      // React Flow positions nodes by their top-left corner. Offset by radius
      // so the d3-force center aligns with the node's center.
      position: { x: pos.x - r, y: pos.y - r },
      data: { agent },
      draggable: false,
      selectable: false,
    };
  });

  const edges: Edge[] = [];

  // Reporting line edges — bone-dim solid, agent → manager. Subtle structural
  // skeleton; the eye doesn't get pulled to it.
  for (const a of nw.agents) {
    if (!a.manager_id) continue;
    edges.push({
      id: `report:${a.id}->${a.manager_id}`,
      source: a.id,
      target: a.manager_id,
      type: "straight",
      style: { stroke: "#4a4338", strokeWidth: 1.2, opacity: 0.55 },
    });
  }

  // Collaboration edges — dashed hairline, weight → opacity. Even more subtle.
  for (const e of nw.collaboration_edges) {
    edges.push({
      id: `collab:${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: "straight",
      style: {
        stroke: "#3f3630",
        strokeWidth: 1,
        strokeDasharray: "3 4",
        opacity: 0.15 + e.weight * 0.3,
      },
    });
  }

  return { nodes, edges };
}

interface OrgGraphInnerProps {
  northwind: Northwind;
}

function OrgGraphInner({ northwind }: OrgGraphInnerProps) {
  usePlayback();
  useActionAnimator();
  const reactFlow = useReactFlow();
  const layout = useMemo(() => buildLayout(northwind), [northwind]);

  const initial = useMemo(
    () => buildGraph(northwind, layout.initialPositions),
    [northwind, layout.initialPositions],
  );

  const [graph, setGraph] = useState<BuiltGraph>(initial);
  const settleStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const settleDoneRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Compute the precise viewport (zoom + pan) needed to fit ALL final
  // positions with `padding` margin. React Flow's auto-fitView relies on
  // node DOM dimensions and consistently mis-measures custom-rendered
  // nodes — this math always lands the camera correctly.
  const fitToLayout = useCallback(
    (padding = 0.18, duration = 500) => {
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      if (W < 10 || H < 10) return;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const agent of northwind.agents) {
        const p = layout.positions.get(agent.id);
        if (!p) continue;
        const r = nodeRadius(agent.influence_weight);
        if (p.x - r < minX) minX = p.x - r;
        if (p.y - r < minY) minY = p.y - r;
        if (p.x + r > maxX) maxX = p.x + r;
        if (p.y + r > maxY) maxY = p.y + r;
      }
      if (!isFinite(minX)) return;

      const layoutW = maxX - minX;
      const layoutH = maxY - minY;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const inset = 1 + padding * 2;
      const zoomX = W / (layoutW * inset);
      const zoomY = H / (layoutH * inset);
      const zoom = Math.min(zoomX, zoomY, 2);

      reactFlow.setViewport(
        { x: W / 2 - cx * zoom, y: H / 2 - cy * zoom, zoom },
        { duration },
      );
    },
    [layout, northwind, reactFlow],
  );

  // On mount: animate from circle (initialPositions) to settled (positions)
  // over SETTLE_MS using cubic ease-out. Once t === 1, glide the camera
  // to fit the spread layout (otherwise React Flow's auto-fitView locks the
  // viewport to the small initial circle and stays zoomed in).
  useEffect(() => {
    settleStartRef.current = null;
    settleDoneRef.current = false;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = (now: number) => {
      if (settleStartRef.current === null) settleStartRef.current = now;
      const elapsed = now - settleStartRef.current;
      const t = Math.min(1, elapsed / SETTLE_MS);
      const e = easeOutCubic(t);

      setGraph((prev) => ({
        edges: prev.edges,
        nodes: prev.nodes.map((n) => {
          const start = layout.initialPositions.get(n.id);
          const end = layout.positions.get(n.id);
          if (!start || !end) return n;
          const r = nodeRadius(n.data.agent.influence_weight);
          return {
            ...n,
            position: {
              x: lerp(start.x, end.x, e) - r,
              y: lerp(start.y, end.y, e) - r,
            },
          };
        }),
      }));

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!settleDoneRef.current) {
        settleDoneRef.current = true;
        // Camera glides to the actual spread layout with comfortable margin.
        fitToLayout(0.18, 500);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    // Camera glides toward the spread layout in parallel with the node
    // settle. Both arrive at t=1; we re-fit once more at the end to nail
    // sub-pixel precision.
    const initialFit = setTimeout(() => fitToLayout(0.18, 1000), 16);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      clearTimeout(initialFit);
    };
  }, [layout, fitToLayout]);

  // Refit on container resize (handles the setup -> playing column-span swap
  // and any window resize). Throttled by RAF; only fires after settle done.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lastWidth = el.clientWidth;
    let pending = false;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(w - lastWidth) < 32) return;
      lastWidth = w;
      if (!settleDoneRef.current || pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        fitToLayout(0.18, 300);
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [fitToLayout]);

  return (
    <div
      ref={wrapperRef}
      className="relative h-[600px] w-full overflow-hidden rounded-[2px] border border-hairline-strong"
      style={{
        minWidth: GRAPH_VIEWPORT.width / 2,
        // Atmospheric ink — soft radial highlight near center, deepens at edges.
        background:
          "radial-gradient(ellipse 80% 70% at 50% 45%, #1f1a17 0%, #161210 60%, #100c0a 100%)",
      }}
    >
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.4}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={false}
        zoomOnScroll={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={36}
          size={0.6}
          color="#2a221d"
        />
        <Controls
          showInteractive={false}
          className="!bg-ink-elevated !border-hairline-strong !shadow-none [&_button]:!bg-ink-elevated [&_button]:!border-hairline [&_button]:!text-bone-faint [&_button:hover]:!text-amber"
        />
      </ReactFlow>

      {/* Top + bottom vignette gradients for depth */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-20"
        style={{
          background:
            "linear-gradient(to bottom, rgba(16,12,10,0.85), transparent)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
        style={{
          background:
            "linear-gradient(to top, rgba(16,12,10,0.85), transparent)",
        }}
        aria-hidden
      />

      <AnimationLayer positions={layout.positions} />
      <FxDefs />
    </div>
  );
}

export default function OrgGraph() {
  const nw = useAppStore((s) => s.northwind);
  if (!nw) return null;
  return (
    <ReactFlowProvider>
      <OrgGraphInner northwind={nw} />
      <AgentPopover />
    </ReactFlowProvider>
  );
}
