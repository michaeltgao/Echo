"use client";

import type { SimulationResult } from "@/lib/types/simulation";

interface Props {
  result: SimulationResult;
  variant: "v1" | "v2";
}

export default function SideStats({ result, variant }: Props) {
  const baseline = result.baseline;
  const predicted = result.predicted;
  const accent =
    variant === "v1"
      ? "border-rose-900/40 bg-rose-950/10"
      : "border-emerald-900/40 bg-emerald-950/10";
  const tone = variant === "v1" ? "text-rose-300" : "text-emerald-300";

  return (
    <section className={`rounded-lg border ${accent} p-5`}>
      <div className={`text-xs font-medium uppercase tracking-wide ${tone}`}>
        {variant === "v1" ? "v1 (original)" : "v2 (revised)"}
      </div>
      <h3 className="mt-1 text-base font-semibold text-neutral-100">
        Confidence: {predicted.confidence}
      </h3>
      {result.summary && (
        <p className="mt-2 text-xs text-neutral-400 leading-relaxed line-clamp-3">
          {result.summary}
        </p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Metric
          label="eNPS"
          baseline={baseline.enps}
          predicted={predicted.enps}
          format={(n) => `${Math.round(n)}`}
        />
        <Metric
          label="Engagement"
          baseline={baseline.engagement}
          predicted={predicted.engagement}
          format={(n) => `${(n * 100).toFixed(0)}%`}
        />
        <Metric
          label="Trust"
          baseline={baseline.trust}
          predicted={predicted.trust}
          format={(n) => `${(n * 100).toFixed(0)}%`}
        />
        <Metric
          label="Intent to stay"
          baseline={baseline.intent_to_stay}
          predicted={predicted.intent_to_stay}
          format={(n) => `${(n * 100).toFixed(0)}%`}
        />
      </dl>
    </section>
  );
}

function Metric({
  label,
  baseline,
  predicted,
  format,
}: {
  label: string;
  baseline: number;
  predicted: number;
  format: (n: number) => string;
}) {
  const delta = predicted - baseline;
  const tone =
    delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-neutral-500";
  return (
    <div>
      <dt className="text-[11px] text-neutral-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 flex items-baseline gap-2">
        <span className="text-lg font-semibold text-neutral-100 tabular-nums">
          {format(predicted)}
        </span>
        <span className={`text-xs tabular-nums ${tone}`}>
          {delta > 0 ? "+" : ""}
          {label === "eNPS"
            ? Math.round(delta)
            : `${(delta * 100).toFixed(1)} pts`}
        </span>
      </dd>
    </div>
  );
}
