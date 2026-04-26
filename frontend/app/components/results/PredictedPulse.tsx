"use client";

import type { SimulationResult } from "@/lib/types/simulation";

interface Props {
  result: SimulationResult;
}

export default function PredictedPulse({ result }: Props) {
  const baseline = result.baseline;
  const predicted = result.predicted;
  const fallback = result.fallback_used;

  const enpsDelta = predicted.enps - baseline.enps;
  const engDelta = predicted.engagement - baseline.engagement;
  const trustDelta = predicted.trust - baseline.trust;
  const stayDelta = predicted.intent_to_stay - baseline.intent_to_stay;

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-neutral-300">Predicted Pulse</h2>
          {result.summary && (
            <p className="mt-1 text-sm text-neutral-200 leading-relaxed max-w-2xl">
              {result.summary}
            </p>
          )}
        </div>
        <ConfidenceBadge level={predicted.confidence} fallback={fallback} />
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat
          label="eNPS"
          baseline={baseline.enps}
          predicted={predicted.enps}
          delta={enpsDelta}
          format={(n) => `${n > 0 ? "+" : ""}${Math.round(n)}`}
        />
        <Stat
          label="Engagement"
          baseline={baseline.engagement}
          predicted={predicted.engagement}
          delta={engDelta}
          format={(n) => `${(n * 100).toFixed(0)}%`}
          deltaFormat={(n) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)} pts`}
        />
        <Stat
          label="Trust"
          baseline={baseline.trust}
          predicted={predicted.trust}
          delta={trustDelta}
          format={(n) => `${(n * 100).toFixed(0)}%`}
          deltaFormat={(n) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)} pts`}
        />
        <Stat
          label="Intent to stay"
          baseline={baseline.intent_to_stay}
          predicted={predicted.intent_to_stay}
          delta={stayDelta}
          format={(n) => `${(n * 100).toFixed(0)}%`}
          deltaFormat={(n) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)} pts`}
        />
      </div>
    </section>
  );
}

interface StatProps {
  label: string;
  baseline: number;
  predicted: number;
  delta: number;
  format: (n: number) => string;
  deltaFormat?: (n: number) => string;
}

function Stat({ label, baseline, predicted, delta, format, deltaFormat }: StatProps) {
  const positive = delta > 0;
  const negative = delta < 0;
  const fmtDelta = deltaFormat ?? ((n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}`);

  return (
    <div>
      <div className="text-xs text-neutral-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-neutral-100 tabular-nums">
          {format(predicted)}
        </span>
        <span
          className={`text-xs tabular-nums ${
            positive ? "text-emerald-400" : negative ? "text-rose-400" : "text-neutral-500"
          }`}
        >
          {fmtDelta(delta)}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-neutral-600">from {format(baseline)}</div>
    </div>
  );
}

function ConfidenceBadge({
  level,
  fallback,
}: {
  level: "high" | "medium" | "low";
  fallback?: boolean;
}) {
  const tone =
    level === "high"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-700/40"
      : level === "medium"
        ? "bg-amber-500/10 text-amber-300 border-amber-700/40"
        : "bg-rose-500/10 text-rose-300 border-rose-700/40";
  return (
    <div
      className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      Confidence: {level}
      {fallback && <span className="ml-1.5 opacity-70">(fallback used)</span>}
    </div>
  );
}
