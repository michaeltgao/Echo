"use client";

import { CANONICAL_POLICIES } from "@/lib/api";

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

const PRESETS = [
  { id: "rto_v1", label: "Canonical: RTO v1 (aggressive)", text: CANONICAL_POLICIES.rto_v1 },
  { id: "rto_v2", label: "Canonical: RTO v2 (recommended)", text: CANONICAL_POLICIES.rto_v2 },
];

export default function PolicyTextarea({ value, onChange, disabled }: Props) {
  const charCount = value.length;
  const tooShort = charCount > 0 && charCount < 10;
  const tooLong = charCount > 8000;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor="policy" className="text-sm font-medium text-neutral-300">
          Policy text
        </label>
        <select
          aria-label="Load preset policy"
          disabled={disabled}
          onChange={(e) => {
            const preset = PRESETS.find((p) => p.id === e.target.value);
            if (preset) onChange(preset.text);
            e.target.value = "";
          }}
          defaultValue=""
          className="text-xs bg-neutral-900 border border-neutral-800 rounded-md px-2 py-1 text-neutral-300 disabled:opacity-50"
        >
          <option value="" disabled>
            Load preset…
          </option>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        id="policy"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={14}
        placeholder="Paste any HR policy. Example: 'Effective June 1, all employees in SF and NY must work in office Tuesday, Wednesday, and Thursday each week...'"
        className="w-full rounded-md bg-neutral-950 border border-neutral-800 focus:border-neutral-600 focus:ring-0 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 leading-relaxed font-mono resize-y disabled:opacity-50"
      />
      <div className="flex items-center justify-between text-xs">
        <span
          className={
            tooShort || tooLong ? "text-rose-400" : "text-neutral-500"
          }
        >
          {tooShort && "Need at least 10 characters."}
          {tooLong && "Over 8000 character limit."}
          {!tooShort && !tooLong && "10–8000 chars."}
        </span>
        <span className="text-neutral-500 tabular-nums">{charCount}</span>
      </div>
    </div>
  );
}
