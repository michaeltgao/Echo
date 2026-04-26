"use client";

import { useAppStore } from "@/lib/store";

export default function NorthwindStatus() {
  const status = useAppStore((s) => s.northwindStatus);
  const error = useAppStore((s) => s.northwindError);
  const nw = useAppStore((s) => s.northwind);

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span
          className={
            status === "ready"
              ? "h-2 w-2 rounded-full bg-emerald-400"
              : status === "loading"
                ? "h-2 w-2 rounded-full bg-amber-400 animate-pulse"
                : status === "error"
                  ? "h-2 w-2 rounded-full bg-rose-500"
                  : "h-2 w-2 rounded-full bg-neutral-600"
          }
        />
        <span className="font-medium">/northwind</span>
        <span className="text-neutral-500">— {status}</span>
      </div>
      {nw && (
        <div className="mt-1 text-neutral-500">
          {nw.agents.length} agents · {nw.collaboration_edges.length} collab edges ·{" "}
          {nw.departments.length} departments
        </div>
      )}
      {error && <div className="mt-1 text-rose-400">{error}</div>}
    </div>
  );
}
