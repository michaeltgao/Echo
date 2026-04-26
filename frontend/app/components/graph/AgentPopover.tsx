"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";

// Cursor-following popover with editorial styling: ink-elevated surface,
// hairline border, bone text, sage motivators / rust sensitivities.
export default function AgentPopover() {
  const hoveredId = useAppStore((s) => s.hoveredAgentId);
  const pos = useAppStore((s) => s.hoverPos);
  const nw = useAppStore((s) => s.northwind);

  const agent = hoveredId && nw ? nw.agents.find((a) => a.id === hoveredId) : null;
  const manager =
    agent && agent.manager_id && nw
      ? nw.agents.find((a) => a.id === agent.manager_id)?.name
      : null;

  // Optional field that may be present once P1 exposes enriched personas.
  const scenarioCtx =
    agent && (agent as unknown as { scenario_specific_context?: string })
      .scenario_specific_context;

  return (
    <AnimatePresence>
      {agent && pos && (
        <motion.div
          key={agent.id}
          initial={{ opacity: 0, y: 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
          className="pointer-events-none fixed z-50 w-[280px] rounded-[2px] border border-hairline-strong bg-ink-elevated/95 px-4 py-3 text-xs text-bone-muted shadow-2xl backdrop-blur-md"
          style={{
            left: Math.min(pos.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 304),
            top: Math.min(pos.y + 14, (typeof window !== "undefined" ? window.innerHeight : 800) - 240),
          }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span
              className="font-display text-bone tracking-[-0.012em]"
              style={{ fontSize: 18, lineHeight: 1.1 }}
            >
              {agent.name}
            </span>
            <span className="font-mono text-[9.5px] tracking-[0.15em] uppercase text-bone-dim">
              {agent.id}
            </span>
          </div>
          <div className="mt-1 text-[12px] text-bone-muted leading-snug">
            {agent.role} · {agent.department} · {agent.location}
          </div>
          <div className="mt-1 font-mono text-[10.5px] tracking-[0.05em] text-bone-faint">
            {agent.tenure_years}y tenure
            {manager && ` · reports to ${manager}`}
            {agent.is_caregiver && " · caregiver"}
          </div>

          {agent.motivators?.length > 0 && (
            <Section title="Motivators" items={agent.motivators} accent="sage" />
          )}
          {agent.sensitivities?.length > 0 && (
            <Section title="Sensitivities" items={agent.sensitivities} accent="rust" />
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Influence" value={agent.influence_weight} />
            <Stat label="Trust" value={agent.trust_in_leadership} />
          </div>

          {scenarioCtx && (
            <div className="mt-3 border-t border-hairline pt-2 text-bone leading-snug">
              <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-amber/70 mb-1">
                Scenario context
              </div>
              <div className="text-[12px]">{scenarioCtx}</div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: "sage" | "rust";
}) {
  // Inline color values — Tailwind 4 may not synthesize amber/sage/rust at
  // arbitrary opacity for the badge background, so we use known hex.
  const palette =
    accent === "sage"
      ? { border: "rgba(122,155,98,0.45)", text: "rgba(168,184,124,0.95)" }
      : { border: "rgba(168,90,62,0.45)", text: "rgba(208,140,108,0.95)" };
  return (
    <div className="mt-2.5">
      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-bone-faint">
        {title}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.slice(0, 5).map((m) => (
          <span
            key={m}
            className="rounded-[2px] border bg-ink/60 px-1.5 py-0.5 text-[10.5px]"
            style={{ borderColor: palette.border, color: palette.text }}
          >
            {m.replace(/_/g, " ")}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-bone-faint">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-[2px] flex-1 overflow-hidden rounded-full bg-hairline">
          <div
            className="h-full bg-amber/80"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono tabular-nums text-bone text-[10.5px]">
          {pct}%
        </span>
      </div>
    </div>
  );
}
