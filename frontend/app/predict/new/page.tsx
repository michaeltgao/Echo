"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { runSimulation } from "@/lib/sse";
import PolicyTextarea from "@/app/components/predict/PolicyTextarea";
import LoadingProgress from "@/app/components/predict/LoadingProgress";
import OrgGraph from "@/app/components/graph/OrgGraph";
import DayTimeline from "@/app/components/graph/DayTimeline";
import FinalReport from "@/app/components/graph/FinalReport";

export default function ScenarioBuilderPage() {
  return (
    <Suspense fallback={null}>
      <ScenarioBuilderInner />
    </Suspense>
  );
}

function ScenarioBuilderInner() {
  const searchParams = useSearchParams();
  const prefill = searchParams.get("prefill");
  const version = (searchParams.get("version") as "v1" | "v2" | null) ?? "v1";

  const [policyText, setPolicyText] = useState("");
  const [running, setRunning] = useState(false);
  const autoStartedRef = useRef(false);

  const stage = useAppStore((s) => s.stage);
  const result = useAppStore((s) => s.result);
  const error = useAppStore((s) => s.simulationError);
  const setSimulationError = useAppStore((s) => s.setSimulationError);
  const resetSimulation = useAppStore((s) => s.resetSimulation);

  // The controller is set when handleRun starts a stream and cleared on
  // explicit Reset. We deliberately do NOT auto-abort on unmount: in Next
  // 16 + React 19 dev, Strict Mode's simulate-unmount-remount pattern would
  // abort the fresh fetch a few milliseconds after handleRun started it,
  // leaving the page stuck at running=true / stage=null with no events.
  // Real page navigation tears down the request naturally.
  const abortRef = useRef<AbortController | null>(null);

  // Clear stale state from a previous run on first mount. Zustand state
  // persists across navigations, so without this a user who finished a sim
  // and clicked "Try the live demo" from the landing page would land here
  // and see the prior run's done-layout instead of the compose layout.
  // Skip the reset when ?prefill is present — that's the intentional
  // hand-off from the FinalReport "Apply rewrite & rerun" CTA.
  const mountRef = useRef(false);
  useEffect(() => {
    if (mountRef.current) return;
    mountRef.current = true;
    if (!prefill) resetSimulation();
  }, [prefill, resetSimulation]);

  // Local running flag tracks the in-flight stream; cleared once stage flips
  // to "done". We deliberately DO NOT auto-navigate to /predict/[id]/results
  // anymore — the user stays here to watch the cascade play out and reads
  // the FinalReport in place. They can opt into the dashboard via a CTA.
  useEffect(() => {
    if (result && stage === "done" && running) setRunning(false);
  }, [result, stage, running]);

  // If we landed here from "Apply Recommendation", prefill the textarea.
  useEffect(() => {
    if (prefill && !autoStartedRef.current) {
      autoStartedRef.current = true;
      setPolicyText(prefill);
    }
  }, [prefill]);

  const valid = policyText.trim().length >= 10 && policyText.length <= 8000;

  const handleRun = useCallback(
    async (version: "v1" | "v2" = "v1") => {
      if (!valid || running) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);
      try {
        await runSimulation({
          policyText,
          policyVersion: version,
          signal: controller.signal,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // Explicit user-initiated abort (Reset). Return to idle cleanly.
          setRunning(false);
          return;
        }
        setSimulationError((err as Error).message);
        setRunning(false);
      }
    },
    [policyText, running, valid, setSimulationError],
  );

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    resetSimulation();
  }, [resetSimulation]);

  // After prefill applied, kick off a v2 run automatically. Separate effect
  // so handleRun's deps see the updated policyText.
  useEffect(() => {
    if (prefill && policyText === prefill && !running && version === "v2") {
      handleRun("v2");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyText, prefill]);

  // Phase drives the layout. Mirrors /graph: idle = policy + run controls
  // dominate (compose mode); running/done = graph centerpiece on the left,
  // daily ledger on the right, policy collapses to a top strip.
  const phase: "idle" | "running" | "done" =
    stage === "done" ? "done" : running ? "running" : "idle";

  return (
    <main className="relative flex flex-1 flex-col">
      {/* ───── Masthead ───── */}
      <header className="px-6 md:px-12 lg:px-16 pt-8 md:pt-10 flex items-center justify-between fade-up">
        <div className="t-eyebrow flex items-center gap-3">
          <Link href="/" className="text-amber hover:text-amber-bright transition-colors">
            Echo
          </Link>
          <span className="text-bone-dim">/</span>
          <span>№03</span>
          <span className="text-bone-dim">/</span>
          <span>New scenario</span>
        </div>
        <nav className="t-eyebrow hidden md:flex items-center gap-6">
          <Link href="/" className="hover:text-bone transition-colors">
            Overview
          </Link>
          <Link href="/graph" className="hover:text-bone transition-colors">
            Sample run
          </Link>
          <Link
            href="/predict/compare"
            className="text-bone-muted hover:text-bone transition-colors"
          >
            Compare
          </Link>
        </nav>
      </header>

      <div className="flex-1 px-6 md:px-12 lg:px-16">
        <div className="max-w-[1280px] mx-auto pb-32">
          {/* Drawn-in hairline */}
          <div className="h-px w-full bg-hairline-strong mt-8 md:mt-10 draw-in" />

          {/* ───── Hero kicker (always visible) ───── */}
          <section
            className="pt-12 md:pt-16 pb-8 md:pb-12 fade-up"
            style={{ animationDelay: "300ms" }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
              <div className="lg:col-span-9">
                <div className="t-eyebrow mb-5 flex items-center gap-4">
                  <span className="h-px w-10 bg-amber/55" />
                  <span>
                    {phase === "idle"
                      ? "Run your own scenario"
                      : phase === "running"
                        ? "Streaming · graph + ledger update per action"
                        : "Result — what your workforce did"}
                  </span>
                </div>
                <h1
                  className="font-display font-normal text-bone tracking-[-0.026em] leading-[1.0]"
                  style={{ fontSize: "clamp(36px, 6vw, 72px)" }}
                >
                  {phase === "idle" ? (
                    <>
                      Paste an announcement.
                      <br />
                      <span className="italic text-amber-bright">
                        Watch what would happen.
                      </span>
                    </>
                  ) : (
                    <>
                      A 30-day rehearsal,
                      <br />
                      <span className="italic text-amber-bright">
                        played out.
                      </span>
                    </>
                  )}
                </h1>
              </div>
              {phase === "idle" && (
                <div className="lg:col-span-3 hidden lg:flex flex-col gap-2 items-end font-mono text-[10.5px] tracking-[0.14em] uppercase text-bone-faint">
                  <span>Live run · ~140 s</span>
                  <span>
                    <span className="text-bone-dim">Cached canonical · </span>
                    <span className="text-amber/85">~200 ms</span>
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────────
              Idle: compose layout — policy textarea on the LEFT, graph
              baseline preview on the RIGHT, big amber RUN below.
              ───────────────────────────────────────────────────────────────── */}
          {phase === "idle" && (
            <section
              className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 fade-up"
              style={{ animationDelay: "550ms" }}
            >
              <div className="lg:col-span-5 flex flex-col gap-7">
                <PolicyTextarea
                  value={policyText}
                  onChange={setPolicyText}
                  disabled={running}
                />
                <div className="flex items-center gap-5 pt-1 border-t border-hairline pt-5">
                  <button
                    type="button"
                    onClick={() => handleRun("v1")}
                    disabled={!valid}
                    className="group inline-flex items-center gap-3 bg-amber text-ink px-6 py-3 rounded-[2px] font-mono text-[12px] tracking-[0.18em] uppercase font-medium hover:bg-amber-bright transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber"
                  >
                    <PlayIcon />
                    <span>Run simulation</span>
                  </button>
                  {error && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="font-mono text-[11px] tracking-[0.18em] uppercase text-bone-faint hover:text-amber transition-colors flex items-center gap-2"
                    >
                      <span aria-hidden>↺</span>
                      <span>Clear error</span>
                    </button>
                  )}
                </div>
                {error && (
                  <div className="border-l-2 border-rust bg-rust/[0.06] px-4 py-3 rounded-[2px]">
                    <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-rust mb-1">
                      Simulation failed
                    </div>
                    <div className="text-[13.5px] text-bone-muted leading-snug">
                      {error}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="t-eyebrow text-amber/85">Workforce preview</span>
                  <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-bone-faint">
                    50 stand-in employees · baseline
                  </span>
                </div>
                <OrgGraph />
                <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-bone-faint flex items-center gap-3">
                  <span className="h-px w-8 bg-amber/40" />
                  <span>Press run to begin the simulation</span>
                </p>
              </div>
            </section>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              Running / Done: graph centerpiece on the LEFT, daily ledger on
              the RIGHT, policy collapses to a top strip. FinalReport
              appears below the graph once the result lands.
              ───────────────────────────────────────────────────────────────── */}
          {(phase === "running" || phase === "done") && (
            <section className="flex flex-col gap-8 fade-up">
              {/* Compact policy strip — preserves what they pasted, with a
                  Reset to go back and edit. */}
              <PolicyStrip
                policyText={policyText}
                phase={phase}
                onReset={handleReset}
              />

              {phase === "running" && <LoadingProgress />}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
                <div className="lg:col-span-7 flex flex-col gap-6">
                  <OrgGraph />
                  {phase === "done" && <FinalReport variant="predict" />}
                </div>
                <div className="lg:col-span-5 flex flex-col min-h-0">
                  <DayTimeline />
                </div>
              </div>
            </section>
          )}

          {/* ───── Footer ───── */}
          <footer
            className="mt-20 md:mt-28 pt-7 border-t border-hairline flex flex-col md:flex-row md:items-end justify-between gap-6 fade-up"
            style={{ animationDelay: "850ms" }}
          >
            <p
              className="font-display italic text-bone-muted leading-[1.4] max-w-[420px]"
              style={{ fontSize: "clamp(15px, 1.6vw, 17px)" }}
            >
              Drafts are cheap. Watch the announcement land before you send it.
            </p>
            <p className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-bone-dim">
              Echo · early build
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}

function PolicyStrip({
  policyText,
  phase,
  onReset,
}: {
  policyText: string;
  phase: "running" | "done";
  onReset: () => void;
}) {
  // First ~140 characters as a one-line preview. Truncates with ellipsis.
  const preview = policyText.replace(/\s+/g, " ").trim().slice(0, 140);
  const truncated = policyText.length > 140;
  return (
    <aside className="border border-hairline rounded-[2px] bg-ink-elevated/40 px-5 py-4 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
      <div className="flex items-center gap-3">
        <span className="t-eyebrow text-bone-faint">Your policy</span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            phase === "running" ? "bg-amber animate-pulse" : "bg-sage"
          }`}
          aria-hidden
        />
      </div>

      <span className="hidden md:block h-6 w-px bg-hairline" aria-hidden />

      <p className="flex-1 text-bone-muted text-[13.5px] leading-snug truncate">
        {preview}
        {truncated && "…"}
      </p>

      <button
        type="button"
        onClick={onReset}
        className="font-mono text-[11px] tracking-[0.18em] uppercase text-bone-faint hover:text-amber transition-colors flex items-center gap-2 whitespace-nowrap"
      >
        <span aria-hidden>↺</span>
        <span>Edit & rerun</span>
      </button>
    </aside>
  );
}

function PlayIcon() {
  return (
    <svg
      width={11}
      height={11}
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden
    >
      <path d="M1 0.5 L9 5 L1 9.5 Z" />
    </svg>
  );
}
