"use client";

import type { SimulationResult } from "@/lib/types/simulation";

interface Props {
  result: SimulationResult;
}

type Cohort = SimulationResult["cohort_metrics"][number];

export default function HeatMap({ result }: Props) {
  const cohorts = result.cohort_metrics;
  if (!cohorts || cohorts.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
        <h2 className="text-sm font-medium text-neutral-300">Department Heat Map</h2>
        <p className="mt-2 text-sm text-neutral-500">No cohort data available.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-neutral-300">Department Heat Map</h2>
        <span className="text-xs text-neutral-500">
          {cohorts.length} cohorts · sorted worst first
        </span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 uppercase tracking-wide">
              <th className="py-2 pr-3 font-medium">Cohort</th>
              <th className="py-2 px-3 font-medium text-right">Headcount</th>
              <th className="py-2 px-3 font-medium text-right">eNPS Δ</th>
              <th className="py-2 px-3 font-medium text-right">Sent. Δ</th>
              <th className="py-2 px-3 font-medium text-right">Flight risk</th>
              <th className="py-2 pl-3 font-medium">Top concern</th>
              <th className="py-2 pl-3 font-medium">Risk</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => (
              <Row key={c.cohort_label} c={c} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({ c }: { c: Cohort }) {
  const enps = c.enps_delta;
  const sent = c.sentiment_delta;
  const enpsTone =
    enps <= -10 ? "text-rose-400" : enps < 0 ? "text-amber-400" : "text-emerald-400";
  const sentTone =
    sent <= -0.1 ? "text-rose-400" : sent < 0 ? "text-amber-400" : "text-emerald-400";
  const riskBg =
    c.risk_level === "high"
      ? "bg-rose-500/10 text-rose-300 border-rose-800/50"
      : c.risk_level === "medium"
        ? "bg-amber-500/10 text-amber-300 border-amber-800/50"
        : "bg-emerald-500/10 text-emerald-300 border-emerald-800/50";

  return (
    <tr className="border-t border-neutral-800/70">
      <td className="py-2.5 pr-3">
        <div className="font-medium text-neutral-200">{c.cohort_label}</div>
      </td>
      <td className="py-2.5 px-3 text-right text-neutral-400 tabular-nums">{c.headcount}</td>
      <td className={`py-2.5 px-3 text-right tabular-nums ${enpsTone}`}>
        {enps > 0 ? "+" : ""}
        {Math.round(enps)}
      </td>
      <td className={`py-2.5 px-3 text-right tabular-nums ${sentTone}`}>
        {sent > 0 ? "+" : ""}
        {sent.toFixed(2)}
      </td>
      <td className="py-2.5 px-3 text-right text-neutral-400 tabular-nums">
        {c.flight_risk_count ?? 0}
      </td>
      <td className="py-2.5 pl-3 text-neutral-300">{c.top_concern}</td>
      <td className="py-2.5 pl-3">
        <span
          className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${riskBg}`}
        >
          {c.risk_level}
        </span>
      </td>
    </tr>
  );
}
