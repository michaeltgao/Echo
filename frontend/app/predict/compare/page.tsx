"use client";

import Link from "next/link";
import { useAppStore } from "@/lib/store";
import HeadlineDelta from "@/app/components/compare/HeadlineDelta";
import ActionVolumeBar from "@/app/components/compare/ActionVolumeBar";
import SideStats from "@/app/components/compare/SideStats";

export default function ComparePage() {
  const v1 = useAppStore((s) => s.comparisonV1);
  const v2 = useAppStore((s) => s.result);

  if (!v1 || !v2) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-8 py-10 text-center max-w-md">
          <h1 className="text-lg font-semibold text-neutral-200">
            No comparison loaded
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Run v1, click <em>Apply Recommendation</em>, then run v2 to populate this view.
          </p>
          <Link
            href="/predict/new"
            className="mt-5 inline-block px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium text-sm"
          >
            Start a scenario →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-8 py-10 max-w-7xl w-full mx-auto">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-neutral-500 uppercase tracking-wide">
            Compare · {v1.scenario_id} → {v2.scenario_id}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            v1 vs v2 — same workforce, different policy
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/predict/${v2.scenario_id}/results`}
            className="px-3 py-2 rounded-md border border-neutral-800 hover:bg-neutral-900 text-sm text-neutral-300"
          >
            Back to v2 results
          </Link>
          <Link
            href="/predict/new"
            className="px-3 py-2 rounded-md border border-neutral-800 hover:bg-neutral-900 text-sm text-neutral-300"
          >
            New scenario
          </Link>
        </div>
      </header>

      <HeadlineDelta v1={v1} v2={v2} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SideStats result={v1} variant="v1" />
        <SideStats result={v2} variant="v2" />
      </div>

      <ActionVolumeBar v1={v1} v2={v2} />
    </main>
  );
}
