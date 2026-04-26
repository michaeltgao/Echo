"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { CANONICAL_POLICIES } from "@/lib/api";

// Editorial presentation of the active canonical policy. Acts like an
// internal memo: small mono header (FROM / TO / EFFECTIVE) above the body,
// rendered in display serif + sans body. Sticky on desktop within its column.

const VERSION_META = {
  v1: {
    eyebrow: "Aggressive draft",
    label: "v1",
    title: "Return-to-Office mandate",
    effective: "Effective June 1 2026",
    tone: "Firm · Manager-discretion exceptions",
  },
  v2: {
    eyebrow: "Recommended rewrite",
    label: "v2",
    title: "Hybrid Collaboration model",
    effective: "Effective September 1 2026 · 3-month ramp",
    tone: "Conciliatory · Guaranteed exceptions via People Ops",
  },
} as const;

type Version = keyof typeof VERSION_META;

interface PolicyMemoProps {
  v1Loaded: boolean;
  v2Loaded: boolean;
  compact?: boolean;
}

export default function PolicyMemo({
  v1Loaded,
  v2Loaded,
  compact = false,
}: PolicyMemoProps) {
  const activeVersion = useAppStore((s) => s.activeVersion);
  const setActiveVersion = useAppStore((s) => s.setActiveVersion);

  const meta = VERSION_META[activeVersion];
  const text = activeVersion === "v1" ? CANONICAL_POLICIES.rto_v1 : CANONICAL_POLICIES.rto_v2;

  if (compact) {
    return <CompactStrip meta={meta} v1Loaded={v1Loaded} v2Loaded={v2Loaded} />;
  }

  // Split paragraphs for typesetting; preserve line breaks within paragraphs.
  const paragraphs = useMemo(
    () =>
      text
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean),
    [text],
  );

  return (
    <aside className="lg:sticky lg:top-8 flex flex-col gap-6">
      {/* Version toggle */}
      <div className="flex items-baseline gap-6 border-b border-hairline pb-4">
        <span className="t-eyebrow">Sample policy</span>
        <div className="flex items-center gap-5 text-[12.5px] font-mono tracking-[0.16em] uppercase">
          <VersionTab
            version="v1"
            active={activeVersion === "v1"}
            loaded={v1Loaded}
            onClick={() => setActiveVersion("v1")}
          />
          <span className="text-bone-dim">/</span>
          <VersionTab
            version="v2"
            active={activeVersion === "v2"}
            loaded={v2Loaded}
            onClick={() => setActiveVersion("v2")}
          />
        </div>
      </div>

      {/* Memo header — small mono metadata block */}
      <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-bone-faint flex flex-col gap-1.5">
        <div className="flex justify-between gap-4">
          <span className="text-bone-dim">From</span>
          <span className="text-bone-muted">People Operations</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-bone-dim">To</span>
          <span className="text-bone-muted">All staff, Northwind Inc.</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-bone-dim">Re</span>
          <span className="text-bone-muted text-right">{meta.tone}</span>
        </div>
      </div>

      {/* Hairline divider */}
      <div className="h-px bg-hairline" />

      {/* Eyebrow + title */}
      <div>
        <div className="t-eyebrow text-amber/85 mb-3">{meta.eyebrow}</div>
        <h2
          className="font-display font-normal text-bone tracking-[-0.02em] leading-[1.06]"
          style={{ fontSize: "clamp(24px, 2.4vw, 30px)" }}
        >
          {meta.title}
          <span className="block mt-1 text-bone-muted italic font-normal text-[14.5px] tracking-[0]">
            {meta.effective}
          </span>
        </h2>
      </div>

      {/* Body text */}
      <article
        className="flex flex-col gap-4 text-[14.5px] leading-[1.65] text-bone-muted max-h-[44vh] overflow-y-auto pr-2"
        style={{
          scrollbarColor: "var(--color-hairline-strong) transparent",
          scrollbarWidth: "thin",
        }}
      >
        {paragraphs.map((p, i) => (
          <p
            key={i}
            // Drop-cap-ish first letter only on the first paragraph
            className={i === 0 ? "first-letter:font-display first-letter:text-amber-bright first-letter:text-[28px] first-letter:leading-none first-letter:mr-1 first-letter:float-left first-letter:pt-1" : ""}
          >
            {p}
          </p>
        ))}
      </article>
    </aside>
  );
}

function CompactStrip({
  meta,
  v1Loaded,
  v2Loaded,
}: {
  meta: (typeof VERSION_META)[Version];
  v1Loaded: boolean;
  v2Loaded: boolean;
}) {
  const activeVersion = useAppStore((s) => s.activeVersion);
  const setActiveVersion = useAppStore((s) => s.setActiveVersion);

  return (
    <aside className="border border-hairline rounded-[2px] bg-ink-elevated/40 px-5 py-4 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
      {/* Version toggle */}
      <div className="flex items-center gap-4 font-mono text-[12px] tracking-[0.16em] uppercase">
        <span className="t-eyebrow text-bone-faint">Sample</span>
        <VersionTab
          version="v1"
          active={activeVersion === "v1"}
          loaded={v1Loaded}
          onClick={() => setActiveVersion("v1")}
        />
        <span className="text-bone-dim">/</span>
        <VersionTab
          version="v2"
          active={activeVersion === "v2"}
          loaded={v2Loaded}
          onClick={() => setActiveVersion("v2")}
        />
      </div>

      {/* Vertical hairline */}
      <span className="hidden md:block h-6 w-px bg-hairline" aria-hidden />

      {/* Title + tone */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="t-eyebrow text-amber/85">{meta.eyebrow}</span>
          <span
            className="font-display text-bone tracking-[-0.012em] leading-tight truncate"
            style={{ fontSize: 16 }}
          >
            {meta.title}
          </span>
        </div>
        <span className="font-mono text-[10.5px] tracking-[0.12em] uppercase text-bone-faint truncate">
          {meta.effective}
          <span className="text-bone-dim mx-2">·</span>
          {meta.tone}
        </span>
      </div>
    </aside>
  );
}

function VersionTab({
  version,
  active,
  loaded,
  onClick,
}: {
  version: Version;
  active: boolean;
  loaded: boolean;
  onClick: () => void;
}) {
  const meta = VERSION_META[version];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!loaded}
      className={`relative pb-2 transition-colors disabled:cursor-wait ${
        active
          ? "text-bone"
          : loaded
            ? "text-bone-faint hover:text-bone-muted"
            : "text-bone-dim"
      }`}
    >
      {meta.label}
      {!loaded && (
        <span className="ml-2 text-[9px] text-bone-dim normal-case tracking-normal">
          loading…
        </span>
      )}
      {/* Active indicator — amber underline */}
      <span
        className={`absolute left-0 right-0 -bottom-[1px] h-[1.5px] transition-all duration-300 ${
          active ? "bg-amber" : "bg-transparent"
        }`}
      />
    </button>
  );
}
