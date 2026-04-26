"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import type { SimulationResult } from "@/lib/types/simulation";

interface Props {
  result: SimulationResult;
}

export default function RecommendationCard({ result }: Props) {
  const router = useRouter();
  const setComparisonV1 = useAppStore((s) => s.setComparisonV1);
  const rec = result.recommendation;
  if (!rec) return null;
  const impact = rec.projected_impact ?? {};

  const handleApply = () => {
    // Stash the current v1 result so the compare view has it after v2 runs.
    setComparisonV1(result);
    // Navigate to /predict/new with prefill so the user can run v2.
    const text = encodeURIComponent(rec.suggested_rewrite ?? "");
    router.push(`/predict/new?prefill=${text}&version=v2`);
  };

  return (
    <section className="rounded-lg border border-emerald-800/40 bg-gradient-to-b from-emerald-950/30 to-neutral-900/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-emerald-300/90">Recommendation</h2>
          <h3 className="mt-1 text-xl font-semibold text-neutral-100">{rec.title}</h3>
          {rec.rationale && (
            <p className="mt-2 text-sm text-neutral-300 leading-relaxed max-w-3xl">
              {rec.rationale}
            </p>
          )}
        </div>
        <button
          onClick={handleApply}
          className="shrink-0 px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium text-sm transition-colors"
        >
          Apply Recommendation →
        </button>
      </div>

      {(impact.linkedin_updates_avoided != null ||
        impact.negative_action_reduction_pct != null ||
        impact.engagement_lift != null) && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {impact.linkedin_updates_avoided != null && (
            <Impact
              label="LinkedIn updates avoided"
              value={`${impact.linkedin_updates_avoided}`}
            />
          )}
          {impact.negative_action_reduction_pct != null && (
            <Impact
              label="Negative action reduction"
              value={`${Math.round(impact.negative_action_reduction_pct)}%`}
            />
          )}
          {impact.engagement_lift != null && (
            <Impact
              label="Engagement lift"
              value={`${impact.engagement_lift > 0 ? "+" : ""}${(impact.engagement_lift * 100).toFixed(1)} pts`}
            />
          )}
        </div>
      )}

      {rec.suggested_rewrite && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200 select-none">
            View suggested rewrite ▾
          </summary>
          <pre className="mt-2 whitespace-pre-wrap text-xs text-neutral-300 bg-neutral-950 border border-neutral-800 rounded-md p-3 leading-relaxed font-mono">
            {rec.suggested_rewrite}
          </pre>
        </details>
      )}
    </section>
  );
}

function Impact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-neutral-950/60 border border-neutral-800 px-3 py-2.5">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-emerald-300 tabular-nums">{value}</div>
    </div>
  );
}
