"use client";

import type { SimulationResult } from "@/lib/types/simulation";

interface Props {
  result: SimulationResult;
}

type Theme = SimulationResult["themes"][number];

export default function ThemeCards({ result }: Props) {
  // Schema types themes as a 1-5 length tuple, but the placeholder backend can
  // return []. Treat as a plain array.
  const themes: Theme[] = (result.themes as unknown as Theme[]) ?? [];
  if (themes.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
        <h2 className="text-sm font-medium text-neutral-300">Top Themes</h2>
        <p className="mt-2 text-sm text-neutral-500">No themes extracted yet.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-medium text-neutral-300 mb-3">Top Themes</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {themes.map((t, i) => (
          <ThemeCard key={t.label + i} theme={t} />
        ))}
      </div>
    </section>
  );
}

function ThemeCard({ theme }: { theme: Theme }) {
  return (
    <article className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 flex flex-col gap-2">
      <header>
        <div className="text-base font-semibold text-neutral-100">{theme.label}</div>
        {theme.description && (
          <div className="mt-0.5 text-xs text-neutral-400 leading-relaxed">
            {theme.description}
          </div>
        )}
      </header>
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span className="tabular-nums">
          {theme.volume} action{theme.volume === 1 ? "" : "s"}
        </span>
        {theme.volume_pct != null && (
          <span className="text-neutral-600">· {Math.round(theme.volume_pct)}%</span>
        )}
        {theme.departments_affected && theme.departments_affected.length > 0 && (
          <span className="text-neutral-600 truncate">
            · {theme.departments_affected.join(", ")}
          </span>
        )}
      </div>
      <ul className="mt-1 flex flex-col gap-2">
        {(theme.quotes ?? []).slice(0, 3).map((q, i) => (
          <li
            key={q.action_id + i}
            className="text-sm text-neutral-200 border-l-2 border-neutral-700 pl-3 leading-snug"
          >
            <span className="italic">&ldquo;{q.text}&rdquo;</span>
            <div className="mt-0.5 text-[11px] text-neutral-500">
              {q.role || "—"}
              {q.department && ` · ${q.department}`}
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
