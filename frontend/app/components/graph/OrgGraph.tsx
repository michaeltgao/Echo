"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
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

  // Reporting line edges — solid blue, agent → manager.
  for (const a of nw.agents) {
    if (!a.manager_id) continue;
    edges.push({
      id: `report:${a.id}->${a.manager_id}`,
      source: a.id,
      target: a.manager_id,
      type: "straight",
      style: { stroke: "#3b82f6", strokeWidth: 1.4, opacity: 0.55 },
    });
  }

  // Collaboration edges — dashed light gray, weight → opacity.
  for (const e of nw.collaboration_edges) {
    edges.push({
      id: `collab:${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: "straight",
      style: {
        stroke: "#a3a3a3",
        strokeWidth: 1,
        strokeDasharray: "4 4",
        opacity: 0.15 + e.weight * 0.35,
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
  const layout = useMemo(() => buildLayout(northwind), [northwind]);

  const initial = useMemo(
    () => buildGraph(northwind, layout.initialPositions),
    [northwind, layout.initialPositions],
  );

  const [graph, setGraph] = useState<BuiltGraph>(initial);
  const settleStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // On mount: animate from circle (initialPositions) to settled (positions)
  // over SETTLE_MS using cubic ease-out.
  useEffect(() => {
    settleStartRef.current = null;

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
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [layout]);

  return (
    <div
      className="relative h-[600px] w-full overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950"
      style={{ minWidth: GRAPH_VIEWPORT.width / 2 }}
    >
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.4}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#1f2937"
        />
        <Controls
          showInteractive={false}
          className="!bg-neutral-900 !border-neutral-700 [&_button]:!bg-neutral-900 [&_button]:!border-neutral-700 [&_button]:!text-neutral-300"
        />
      </ReactFlow>
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
