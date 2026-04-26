"use client";

import { motion } from "framer-motion";
import {
  ACTION_STYLE,
  describeContentlessAction,
  firstName,
  initials,
} from "@/lib/actionStyle";
import type { ActionRecord } from "@/lib/types/sse";
import type { NorthwindAgent } from "@/lib/types/northwind";

interface Props {
  action: ActionRecord;
  agent: NorthwindAgent | undefined;
  onClick?: (action: ActionRecord) => void;
}

export default function ActionCard({ action, agent, onClick }: Props) {
  const style = ACTION_STYLE[action.action_type];
  const name = agent?.name ?? action.agent_id;
  const role = agent?.role ?? "";
  const dept = agent?.department ?? "";
  const targetLabel = formatTarget(action);

  const body = action.content
    ? action.content
    : describeContentlessAction(action.action_type, firstName(name));

  return (
    <motion.button
      type="button"
      onClick={() => onClick?.(action)}
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={`group w-full text-left rounded-[2px] border-l-2 ${style.border} ${style.bg} hover:bg-bone/[0.04] px-3 py-2.5 flex gap-3 items-start transition-colors`}
    >
      <Avatar name={name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-bone truncate">{name}</span>
          {role && <span className="text-bone-faint truncate">· {role}</span>}
          <span className="ml-auto shrink-0 font-mono text-[10.5px] tracking-[0.08em] text-bone-faint tabular-nums">
            Day {action.day}
          </span>
        </div>
        <div className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${style.text}`}>
          {style.label}
          {targetLabel && (
            <span className="text-bone-faint normal-case tracking-normal ml-1.5">
              {targetLabel}
            </span>
          )}
        </div>
        <p
          className={`mt-1 text-[13.5px] ${
            action.content ? "text-bone-muted" : "text-bone-faint italic"
          } leading-[1.5] line-clamp-3`}
        >
          {body}
        </p>
        {dept && (
          <div className="mt-1 font-mono text-[10px] tracking-[0.1em] uppercase text-bone-dim">
            {dept}
          </div>
        )}
      </div>
    </motion.button>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="shrink-0 mt-0.5 h-8 w-8 rounded-full bg-ink-deep ring-1 ring-hairline grid place-items-center font-mono text-[10px] font-semibold text-bone-muted">
      {initials(name)}
    </div>
  );
}

function formatTarget(a: ActionRecord): string {
  const t = a.target;
  if (!t || t.type === "none") return "";
  if (t.type === "channel") return `→ ${t.value}`;
  if (t.type === "manager") return `→ manager`;
  if (t.type === "external") return `→ external`;
  if (t.type === "agent") return `→ peer`;
  return "";
}
