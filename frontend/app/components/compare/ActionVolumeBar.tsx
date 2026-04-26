"use client";

import { ACTION_STYLE } from "@/lib/actionStyle";
import type { ActionType } from "@/lib/types/sse";
import type { SimulationResult } from "@/lib/types/simulation";

interface Props {
  v1: SimulationResult;
  v2: SimulationResult;
}

// Order matters — negative actions on the left, positive on the right.
const ORDER: ActionType[] = [
  "GO_QUIET",
  "UPDATE_LINKEDIN",
  "VENT_TO_PEER",
  "POST_IN_CHANNEL",
  "MESSAGE_MANAGER",
  "REQUEST_EXCEPTION",
  "ADVOCATE",
];

const COLOR_HEX: Record<ActionType, string> = {
  GO_QUIET: "#737373",
  UPDATE_LINKEDIN: "#a855f7",
  VENT_TO_PEER: "#f97316",
  POST_IN_CHANNEL: "#ef4444",
  MESSAGE_MANAGER: "#3b82f6",
  REQUEST_EXCEPTION: "#eab308",
  ADVOCATE: "#10b981",
  DO_NOTHING: "#3f3f46",
};

export default function ActionVolumeBar({ v1, v2 }: Props) {
  const v1Vol = v1.action_volume_summary ?? {};
  const v2Vol = v2.action_volume_summary ?? {};
  const max = Math.max(
    sum(v1Vol),
    sum(v2Vol),
    1,
  );

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
      <h2 className="text-sm font-medium text-neutral-300 mb-4">Action volume</h2>
      <div className="flex flex-col gap-5">
        <Row label="v1" volumes={v1Vol} max={max} />
        <Row label="v2" volumes={v2Vol} max={max} />
      </div>
      <Legend />
    </section>
  );
}

function Row({
  label,
  volumes,
  max,
}: {
  label: string;
  volumes: Partial<Record<ActionType, number>> & Record<string, unknown>;
  max: number;
}) {
  const total = sum(volumes);
  const widthPct = (total / max) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
        <span className="font-medium text-neutral-200">{label}</span>
        <span className="tabular-nums">{total} actions</span>
      </div>
      <div
        className="flex h-7 rounded overflow-hidden bg-neutral-950 ring-1 ring-neutral-800"
        style={{ width: `${widthPct}%`, minWidth: total > 0 ? "8%" : "0" }}
      >
        {ORDER.map((t) => {
          const c = (volumes[t] as number | undefined) ?? 0;
          if (c === 0) return null;
          const pct = (c / total) * 100;
          return (
            <div
              key={t}
              title={`${ACTION_STYLE[t].label}: ${c}`}
              className="h-full grid place-items-center text-[10px] font-medium text-neutral-950"
              style={{ width: `${pct}%`, backgroundColor: COLOR_HEX[t] }}
            >
              {pct > 8 ? c : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-neutral-400">
      {ORDER.map((t) => (
        <div key={t} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: COLOR_HEX[t] }}
          />
          {ACTION_STYLE[t].label}
        </div>
      ))}
    </div>
  );
}

function sum(v: Record<string, unknown>): number {
  let s = 0;
  for (const k of Object.keys(v)) {
    const n = v[k];
    if (typeof n === "number") s += n;
  }
  return s;
}
