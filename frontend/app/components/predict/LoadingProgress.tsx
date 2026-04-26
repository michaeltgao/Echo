"use client";

import { useAppStore } from "@/lib/store";
import type { Stage } from "@/lib/types/sse";

const STAGE_LABEL: Record<Stage, string> = {
  parsing: "Reading the policy",
  enriching: "Building personas",
  scheduling: "Scheduling activity",
  acting: "Employees reacting",
  aggregating: "Computing impact",
};

export default function LoadingProgress() {
  const stage = useAppStore((s) => s.stage);
  const progress = useAppStore((s) => s.progress);
  const actions = useAppStore((s) => s.actions);

  if (!stage || stage === "done") return null;

  const label = STAGE_LABEL[stage as Stage] ?? "Working…";
  const pct =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-medium text-neutral-200">{label}</span>
        </div>
        {progress.total > 0 && (
          <span className="text-xs text-neutral-500 tabular-nums">
            {progress.completed} / {progress.total} actions
          </span>
        )}
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-neutral-500">
        {actions.length > 0
          ? `${actions.length} reactions captured so far`
          : "Waiting for first reaction…"}
      </div>
    </div>
  );
}
