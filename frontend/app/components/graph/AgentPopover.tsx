"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";

// Renders a fixed-position popover at the cursor location. Sibling-mounted
// alongside the React Flow viewport so it isn't clipped by graph overflow.
//
// Note: scenario_specific_context is not currently exposed in /northwind nor
// in the SimulationResult — it lives only inside the backend during a run.
// We render the field if it appears (graceful degrade when P1 surfaces it).
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
          initial={{ opacity: 0, y: 4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none fixed z-50 max-w-xs rounded-md border border-neutral-700 bg-neutral-900/95 px-3 py-2 text-xs text-neutral-200 shadow-xl backdrop-blur"
          style={{
            left: Math.min(pos.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 280),
            top: Math.min(pos.y + 14, (typeof window !== "undefined" ? window.innerHeight : 800) - 220),
          }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-white">{agent.name}</span>
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              {agent.id}
            </span>
          </div>
          <div className="mt-0.5 text-neutral-400">
            {agent.role} · {agent.department} · {agent.location}
          </div>
          <div className="mt-0.5 text-neutral-500">
            {agent.tenure_years}y tenure
            {manager && ` · reports to ${manager}`}
            {agent.is_caregiver && " · caregiver"}
          </div>

          {agent.motivators?.length > 0 && (
            <Section title="Motivators" items={agent.motivators} accent="emerald" />
          )}
          {agent.sensitivities?.length > 0 && (
            <Section title="Sensitivities" items={agent.sensitivities} accent="rose" />
          )}

          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-neutral-400">
            <Stat label="Influence" value={agent.influence_weight} />
            <Stat label="Trust" value={agent.trust_in_leadership} />
          </div>

          {scenarioCtx && (
            <div className="mt-2 rounded border border-neutral-800 bg-neutral-950 p-1.5 text-neutral-300">
              <div className="text-[9px] uppercase tracking-wider text-neutral-500">
                Scenario context
              </div>
              <div className="mt-0.5 leading-snug">{scenarioCtx}</div>
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
  accent: "emerald" | "rose";
}) {
  const ring = accent === "emerald" ? "border-emerald-700/50" : "border-rose-700/50";
  return (
    <div className="mt-1.5">
      <div className="text-[9px] uppercase tracking-wider text-neutral-500">{title}</div>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {items.slice(0, 5).map((m) => (
          <span
            key={m}
            className={`rounded-full border ${ring} bg-neutral-950 px-1.5 py-0.5 text-[10px] text-neutral-300`}
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
      <div className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded bg-neutral-800">
          <div
            className="h-full rounded bg-neutral-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="tabular-nums text-neutral-300">{pct}%</span>
      </div>
    </div>
  );
}
