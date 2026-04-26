"use client";

import { useEffect, useMemo, useRef } from "react";
import { useAppStore } from "@/lib/store";
import ActionCard from "../feed/ActionCard";
import { ACTION_STYLE } from "@/lib/actionStyle";
import type { ActionRecord } from "@/lib/types/sse";

// Per-day timeline of actions. Days appear top-down chronologically. The
// current day is highlighted with an amber rule + label. Past days are
// dimmed slightly. Auto-scrolls so the current day is in view.
//
// Two data sources:
//   1. Replay mode (/graph or after live run completes): groups
//      `result.actions` by day, follows `currentDay` from the playback hook.
//   2. Live mode (/predict/new during SSE streaming): groups the live
//      `actions[]` array by day; "current day" is the highest day seen so
//      far, and the timeline grows as actions arrive.

export default function DayTimeline() {
  const result = useAppStore((s) => s.result);
  const liveMode = useAppStore((s) => s.liveMode);
  const liveActions = useAppStore((s) => s.actions);
  const currentDay = useAppStore((s) => s.currentDay);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const nw = useAppStore((s) => s.northwind);

  // Pick the source: prefer the final `result.actions` once it's settled
  // (gives us a complete ledger and `snapshots.length` for totalDays). If
  // we're mid-stream, use the live array.
  const sourceActions = useMemo<ActionRecord[]>(() => {
    if (result?.actions?.length) return result.actions;
    if (liveMode) return liveActions;
    return [];
  }, [result, liveMode, liveActions]);

  // Group filtered actions by day.
  const byDay = useMemo(() => {
    const map = new Map<number, ActionRecord[]>();
    for (const a of sourceActions) {
      if (!ACTION_STYLE[a.action_type].showInFeed) continue;
      const arr = map.get(a.day);
      if (arr) arr.push(a);
      else map.set(a.day, [a]);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.intra_day_order ?? 0) - (b.intra_day_order ?? 0));
    }
    return map;
  }, [sourceActions]);

  // Highest day with at least one action; used as the live "current day"
  // pointer when there's no scrub-driven currentDay yet.
  const liveMaxDay = useMemo(() => {
    let m = 0;
    for (const a of sourceActions) if (a.day > m) m = a.day;
    return m;
  }, [sourceActions]);

  // In replay mode, follow the scrubber. In live mode, follow liveMaxDay.
  const dayInt = result ? Math.floor(currentDay) : liveMaxDay;
  // Show "before play" only when truly idle — no live actions, no playback.
  const beforePlay =
    !isPlaying &&
    currentDay <= 0.001 &&
    !liveMode &&
    sourceActions.length === 0;

  const totalDays = result?.snapshots.length ?? 30;
  // Always render the full 0..totalDays-1 range. Past days hold their
  // events, future days are dimmed. In live mode, this means each new
  // action that arrives lights up the matching day card immediately —
  // without this, we'd wait for the final `result` event before rendering
  // anything, which is exactly the "all show up at the end" bug.
  const visibleDays = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => i),
    [totalDays],
  );

  const agentsById = useMemo(() => {
    const m = new Map<string, NonNullable<typeof nw>["agents"][number]>();
    if (nw) for (const a of nw.agents) m.set(a.id, a);
    return m;
  }, [nw]);

  // Auto-scroll to keep the current day in view.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const currentDayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (beforePlay) return;
    const el = currentDayRef.current;
    const sc = scrollerRef.current;
    if (!el || !sc) return;
    const elTop = el.offsetTop - sc.offsetTop;
    const elBottom = elTop + el.offsetHeight;
    const visTop = sc.scrollTop;
    const visBottom = visTop + sc.clientHeight;
    if (elTop < visTop || elBottom > visBottom) {
      sc.scrollTo({ top: Math.max(0, elTop - 24), behavior: "smooth" });
    }
  }, [dayInt, beforePlay]);

  if (beforePlay) {
    return (
      <div className="flex flex-col gap-4">
        <div className="t-eyebrow flex items-center gap-3">
          <span className="h-px w-8 bg-amber/55" />
          <span>Daily ledger</span>
        </div>
        <div className="border border-dashed border-hairline-strong rounded-[2px] bg-ink-elevated/40 px-6 py-12 flex flex-col items-center gap-3">
          <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-bone-faint flex items-center gap-3">
            <span className="h-px w-8 bg-amber/40" />
            <span>Awaiting Day 1</span>
            <span className="h-px w-8 bg-amber/40" />
          </span>
          <p className="font-display italic text-bone-muted text-[15px] leading-snug text-center max-w-[34ch]">
            Press play to watch the workforce react, day by day.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="flex items-baseline justify-between gap-4">
        <div className="t-eyebrow flex items-center gap-3">
          <span className="h-px w-8 bg-amber/55" />
          <span>Daily ledger</span>
        </div>
        <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-bone-faint">
          <span className="text-amber tabular-nums">
            Day {String(dayInt).padStart(2, "0")}
          </span>
          <span className="text-bone-dim"> / {totalDays}</span>
        </span>
      </div>

      <div
        ref={scrollerRef}
        className="overflow-y-auto pr-2 flex flex-col gap-7 min-h-0"
        style={{
          scrollbarColor: "var(--color-hairline-strong) transparent",
          scrollbarWidth: "thin",
          maxHeight: "calc(100vh - 240px)",
        }}
      >
        {visibleDays.map((d) => {
          const acts = byDay.get(d) ?? [];
          const isCurrent = d === dayInt;
          const isFuture = d > dayInt;
          const isSilent = acts.length === 0;
          return (
            <div
              key={d}
              ref={isCurrent ? currentDayRef : null}
              className={`flex flex-col gap-3 transition-opacity duration-300 ${
                isFuture ? "opacity-30" : "opacity-100"
              }`}
            >
              <DayHeader
                day={d}
                count={acts.length}
                isCurrent={isCurrent}
                isFuture={isFuture}
              />
              {isSilent ? (
                <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-bone-faint italic pl-3 border-l border-hairline">
                  {isFuture ? "—" : "Quiet day"}
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {acts.map((a) => (
                    <li key={a.id}>
                      <ActionCard action={a} agent={agentsById.get(a.agent_id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayHeader({
  day,
  count,
  isCurrent,
  isFuture,
}: {
  day: number;
  count: number;
  isCurrent: boolean;
  isFuture: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span
        className={`font-mono tabular-nums text-[12px] tracking-[0.16em] uppercase ${
          isCurrent
            ? "text-amber-bright"
            : isFuture
              ? "text-bone-dim"
              : "text-bone-faint"
        }`}
      >
        Day {String(day).padStart(2, "0")}
      </span>
      <span
        className={`flex-1 h-px ${
          isCurrent
            ? "bg-amber-bright/70"
            : isFuture
              ? "bg-hairline"
              : "bg-hairline-strong"
        }`}
      />
      {count > 0 && (
        <span
          className={`font-mono text-[10.5px] tracking-[0.14em] uppercase tabular-nums ${
            isCurrent ? "text-amber" : "text-bone-faint"
          }`}
        >
          {count} {count === 1 ? "event" : "events"}
        </span>
      )}
    </div>
  );
}
