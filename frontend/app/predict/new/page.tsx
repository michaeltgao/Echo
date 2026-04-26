"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { runSimulation } from "@/lib/sse";
import PolicyTextarea from "@/app/components/predict/PolicyTextarea";
import LoadingProgress from "@/app/components/predict/LoadingProgress";
import ActionFeed from "@/app/components/feed/ActionFeed";

export default function ScenarioBuilderPage() {
  return (
    <Suspense fallback={null}>
      <ScenarioBuilderInner />
    </Suspense>
  );
}

function ScenarioBuilderInner() {
  const router = useRouter();
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

  // Abort the in-flight stream on unmount or when re-running.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Once the result lands, route to the results page (scenario_id is the URL key).
  useEffect(() => {
    if (result && stage === "done" && running) {
      setRunning(false);
      router.push(`/predict/${result.scenario_id}/results`);
    }
  }, [result, stage, running, router]);

  // If we landed here from "Apply Recommendation", prefill the textarea and
  // auto-run as v2.
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
        if ((err as Error).name === "AbortError") return;
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

  // After prefill applied, kick off a v2 run automatically. Done in a separate
  // effect so handleRun's deps see the updated policyText.
  useEffect(() => {
    if (prefill && policyText === prefill && !running && version === "v2") {
      handleRun("v2");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyText, prefill]);

  const showFeed = running || stage === "done";

  return (
    <main className="flex flex-1 flex-col gap-6 px-8 py-10 max-w-6xl w-full mx-auto">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Scenario Builder</h1>
        <p className="text-sm text-neutral-400">
          Paste any HR policy. We&apos;ll simulate 50 employees reacting over 30 days
          and surface the actions, themes, and a recommended rewrite.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="flex flex-col gap-4">
          <PolicyTextarea
            value={policyText}
            onChange={setPolicyText}
            disabled={running}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleRun("v1")}
              disabled={!valid || running}
              className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-neutral-950 font-medium text-sm transition-colors"
            >
              {running ? "Running…" : "Run Simulation"}
            </button>
            {(running || stage === "done" || error) && (
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-md border border-neutral-800 hover:bg-neutral-900 text-sm text-neutral-300 transition-colors"
              >
                Reset
              </button>
            )}
            <span className="ml-auto text-xs text-neutral-500">
              First live run ~140s. Cached canonical: ~200ms.
            </span>
          </div>

          {error && (
            <div className="rounded-md border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
              <div className="font-medium">Simulation failed</div>
              <div className="mt-1 text-rose-400/80">{error}</div>
            </div>
          )}

          {(running || stage === "done") && <LoadingProgress />}
        </section>

        <section className="flex flex-col gap-3 min-h-[300px]">
          <h2 className="text-sm font-medium text-neutral-300">
            Live action feed
            {showFeed && (
              <span className="ml-2 text-xs text-neutral-500 font-normal">
                newest first
              </span>
            )}
          </h2>
          <div className="overflow-y-auto max-h-[70vh] pr-1">
            <ActionFeed />
          </div>
        </section>
      </div>
    </main>
  );
}
