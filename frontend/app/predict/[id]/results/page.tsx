"use client";

import Link from "next/link";
import { useAppStore } from "@/lib/store";
import PredictedPulse from "@/app/components/results/PredictedPulse";
import HeatMap from "@/app/components/results/HeatMap";
import ThemeCards from "@/app/components/results/ThemeCards";
import RecommendationCard from "@/app/components/results/RecommendationCard";
import ActionFeed from "@/app/components/feed/ActionFeed";

export default function ResultsPage() {
  const result = useAppStore((s) => s.result);
  const comparisonV1 = useAppStore((s) => s.comparisonV1);

  if (!result) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-8 py-10 text-center max-w-md">
          <h1 className="text-lg font-semibold text-neutral-200">No simulation loaded</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Direct linking to results isn&apos;t supported yet — run a fresh simulation to
            see this page.
          </p>
          <Link
            href="/predict/new"
            className="mt-5 inline-block px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium text-sm"
          >
            Run a simulation →
          </Link>
        </div>
      </main>
    );
  }

  const versionLabel = result.policy_version === "v2" ? "v2 (revised)" : "v1";
  const showCompareLink = comparisonV1 != null && result.policy_version === "v2";

  return (
    <main className="flex flex-1 flex-col gap-6 px-8 py-10 max-w-7xl w-full mx-auto">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-neutral-500 uppercase tracking-wide">
            Scenario {result.scenario_id} · Policy {versionLabel}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Simulation Results</h1>
          {result.parsed_policy?.summary && (
            <p className="mt-1 text-sm text-neutral-400 max-w-2xl">
              {result.parsed_policy.summary}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {showCompareLink && (
            <Link
              href="/predict/compare"
              className="px-3 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium text-sm"
            >
              Compare v1 vs v2 →
            </Link>
          )}
          <Link
            href="/predict/new"
            className="px-3 py-2 rounded-md border border-neutral-800 hover:bg-neutral-900 text-sm text-neutral-300"
          >
            New scenario
          </Link>
        </div>
      </header>

      <PredictedPulse result={result} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <HeatMap result={result} />
          <ThemeCards result={result} />
          <RecommendationCard result={result} />
        </div>
        <aside className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-neutral-300">Action Feed</h2>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Every reaction recorded during the 30-day simulation. Quotes in the theme
            cards link back to these actions.
          </p>
          <div className="overflow-y-auto max-h-[80vh] pr-1">
            <ActionFeed />
          </div>
        </aside>
      </div>

      {result.fallback_used && (
        <div className="rounded-md border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-xs text-amber-300">
          Some agents fell back to heuristic responses (LLM hiccup). Numbers should still
          be directionally right but treat with grain of salt.
        </div>
      )}
    </main>
  );
}
