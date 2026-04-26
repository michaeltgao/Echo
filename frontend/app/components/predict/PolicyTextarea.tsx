"use client";

import { CANONICAL_POLICIES } from "@/lib/api";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

const PRESETS = [
  {
    id: "rto_v1",
    label: "RTO v1",
    sub: "aggressive draft",
    text: CANONICAL_POLICIES.rto_v1,
  },
  {
    id: "rto_v2",
    label: "RTO v2",
    sub: "recommended rewrite",
    text: CANONICAL_POLICIES.rto_v2,
  },
];

export default function PolicyTextarea({ value, onChange, disabled }: Props) {
  const charCount = value.length;
  const tooShort = charCount > 0 && charCount < 10;
  const tooLong = charCount > 8000;

  return (
    <div className="flex flex-col gap-4">
      {/* Label row + presets */}
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <label htmlFor="policy" className="t-eyebrow text-amber/85">
          The announcement
        </label>
        <div className="flex items-baseline gap-2.5 font-mono text-[11px] tracking-[0.14em] uppercase">
          <span className="text-bone-faint">Try a preset</span>
          {PRESETS.map((p, i) => (
            <span key={p.id} className="flex items-baseline gap-2.5">
              <span className="text-bone-dim">·</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(p.text)}
                className="group flex items-baseline gap-1 text-bone-muted hover:text-amber-bright transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="underline decoration-amber/30 underline-offset-[5px] group-hover:decoration-amber-bright">
                  {p.label}
                </span>
                <span className="hidden md:inline text-bone-dim normal-case tracking-normal">
                  · {p.sub}
                </span>
              </button>
              {i === PRESETS.length - 1 && value && (
                <>
                  <span className="text-bone-dim">·</span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange("")}
                    className="text-bone-faint hover:text-rust transition-colors disabled:opacity-40"
                  >
                    Clear
                  </button>
                </>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Textarea — paper-like, on slightly elevated ink */}
      <div className="relative">
        <textarea
          id="policy"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={16}
          placeholder="Paste any HR policy. Example: 'Effective June 1, all employees in our SF and NY offices are required to work from the office Tuesday, Wednesday, and Thursday each week...'"
          className="block w-full rounded-[2px] border border-hairline-strong focus:border-amber/60 focus:outline-none focus:ring-0 bg-ink-elevated px-5 py-4 text-[14.5px] text-bone placeholder:text-bone-dim leading-[1.65] font-sans resize-y disabled:opacity-50 transition-colors min-h-[280px]"
          style={{
            fontFeatureSettings: "'ss01'",
          }}
        />
      </div>

      {/* Counter / validation row */}
      <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.14em] uppercase">
        <span
          className={
            tooShort || tooLong
              ? "text-rust normal-case tracking-normal"
              : "text-bone-faint"
          }
        >
          {tooShort && "Need at least 10 characters."}
          {tooLong && "Over 8000 character limit."}
          {!tooShort && !tooLong && "10–8000 chars"}
        </span>
        <span className="text-bone-muted tabular-nums normal-case">
          {charCount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
