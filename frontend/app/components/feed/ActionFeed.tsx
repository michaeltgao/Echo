"use client";

import { useMemo, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { ACTION_STYLE } from "@/lib/actionStyle";
import type { ActionRecord } from "@/lib/types/sse";
import type { NorthwindAgent } from "@/lib/types/northwind";
import ActionCard from "./ActionCard";

interface Props {
  // Optional callback fired when a card is clicked. Default scrubs the graph
  // timeline to that action's day via the shared store. Override for custom
  // behavior.
  onActionClick?: (a: ActionRecord) => void;
  className?: string;
}

export default function ActionFeed({ onActionClick, className = "" }: Props) {
  const actions = useAppStore((s) => s.actions);
  const northwind = useAppStore((s) => s.northwind);
  const setCurrentDay = useAppStore((s) => s.setCurrentDay);

  const handleClick = useCallback(
    (a: ActionRecord) => {
      if (onActionClick) onActionClick(a);
      else setCurrentDay(a.day);
    },
    [onActionClick, setCurrentDay],
  );

  const agentsById = useMemo(() => {
    const m = new Map<string, NorthwindAgent>();
    northwind?.agents.forEach((a) => m.set(a.id, a));
    return m;
  }, [northwind]);

  // Newest first, skip DO_NOTHING for noise reduction.
  const visible = useMemo(
    () => [...actions].filter((a) => ACTION_STYLE[a.action_type].showInFeed).reverse(),
    [actions],
  );

  if (visible.length === 0) {
    return (
      <div
        className={`rounded-lg border border-dashed border-neutral-800 bg-neutral-950 px-6 py-10 text-center text-sm text-neutral-500 ${className}`}
      >
        Feed is quiet. Run a simulation to see employees react.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <AnimatePresence initial={false}>
        {visible.map((a) => (
          <ActionCard
            key={a.id}
            action={a}
            agent={agentsById.get(a.agent_id)}
            onClick={handleClick}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
