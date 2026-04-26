"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Stage } from "@/lib/types/sse";

const STAGE_LABEL: Record<Stage, string> = {
  parsing: "Reading the policy",
  enriching: "Building personas",
  scheduling: "Scheduling activity",
  acting: "Employees reacting",
  aggregating: "Computing impact",
};

const STAGE_ORDER: Stage[] = [
  "parsing",
  "enriching",
  "scheduling",
  "acting",
  "aggregating",
];

// Cold live runs can take ~3-5s before the first stage event lands. Don't
// raise the warning until well past that — most "delays" the user sees are
// Anthropic latency, not a bug.
const STUCK_THRESHOLD_MS = 30000;

export default function LoadingProgress() {
  const stage = useAppStore((s) => s.stage);
  const progress = useAppStore((s) => s.progress);
  const actions = useAppStore((s) => s.actions);
  const liveMode = useAppStore((s) => s.liveMode);

  // Stay mounted while the stream is active. Hide only after FinalReport
  // takes over.
  if (!liveMode && (!stage || stage === "done")) return null;

  const currentStage = (stage as Stage | null) ?? null;
  const stageIndex = currentStage ? STAGE_ORDER.indexOf(currentStage) : -1;
  const label = currentStage
    ? STAGE_LABEL[currentStage] ?? "Working…"
    : "Connecting to simulator…";
  const pct =
    progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

  return (
    <div className="border border-hairline-strong rounded-[2px] bg-ink-elevated px-5 py-5 flex flex-col gap-4">
      {/* Stage header */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-sage animate-pulse" />
          <div className="flex flex-col">
            <span className="t-eyebrow text-amber/80">
              {currentStage ? "Running" : "Warming up"}
            </span>
            <span
              className="font-display text-bone tracking-[-0.012em] mt-0.5"
              style={{ fontSize: 19, lineHeight: 1.15 }}
            >
              {label}
              {!currentStage && <ActiveDots />}
            </span>
          </div>
        </div>
        {progress.total > 0 && (
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase tabular-nums text-bone-faint">
            <span className="text-amber">{progress.completed}</span>
            <span className="text-bone-dim"> / </span>
            <span>{progress.total}</span>
          </span>
        )}
      </div>

      {/* Stage breadcrumb — five tick marks. While stage is null but we're
          live-streaming, show a crawling amber pulse so the UI visibly
          breathes even when the backend hasn't emitted a stage yet. */}
      <div className="grid grid-cols-5 gap-1.5 relative">
        {STAGE_ORDER.map((s, i) => {
          const done = i < stageIndex;
          const active = i === stageIndex;
          return (
            <div key={s} className="flex flex-col gap-1.5">
              <span
                className={`h-[2px] rounded-full transition-colors duration-300 ${
                  active
                    ? "bg-amber"
                    : done
                      ? "bg-amber/45"
                      : "bg-hairline-strong"
                }`}
              />
              <span
                className={`font-mono text-[9.5px] tracking-[0.16em] uppercase truncate ${
                  active
                    ? "text-amber"
                    : done
                      ? "text-bone-muted"
                      : "text-bone-dim"
                }`}
              >
                {s}
              </span>
            </div>
          );
        })}
        {!currentStage && <CrawlingPulse />}
      </div>

      {/* Action progress bar (only meaningful during 'acting') */}
      {progress.total > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="h-px w-full bg-hairline-strong overflow-hidden">
            <div
              className="h-full bg-amber transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer line — actions captured / hint copy */}
      <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-bone-faint">
        {actions.length > 0 ? (
          <>
            <span className="text-bone-muted tabular-nums">
              {actions.length}
            </span>
            <span className="text-bone-dim mx-2">·</span>
            <span>reactions captured so far</span>
          </>
        ) : (
          <ElapsedHint stage={currentStage} />
        )}
      </div>
    </div>
  );
}

// Crawling amber pulse over the breadcrumb when stage is null. Pure CSS
// keyframes — visibly alive while the SSE response is in flight.
function CrawlingPulse() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -top-[1px] left-0 h-[3px] w-[18%] rounded-full bg-amber-bright"
      style={{
        boxShadow: "0 0 8px rgba(219,160,63,0.55)",
        animation: "crawl 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    />
  );
}

// Animated trailing dots after "Connecting to simulator…"
function ActiveDots() {
  return (
    <span className="ml-1 inline-flex gap-[3px] align-baseline">
      <Dot delay={0} />
      <Dot delay={180} />
      <Dot delay={360} />
    </span>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1 w-1 rounded-full bg-amber-bright"
      style={{
        animation: "dot-blink 1.2s ease-in-out infinite",
        animationDelay: `${delay}ms`,
      }}
    />
  );
}

// Live elapsed-time hint shown when no actions have arrived yet. Drives a
// "still working — slow stages can take ~40s" message after a beat so
// users don't wonder if something's stuck.
function ElapsedHint({ stage }: { stage: Stage | null }) {
  const startRef = useRef(Date.now());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    startRef.current = Date.now();
  }, [stage]);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsedMs = Date.now() - startRef.current;
  void tick;
  if (!stage) {
    if (elapsedMs > STUCK_THRESHOLD_MS) {
      return (
        <span className="text-rust">
          Slow start — the backend may be cold or out of LLM credits
        </span>
      );
    }
    return <span>Establishing the stream…</span>;
  }
  if (stage === "enriching" && elapsedMs > 8000) {
    return <span>Building 50 personas — can take ~40s on cold runs</span>;
  }
  if (stage === "parsing" && elapsedMs > 5000) {
    return <span>Parsing the policy — usually 3–5s</span>;
  }
  return <span>Waiting for first reaction…</span>;
}
