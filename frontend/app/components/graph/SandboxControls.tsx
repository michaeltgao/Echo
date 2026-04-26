"use client";

import { useState } from "react";
import { CANONICAL_POLICIES, postSimulate } from "@/lib/api";
import { useAppStore } from "@/lib/store";

// Dev-only controls on the /graph sandbox: load a real cached simulation
// from the backend, then play / pause / restart the timeline.
//
// Replaced in production by the SSE consumer P3 wires up (Task 24).
export default function SandboxControls() {
  const setResult = useAppStore((s) => s.setResult);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setCurrentDay = useAppStore((s) => s.setCurrentDay);
  const result = useAppStore((s) => s.result);
  const day = useAppStore((s) => s.currentDay);
  const totalDays = result?.snapshots?.length ?? 0;

  const [loading, setLoading] = useState<null | "v1" | "v2">(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCanonical(version: "v1" | "v2") {
    setLoading(version);
    setError(null);
    try {
      const text = version === "v1" ? CANONICAL_POLICIES.rto_v1 : CANONICAL_POLICIES.rto_v2;
      const r = await postSimulate({ policy_text: text, policy_version: version });
      setResult(r);
      setCurrentDay(0);
      setIsPlaying(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  function restart() {
    setCurrentDay(0);
    setIsPlaying(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm">
      <button
        onClick={() => loadCanonical("v1")}
        disabled={loading !== null}
        className="rounded border border-neutral-700 px-3 py-1.5 hover:border-neutral-500 hover:bg-neutral-800 disabled:opacity-50"
      >
        {loading === "v1" ? "Loading…" : "Load RTO v1"}
      </button>
      <button
        onClick={() => loadCanonical("v2")}
        disabled={loading !== null}
        className="rounded border border-neutral-700 px-3 py-1.5 hover:border-neutral-500 hover:bg-neutral-800 disabled:opacity-50"
      >
        {loading === "v2" ? "Loading…" : "Load RTO v2"}
      </button>

      <span className="mx-2 h-4 w-px bg-neutral-800" />

      <button
        onClick={() => setIsPlaying(!isPlaying)}
        disabled={!result}
        className="rounded border border-neutral-700 px-3 py-1.5 hover:border-neutral-500 hover:bg-neutral-800 disabled:opacity-40"
      >
        {isPlaying ? "Pause" : "Play"}
      </button>
      <button
        onClick={restart}
        disabled={!result}
        className="rounded border border-neutral-700 px-3 py-1.5 hover:border-neutral-500 hover:bg-neutral-800 disabled:opacity-40"
      >
        Restart
      </button>

      <span className="ml-auto text-neutral-400 tabular-nums">
        {result
          ? `Day ${Math.floor(day) + 1} / ${totalDays}`
          : "No simulation loaded"}
      </span>

      {result?.predicted && result?.baseline && (
        <span className="ml-2 text-neutral-500 tabular-nums">
          eNPS {result.baseline.enps} → {result.predicted.enps} (
          {(result.predicted.enps - result.baseline.enps >= 0 ? "+" : "")}
          {result.predicted.enps - result.baseline.enps})
        </span>
      )}

      {error && <span className="basis-full text-rose-400">{error}</span>}
    </div>
  );
}
