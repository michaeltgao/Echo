"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import NorthwindStatus from "../components/NorthwindStatus";
import OrgGraph from "../components/graph/OrgGraph";
import PolicyMemo from "../components/graph/PolicyMemo";
import PlaybackControls from "../components/graph/PlaybackControls";
import DayTimeline from "../components/graph/DayTimeline";
import FinalReport from "../components/graph/FinalReport";
import { useAppStore } from "@/lib/store";
import { CANONICAL_POLICIES, postSimulate } from "@/lib/api";

// /graph — the "Watch a sample play out" surface. Composition:
//
//   ┌─ Masthead (echo / №02 / Sample run)
//   ├─ Hairline draw-in
//   ├─ Hero kicker
//   ├─ Two columns:
//   │    LEFT  (5/12)  PolicyMemo (sticky)
//   │    RIGHT (7/12)  PlaybackControls + OrgGraph + DayTimeline
//   ├─ System readout
//   └─ Footer
//
// On mount, we fire two parallel /simulate calls (RTO v1 + RTO v2). Backend
// has both cached so they return ~200ms. Once both land, the v1/v2 toggle is
// instant. We never auto-play — the user clicks PLAY to start the simulation.

export default function GraphPage() {
  const setVersionResult = useAppStore((s) => s.setVersionResult);
  const setActiveVersion = useAppStore((s) => s.setActiveVersion);
  const resultV1 = useAppStore((s) => s.resultV1);
  const resultV2 = useAppStore((s) => s.resultV2);

  const [errorV1, setErrorV1] = useState<string | null>(null);
  const [errorV2, setErrorV2] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Phase drives the layout swap. "setup" = before first play (policy on
  // left, graph on right). "playing" / "settled" = after the user has
  // pressed play (graph on left, daily ledger on right, policy collapses
  // into a top strip).
  const isPlaying = useAppStore((s) => s.isPlaying);
  const currentDay = useAppStore((s) => s.currentDay);
  const totalDays = useAppStore((s) => s.result?.snapshots.length ?? 30);
  const lastDay = Math.max(0, totalDays - 1);
  const atStart = currentDay <= 0.001 && !isPlaying;
  const atEnd = currentDay >= lastDay - 0.001 && !isPlaying;
  const phase: "setup" | "playing" | "settled" = atStart
    ? "setup"
    : atEnd
      ? "settled"
      : "playing";

  // Pre-fetch BOTH canonical policies in parallel. Same gating-ref pattern
  // as NorthwindLoader — runs once, ignores re-renders.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Default the active version to v1 immediately so the memo can render
    // even before the sim arrives.
    setActiveVersion("v1");

    void postSimulate({
      policy_text: CANONICAL_POLICIES.rto_v1,
      policy_version: "v1",
    })
      .then((r) => setVersionResult("v1", r))
      .catch((e: unknown) => setErrorV1((e as Error).message));

    void postSimulate({
      policy_text: CANONICAL_POLICIES.rto_v2,
      policy_version: "v2",
    })
      .then((r) => setVersionResult("v2", r))
      .catch((e: unknown) => setErrorV2((e as Error).message));
  }, [setVersionResult, setActiveVersion]);

  const v1Loaded = resultV1 !== null;
  const v2Loaded = resultV2 !== null;

  return (
    <main className="relative flex flex-1 flex-col">
      {/* ───── Masthead ───── */}
      <header className="px-6 md:px-12 lg:px-16 pt-8 md:pt-10 flex items-center justify-between fade-up">
        <div className="t-eyebrow flex items-center gap-3">
          <Link href="/" className="text-amber hover:text-amber-bright transition-colors">
            Echo
          </Link>
          <span className="text-bone-dim">/</span>
          <span>№02</span>
          <span className="text-bone-dim">/</span>
          <span>Sample run</span>
        </div>
        <nav className="t-eyebrow hidden md:flex items-center gap-6">
          <Link href="/" className="hover:text-bone transition-colors">
            Overview
          </Link>
          <Link href="/predict/new" className="hover:text-bone transition-colors">
            Try your own
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
          {/* Drawn-in hairline — wind tunnel motif */}
          <div className="h-px w-full bg-hairline-strong mt-8 md:mt-10 draw-in" />

          {/* ───── Hero kicker ───── */}
          <section
            className="pt-12 md:pt-16 pb-10 md:pb-14 fade-up"
            style={{ animationDelay: "300ms" }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
              <div className="lg:col-span-9">
                <div className="t-eyebrow mb-5 flex items-center gap-4">
                  <span className="h-px w-10 bg-amber/55" />
                  <span>Watch a sample play out</span>
                </div>
                <h1
                  className="font-display font-normal text-bone tracking-[-0.026em] leading-[1.0]"
                  style={{ fontSize: "clamp(36px, 6vw, 72px)" }}
                >
                  A return-to-office mandate,
                  <br />
                  <span className="italic text-amber-bright">replayed in 30 days.</span>
                </h1>
                <p className="mt-7 max-w-[620px] text-bone-muted text-[16px] md:text-[17px] leading-[1.65]">
                  This is a real announcement and a stand-in workforce. Press play and
                  watch your fake employees argue, post in channels, ask their manager
                  for a way out, go quiet, and start applying elsewhere. Switch between
                  the firm version (v1) and the recommended rewrite (v2) to see the
                  difference.
                </p>
              </div>
              <div className="lg:col-span-3 hidden lg:flex flex-col gap-2 items-end font-mono text-[11px] tracking-[0.12em] uppercase text-bone-faint">
                <div className="flex items-center gap-2">
                  <Dot ok={v1Loaded} loading={!v1Loaded && !errorV1} fail={!!errorV1} />
                  <span>v1 sample</span>
                  <span className="text-bone-dim">·</span>
                  <span className={v1Loaded ? "text-bone-muted" : "text-bone-dim"}>
                    {v1Loaded ? "ready" : errorV1 ? "error" : "loading"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Dot ok={v2Loaded} loading={!v2Loaded && !errorV2} fail={!!errorV2} />
                  <span>v2 sample</span>
                  <span className="text-bone-dim">·</span>
                  <span className={v2Loaded ? "text-bone-muted" : "text-bone-dim"}>
                    {v2Loaded ? "ready" : errorV2 ? "error" : "loading"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ───── Workspace — layout swaps once user presses Play ───── */}
          {phase === "setup" ? (
            // Setup state: read the policy on the left, see the workforce at
            // baseline on the right. PLAY is the centerpiece.
            <section
              className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 fade-up"
              style={{ animationDelay: "600ms" }}
            >
              <div className="lg:col-span-5">
                <PolicyMemo v1Loaded={v1Loaded} v2Loaded={v2Loaded} />
              </div>
              <div className="lg:col-span-7 flex flex-col gap-7">
                <PlaybackControls />
                <OrgGraph />
              </div>
            </section>
          ) : (
            // Playing / settled: graph leads on the left, daily ledger of
            // events on the right. Policy collapses into a thin strip.
            <section className="flex flex-col gap-8 fade-up">
              <PolicyMemo v1Loaded={v1Loaded} v2Loaded={v2Loaded} compact />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
                <div className="lg:col-span-7 flex flex-col gap-6">
                  <PlaybackControls />
                  <OrgGraph />
                  {phase === "settled" && <FinalReport />}
                </div>

                <div className="lg:col-span-5 flex flex-col min-h-0">
                  <DayTimeline />
                </div>
              </div>
            </section>
          )}

          {/* ───── System readout ───── */}
          <section
            className="mt-20 md:mt-24 pt-8 border-t border-hairline fade-up"
            style={{ animationDelay: "900ms" }}
          >
            <div className="t-eyebrow mb-4 flex items-center gap-4">
              <span className="h-px w-10 bg-amber/55" />
              <span>System</span>
            </div>
            <NorthwindStatus />
          </section>

          {/* ───── Footer ───── */}
          <footer
            className="mt-12 md:mt-16 pt-7 border-t border-hairline flex flex-col md:flex-row md:items-end justify-between gap-6 fade-up"
            style={{ animationDelay: "1100ms" }}
          >
            <p
              className="font-display italic text-bone-muted leading-[1.4] max-w-[420px]"
              style={{ fontSize: "clamp(15px, 1.6vw, 17px)" }}
            >
              The same workforce, two announcements. Watch the cascade — then watch
              the calm.
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

function Dot({
  ok,
  loading,
  fail,
}: {
  ok: boolean;
  loading: boolean;
  fail: boolean;
}) {
  const cls = fail
    ? "bg-rust"
    : ok
      ? "bg-sage"
      : loading
        ? "bg-amber animate-pulse"
        : "bg-bone-dim";
  return <span className={`h-1.5 w-1.5 rounded-full ${cls}`} aria-hidden />;
}
