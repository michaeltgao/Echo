"use client";

import { useAppStore } from "@/lib/store";

// System readout, not a card. Mono, tracking-wide, sits in any layout
// without imposing its own border or chrome.
export default function NorthwindStatus() {
  const status = useAppStore((s) => s.northwindStatus);
  const error = useAppStore((s) => s.northwindError);
  const nw = useAppStore((s) => s.northwind);

  const dotClass =
    status === "ready"
      ? "bg-sage"
      : status === "loading"
        ? "bg-amber animate-pulse"
        : status === "error"
          ? "bg-rust"
          : "bg-bone-dim";

  return (
    <div className="font-mono text-[11.5px] tracking-[0.12em] uppercase text-bone-faint flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="flex items-center gap-2.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
        <span className="text-bone-muted">Northwind</span>
        <span className="text-bone-dim">/</span>
        <span>{status}</span>
      </span>

      {nw && (
        <>
          <span className="text-bone-dim">·</span>
          <span>
            <span className="t-mono-tight text-bone-muted normal-case tracking-normal">
              {nw.agents.length}
            </span>{" "}
            agents
          </span>
          <span className="text-bone-dim">·</span>
          <span>
            <span className="t-mono-tight text-bone-muted normal-case tracking-normal">
              {nw.collaboration_edges.length}
            </span>{" "}
            ties
          </span>
          <span className="text-bone-dim">·</span>
          <span>
            <span className="t-mono-tight text-bone-muted normal-case tracking-normal">
              {nw.departments.length}
            </span>{" "}
            depts
          </span>
        </>
      )}

      {error && (
        <>
          <span className="text-bone-dim">·</span>
          <span className="text-rust normal-case tracking-normal">{error}</span>
        </>
      )}
    </div>
  );
}
