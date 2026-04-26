// Force-directed layout for the org graph.
// Pure data: takes Northwind, returns final {id -> {x, y}} positions plus tick controls.

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";
import type { Northwind } from "@/lib/types";

export interface SimNode extends SimulationNodeDatum {
  id: string;
  department: string;
  /** node radius for collide force / sizing */
  r: number;
}

export interface SimLink {
  source: string;
  target: string;
  weight: number;
}

export interface LayoutResult {
  /** Final settled positions keyed by agent id. */
  positions: Map<string, { x: number; y: number }>;
  /** Starting positions (circle) for the on-mount settle animation. */
  initialPositions: Map<string, { x: number; y: number }>;
  simulation: Simulation<SimNode, SimLink>;
  nodes: SimNode[];
}

const WIDTH = 900;
const HEIGHT = 600;

// Cluster departments around the center so the graph reads as "an org," not
// a uniform blob. Anchors are gentle (low strength) — the link/charge forces
// dominate.
const DEPT_ANCHORS: Record<string, { x: number; y: number }> = {
  Engineering: { x: WIDTH * 0.32, y: HEIGHT * 0.35 },
  Product: { x: WIDTH * 0.62, y: HEIGHT * 0.32 },
  Sales: { x: WIDTH * 0.7, y: HEIGHT * 0.7 },
  Marketing: { x: WIDTH * 0.32, y: HEIGHT * 0.7 },
  Ops: { x: WIDTH * 0.5, y: HEIGHT * 0.5 },
};

export function nodeRadius(influenceWeight: number): number {
  return 12 + influenceWeight * 16; // 12px → 28px
}

export function buildLayout(nw: Northwind): LayoutResult {
  const initialPositions = new Map<string, { x: number; y: number }>();
  const nodes: SimNode[] = nw.agents.map((a, i) => {
    const angle = (i / nw.agents.length) * Math.PI * 2;
    const r = 180;
    const x = WIDTH / 2 + r * Math.cos(angle);
    const y = HEIGHT / 2 + r * Math.sin(angle);
    initialPositions.set(a.id, { x, y });
    return {
      id: a.id,
      department: a.department,
      r: nodeRadius(a.influence_weight),
      x,
      y,
    };
  });

  const links: SimLink[] = nw.collaboration_edges.map((e) => ({
    source: e.source,
    target: e.target,
    weight: e.weight,
  }));

  const sim = forceSimulation<SimNode, SimLink>(nodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((n) => n.id)
        .distance((l) => 90 + (1 - l.weight) * 60)
        .strength((l) => 0.4 * l.weight),
    )
    .force("charge", forceManyBody<SimNode>().strength(-220))
    .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
    .force("collide", forceCollide<SimNode>().radius((n) => n.r + 4).strength(0.9))
    .force(
      "x",
      forceX<SimNode>((n) => DEPT_ANCHORS[n.department]?.x ?? WIDTH / 2).strength(0.06),
    )
    .force(
      "y",
      forceY<SimNode>((n) => DEPT_ANCHORS[n.department]?.y ?? HEIGHT / 2).strength(0.06),
    )
    .stop();

  // Pre-compute final positions deterministically.
  for (let i = 0; i < 300; i++) sim.tick();

  const positions = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    positions.set(n.id, { x: n.x ?? WIDTH / 2, y: n.y ?? HEIGHT / 2 });
  }

  return { positions, initialPositions, simulation: sim, nodes };
}

/** Cubic ease-out for the settle animation. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export const GRAPH_VIEWPORT = { width: WIDTH, height: HEIGHT };
