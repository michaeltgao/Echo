"use client";

import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import ActionCard from "../feed/ActionCard";
import { ACTION_STYLE } from "@/lib/actionStyle";
import type { ActionRecord } from "@/lib/types/sse";

const MAX_VISIBLE = 6;

// Compact log of actions whose `day <= floor(currentDay)`. Newest first.
// Fades in / out as the scrubber advances. Setup state shows a single
// hairline + caps line "Awaiting Day 1 — press play to begin".
export default function EventLog() {
  const result = useAppStore((s) => s.result);
  const currentDay = useAppStore((s) => s.currentDay);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const nw = useAppStore((s) => s.northwind);

  const dayCutoff = Math.floor(currentDay);
  const beforePlay = !isPlaying && currentDay <= 0.001;

  const visible = useMemo(() => {
    if (!result) return [] as ActionRecord[];
    const filtered = result.actions
      .filter((a) => a.day <= dayCutoff)
      .filter((a) => ACTION_STYLE[a.action_type].showInFeed)
      .sort((a, b) => b.day - a.day || b.intra_day_order - a.intra_day_order);
    return filtered.slice(0, MAX_VISIBLE);
  }, [result, dayCutoff]);

  const agentsById = useMemo(() => {
    const m = new Map<string, NonNullable<typeof nw>["agents"][number]>();
    if (nw) for (const a of nw.agents) m.set(a.id, a);
    return m;
  }, [nw]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 border-t border-hairline pt-5">
        <span className="t-eyebrow">Today's events</span>
        {visible.length > 0 && (
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-bone-faint">
            <span className="text-bone-muted">{visible.length}</span>
            <span className="text-bone-dim mx-2">·</span>
            <span>showing recent</span>
          </span>
        )}
      </div>

      {beforePlay ? (
        <EmptyState />
      ) : visible.length === 0 ? (
        <SilentState dayCutoff={dayCutoff} />
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {visible.map((a) => (
              <li key={a.id}>
                <ActionCard action={a} agent={agentsById.get(a.agent_id)} />
              </li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-bone-faint flex items-center gap-3 py-3">
      <span className="h-px w-8 bg-amber/40" />
      <span>Awaiting Day 1 — press play to begin</span>
    </div>
  );
}

function SilentState({ dayCutoff }: { dayCutoff: number }) {
  return (
    <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-bone-faint italic py-2">
      Day {dayCutoff} — quiet so far
    </div>
  );
}
