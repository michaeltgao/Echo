"use client";

import { motion } from "framer-motion";
import type { SimulationResult } from "@/lib/types/simulation";

interface Props {
  v1: SimulationResult;
  v2: SimulationResult;
}

export default function HeadlineDelta({ v1, v2 }: Props) {
  const v1Linkedin = v1.action_volume_summary?.UPDATE_LINKEDIN ?? 0;
  const v2Linkedin = v2.action_volume_summary?.UPDATE_LINKEDIN ?? 0;

  const v1Enps = v1.predicted.enps - v1.baseline.enps;
  const v2Enps = v2.predicted.enps - v2.baseline.enps;
  const enpsImprovement = v2Enps - v1Enps;

  return (
    <section className="rounded-lg border border-emerald-800/40 bg-gradient-to-br from-emerald-950/40 via-neutral-900 to-neutral-900 p-6">
      <div className="flex items-center justify-center gap-6 sm:gap-10 flex-wrap">
        <BigStat label="LinkedIn updates" v1={v1Linkedin} v2={v2Linkedin} suffix="" />
        <Arrow />
        <BigStat
          label="eNPS delta"
          v1={v1Enps}
          v2={v2Enps}
          suffix=""
          format={(n) => `${n > 0 ? "+" : ""}${Math.round(n)}`}
        />
      </div>
      <div className="mt-4 text-center text-sm text-neutral-300">
        v2 is{" "}
        <span className="text-emerald-300 font-semibold tabular-nums">
          {enpsImprovement > 0 ? "+" : ""}
          {Math.round(enpsImprovement)} eNPS
        </span>{" "}
        better and avoids{" "}
        <span className="text-emerald-300 font-semibold tabular-nums">
          {Math.max(0, v1Linkedin - v2Linkedin)}
        </span>{" "}
        LinkedIn updates.
      </div>
    </section>
  );
}

function BigStat({
  label,
  v1,
  v2,
  format = (n) => String(Math.round(n)),
}: {
  label: string;
  v1: number;
  v2: number;
  suffix?: string;
  format?: (n: number) => string;
}) {
  return (
    <div className="text-center">
      <div className="text-xs text-neutral-500 uppercase tracking-wide">{label}</div>
      <div className="mt-2 flex items-baseline gap-3 sm:gap-4">
        <motion.span
          key={`v1-${v1}`}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-3xl sm:text-4xl font-semibold text-rose-300 tabular-nums"
        >
          {format(v1)}
        </motion.span>
        <span className="text-neutral-600">→</span>
        <motion.span
          key={`v2-${v2}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-3xl sm:text-4xl font-semibold text-emerald-300 tabular-nums"
        >
          {format(v2)}
        </motion.span>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
      className="hidden sm:flex items-center text-emerald-400 text-3xl origin-left"
      aria-hidden
    >
      ⟶
    </motion.div>
  );
}
