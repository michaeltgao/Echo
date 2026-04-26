"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

interface Props {
  // "graph" — canonical sample-run page, CTA toggles v1 ↔ v2
  // "predict" — scenario builder, CTA applies recommendation + links to dashboard
  variant?: "graph" | "predict";
}

// Renders once playback hits the last day. The summary readout the user
// expects: predicted eNPS delta, top concerns, top-line recommendation.
// Visually announces "this is what your sample workforce did."
export default function FinalReport({ variant = "graph" }: Props) {
  const result = useAppStore((s) => s.result);
  const activeVersion = useAppStore((s) => s.activeVersion);
  const setActiveVersion = useAppStore((s) => s.setActiveVersion);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const otherLoaded = useAppStore((s) =>
    activeVersion === "v1" ? !!s.resultV2 : !!s.resultV1,
  );
  const router = useRouter();

  const switchAndPlay = useCallback(() => {
    setActiveVersion(activeVersion === "v1" ? "v2" : "v1");
    requestAnimationFrame(() => setIsPlaying(true));
  }, [activeVersion, setActiveVersion, setIsPlaying]);

  const applyRecommendation = useCallback(() => {
    const rewrite = result?.recommendation?.suggested_rewrite;
    if (!rewrite) return;
    const params = new URLSearchParams({ prefill: rewrite, version: "v2" });
    router.push(`/predict/new?${params.toString()}`);
  }, [result, router]);

  if (!result) return null;

  const baseline = result.baseline?.enps ?? 0;
  const predicted = result.predicted?.enps ?? 0;
  const delta = predicted - baseline;
  const themes = result.themes ?? [];
  const linkedinCount = result.action_volume_summary?.UPDATE_LINKEDIN ?? 0;
  const recommendation = result.recommendation;

  const isPositive = delta > 0;
  const isFlat = Math.abs(delta) < 2;

  return (
    <section className="flex flex-col gap-5 border border-amber/40 rounded-[2px] bg-amber/[0.04] p-6 md:p-7">
      <div className="t-eyebrow text-amber-bright flex items-center gap-3">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-bright" />
        <span>Final reading</span>
      </div>

      {/* eNPS hero */}
      <div className="flex items-baseline gap-5 flex-wrap">
        <div
          className="font-display font-normal text-bone tracking-[-0.025em] leading-[1]"
          style={{ fontSize: "clamp(40px, 5.2vw, 64px)" }}
        >
          {delta > 0 ? "+" : ""}
          {delta}
        </div>
        <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-bone-faint flex flex-col gap-1">
          <span>eNPS shift</span>
          <span className="tabular-nums text-bone-muted">
            {baseline > 0 ? "+" : ""}
            {baseline}
            <span className="text-bone-dim mx-1.5">→</span>
            {predicted > 0 ? "+" : ""}
            {predicted}
          </span>
        </div>
        <div className="ml-auto font-mono text-[11px] tracking-[0.14em] uppercase">
          <span className="text-bone-faint">Flight risk · </span>
          <span className="text-rust tabular-nums">
            {linkedinCount} LinkedIn updates
          </span>
        </div>
      </div>

      {/* Verdict copy */}
      <p
        className={`font-display italic leading-[1.45] ${
          isPositive ? "text-sage" : isFlat ? "text-bone-muted" : "text-bone"
        }`}
        style={{ fontSize: "clamp(16px, 1.7vw, 19px)" }}
      >
        {result.summary ??
          (isPositive
            ? "Sentiment improved across the workforce."
            : isFlat
              ? "Workforce sentiment held roughly steady."
              : "The workforce reacted negatively. Top concerns surfaced below.")}
      </p>

      {/* Top concerns */}
      {themes.length > 0 && (
        <div className="border-t border-amber/25 pt-5 flex flex-col gap-3">
          <span className="t-eyebrow">Top concerns</span>
          <ul className="flex flex-col gap-2.5">
            {themes.slice(0, 3).map((t, i) => (
              <li key={t.label} className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] tabular-nums text-amber/70 tracking-[0.15em]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-bone tracking-[-0.012em] text-[16px] leading-snug">
                  {t.label}
                </span>
                <span className="ml-auto font-mono text-[10.5px] tracking-[0.14em] uppercase text-bone-faint tabular-nums whitespace-nowrap">
                  {t.volume} {t.volume === 1 ? "voice" : "voices"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation peek */}
      {recommendation?.title && (
        <div className="border-t border-amber/25 pt-5 flex flex-col gap-2">
          <span className="t-eyebrow text-amber/85">Recommendation</span>
          <p className="font-display text-bone tracking-[-0.012em] leading-[1.3] text-[17px]">
            {recommendation.title}
          </p>
          {recommendation.rationale && (
            <p className="text-bone-muted text-[14px] leading-[1.55] max-w-[58ch]">
              {recommendation.rationale}
            </p>
          )}
        </div>
      )}

      {/* Variant-specific call-to-action footer */}
      {variant === "graph" ? (
        <div className="border-t border-amber/25 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p
            className="font-display italic text-bone-muted leading-[1.4] max-w-[44ch]"
            style={{ fontSize: 15 }}
          >
            {activeVersion === "v1"
              ? "Now watch the rewrite — same workforce, conciliatory tone, guaranteed exceptions."
              : "Replay the firm draft to compare. Same workforce, harder landing."}
          </p>
          <button
            type="button"
            onClick={switchAndPlay}
            disabled={!otherLoaded}
            className="group inline-flex items-center gap-3 self-start sm:self-auto bg-amber text-ink px-6 py-3 rounded-[2px] font-mono text-[12px] tracking-[0.18em] uppercase font-medium hover:bg-amber-bright transition-colors disabled:opacity-40 disabled:cursor-wait whitespace-nowrap"
          >
            <PlayIcon />
            <span>
              {activeVersion === "v1"
                ? "Play the rewrite (v2)"
                : "Replay the firm draft (v1)"}
            </span>
          </button>
        </div>
      ) : (
        <div className="border-t border-amber/25 pt-5 flex flex-col gap-4">
          <p
            className="font-display italic text-bone-muted leading-[1.4] max-w-[52ch]"
            style={{ fontSize: 15 }}
          >
            {recommendation?.suggested_rewrite
              ? "Watch the same workforce react to the rewrite."
              : "Open the full dashboard for cohort heat maps, all themes, and quotes."}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 flex-wrap">
            {recommendation?.suggested_rewrite && (
              <button
                type="button"
                onClick={applyRecommendation}
                className="group inline-flex items-center gap-3 self-start bg-amber text-ink px-6 py-3 rounded-[2px] font-mono text-[12px] tracking-[0.18em] uppercase font-medium hover:bg-amber-bright transition-colors whitespace-nowrap"
              >
                <PlayIcon />
                <span>Apply rewrite & rerun</span>
              </button>
            )}
            <Link
              href={`/predict/${result.scenario_id}/results`}
              className="group inline-flex items-center gap-2.5 self-start font-mono text-[11.5px] tracking-[0.18em] uppercase text-bone-muted hover:text-amber transition-colors"
            >
              <span className="underline decoration-amber/40 underline-offset-[6px] group-hover:decoration-amber-bright">
                View full dashboard
              </span>
              <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

function PlayIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <path d="M1 0.5 L9 5 L1 9.5 Z" />
    </svg>
  );
}
