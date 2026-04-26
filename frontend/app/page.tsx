import Link from "next/link";
import NorthwindStatus from "./components/NorthwindStatus";

/* ─────────────────────────────────────────────────────────────────────────
   Three modules — what Echo can do today and next
   ───────────────────────────────────────────────────────────────────────── */
type Module = {
  no: string;
  tag: string;
  title: string;
  sub: string;
  today: string;
  echo: string;
  primitives: readonly string[];
  status: string;
  primary?: boolean;
};

const MODULES: readonly Module[] = [
  {
    no: "01",
    tag: "Lattice Engagement",
    title: "Morale,",
    sub: "before the survey",
    today:
      "Today, you announce a change — return-to-office, a benefits cut, a new review schedule — send out a survey a month later, and hope morale held up.",
    echo:
      "Paste your draft. Echo creates a stand-in for your workforce — fictional employees who match your real teams. They react, complain, defend it. You get the survey results before you've even announced the change. Which teams push back. What they say. How feelings shift over the month.",
    primitives: ["Workforce stand-in", "Survey before you ship", "Team-by-team mood"],
    status: "Live demo",
    primary: true,
  },
  {
    no: "02",
    tag: "Lattice Compensation",
    title: "Who quits,",
    sub: "and why",
    today:
      "Lattice helps managers split bonuses and tracks who quits later. The grumbling between coworkers — that all happens off the platform.",
    echo:
      "Try freezing Marketing bonuses while raising Engineering's. Echo plays out how the news spreads. Pay-driven employees react one way, work-life-balance employees react another. The result: a heat map of who is likely to quit because of this specific call.",
    primitives: ["Office grumbling, simulated", "Different people, different reactions", "Heat map of who walks"],
    status: "Q3 2026",
  },
  {
    no: "03",
    tag: "Lattice Goals · Grow",
    title: "Reorg friction,",
    sub: "before you move anyone",
    today:
      "Reorgs are messy. Lattice shows you the new org chart, but not how much pain the change actually causes.",
    echo:
      "Upload a new reporting structure. Echo plays out how it would feel. Put an independent engineer under a manager who micromanages — see the friction. Try a few different versions. Pick the one with the least pain before you move a single person.",
    primitives: ["Personality fit", "Productivity forecast", "Try multiple org charts"],
    status: "Q4 2026",
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   Horizon — same simulator, every kind of people decision
   ───────────────────────────────────────────────────────────────────────── */
const HORIZON = [
  {
    code: "P-01",
    name: "Policy",
    surface: "Lattice Engagement",
    detail: "How your workforce reacts to any change you announce",
    state: "live",
  },
  {
    code: "P-02",
    name: "Compensation",
    surface: "Lattice Compensation",
    detail: "Who's likely to quit when you change pay or bonuses",
    state: "next",
  },
  {
    code: "P-03",
    name: "Goals",
    surface: "Lattice Goals",
    detail: "How teams react when you change the goal-setting rhythm",
    state: "horizon",
  },
  {
    code: "P-04",
    name: "Career",
    surface: "Lattice Grow",
    detail: "How people feel when you change promotion criteria",
    state: "horizon",
  },
  {
    code: "P-05",
    name: "Reorg",
    surface: "Lattice HRIS",
    detail: "How a new reporting structure would actually feel",
    state: "horizon",
  },
] as const;

const STATE_LABEL: Record<(typeof HORIZON)[number]["state"], string> = {
  live: "Live now",
  next: "Building",
  horizon: "Coming",
};

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col">
      {/* ───────────────────────────────────────────────────────────────────
          Top bar
          ─────────────────────────────────────────────────────────────────── */}
      <header className="px-6 md:px-12 lg:px-16 pt-8 md:pt-10 flex items-center justify-between fade-up">
        <div className="t-eyebrow flex items-center gap-3">
          <span className="text-amber">Echo</span>
          <span className="text-bone-dim">/</span>
          <span>№01</span>
          <span className="text-bone-dim">/</span>
          <span>Wind Tunnel</span>
        </div>
        <nav className="t-eyebrow hidden md:flex items-center gap-6">
          <a href="#modules" className="hover:text-bone transition-colors">What it does</a>
          <a href="#horizon" className="hover:text-bone transition-colors">What&apos;s next</a>
          <a href="#engine" className="hover:text-bone transition-colors">How it works</a>
          <Link
            href="/predict/new"
            className="text-amber hover:text-amber-bright transition-colors"
          >
            Try it →
          </Link>
        </nav>
      </header>

      <div className="flex-1 px-6 md:px-12 lg:px-16">
        <div className="max-w-[1180px] mx-auto pb-32">
          {/* Drawn-in hairline — the wind tunnel motif */}
          <div className="h-px w-full bg-hairline-strong mt-8 md:mt-10 draw-in" />

          {/* ───────────────────────────────────────────────────────────────
              Hero
              ─────────────────────────────────────────────────────────────── */}
          <section
            className="pt-14 md:pt-24 pb-16 md:pb-24 fade-up"
            style={{ animationDelay: "350ms" }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-end">
              <div className="lg:col-span-9">
                <h1
                  className="font-display font-normal text-bone tracking-[-0.028em] leading-[0.95]"
                  style={{ fontSize: "clamp(48px, 9vw, 120px)" }}
                >
                  A wind tunnel
                  <br />
                  for HR{" "}
                  <span className="italic font-medium text-amber-bright">
                    decisions
                  </span>
                  <span className="text-amber-bright">.</span>
                </h1>

                <p className="mt-10 md:mt-14 max-w-[640px] text-bone-muted text-[18px] md:text-[19px] leading-[1.65]">
                  Pick a tough decision —{" "}
                  <em className="not-italic font-medium text-bone">return-to-office</em>,
                  smaller bonuses, a layoff. Echo simulates 50 employees over the
                  next 30 days. They argue with friends, post in Slack, ask their
                  manager for a way out, stop showing up to meetings, start
                  applying elsewhere.
                </p>

                <p className="mt-5 max-w-[640px] text-bone-muted text-[18px] md:text-[19px] leading-[1.65]">
                  You see the morale hit before it happens. You see exactly which
                  teams push back, and what they&apos;d say. Then you{" "}
                  <em className="not-italic font-medium text-bone">change a few words</em>,
                  run it again, and watch the same people stay calm.
                </p>

                {/* CTA cluster */}
                <div className="mt-12 md:mt-14 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7">
                  <Link
                    href="/predict/new"
                    className="group relative inline-flex items-center gap-4 self-start bg-amber text-ink px-7 py-4 rounded-[2px] font-mono text-[12.5px] tracking-[0.16em] uppercase font-medium hover:bg-amber-bright transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />
                    Try the live demo
                    <span className="transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden>
                      →
                    </span>
                  </Link>

                  <Link
                    href="/graph"
                    className="group inline-flex items-center gap-3 self-start font-mono text-[12.5px] tracking-[0.16em] uppercase text-bone-muted hover:text-bone transition-colors"
                  >
                    <span className="underline decoration-amber/40 underline-offset-[6px] group-hover:decoration-amber-bright">
                      Or watch a sample play out
                    </span>
                    <span aria-hidden>↗</span>
                  </Link>
                </div>
              </div>

              {/* Vertical spec strip — sits to the right on desktop */}
              <aside className="lg:col-span-3 lg:pl-6 lg:border-l lg:border-hairline">
                <div className="t-eyebrow mb-4 text-amber/80">At a glance</div>
                <dl className="font-mono text-[12px] tracking-[0.06em] text-bone-muted space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-bone-faint">people simulated</dt>
                    <dd className="tabular-nums text-bone">50</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-bone-faint">time covered</dt>
                    <dd className="tabular-nums text-bone">30 days</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-bone-faint">ways to react</dt>
                    <dd className="tabular-nums text-bone">8</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-bone-faint">built on</dt>
                    <dd className="text-amber/85">Lattice</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-bone-faint">your data</dt>
                    <dd className="text-amber/85">stays private</dd>
                  </div>
                </dl>
              </aside>
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────────────
              Modules — the three featured Predict integrations
              ─────────────────────────────────────────────────────────────── */}
          <section
            id="modules"
            className="mt-12 md:mt-20 fade-up scroll-mt-24"
            style={{ animationDelay: "650ms" }}
          >
            <div className="t-eyebrow mb-10 flex items-center gap-4">
              <span className="h-px w-10 bg-amber/55" />
              <span>Three modules · one simulator</span>
            </div>

            <h2
              className="font-display font-normal text-bone tracking-[-0.022em] leading-[1.02] max-w-[20ch]"
              style={{ fontSize: "clamp(32px, 4.6vw, 54px)" }}
            >
              Try the consequences{" "}
              <span className="italic text-amber-bright">before</span> you have
              to live with them.
            </h2>

            <ul role="list" className="mt-14 md:mt-20 space-y-0">
              {MODULES.map((m, i) => (
                <li
                  key={m.no}
                  className={`group relative grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 py-12 md:py-14 border-t border-hairline ${
                    i === MODULES.length - 1 ? "border-b" : ""
                  }`}
                >
                  {/* Number + tag */}
                  <div className="lg:col-span-3 flex flex-col gap-3">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[12.5px] tracking-[0.15em] tabular-nums text-amber/75">
                        {m.no}
                      </span>
                      {m.primary && (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-amber-bright">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-bright animate-pulse" />
                          live
                        </span>
                      )}
                    </div>
                    <span className="t-eyebrow text-bone-faint">{m.tag}</span>
                    <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-bone-dim">
                      {m.status}
                    </span>
                  </div>

                  {/* Title + body */}
                  <div className="lg:col-span-9 flex flex-col gap-7">
                    <h3
                      className="font-display font-normal tracking-[-0.022em] leading-[1.04] text-bone"
                      style={{ fontSize: "clamp(28px, 4vw, 46px)" }}
                    >
                      {m.title}{" "}
                      <span className="italic text-bone-muted">{m.sub}</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-7 md:gap-10">
                      <div>
                        <div className="t-eyebrow mb-3 text-bone-dim">Today</div>
                        <p className="text-bone-muted text-[15.5px] leading-[1.65] max-w-[42ch]">
                          {m.today}
                        </p>
                      </div>
                      <div>
                        <div className="t-eyebrow mb-3 text-amber/85">With Echo</div>
                        <p className="text-bone text-[15.5px] leading-[1.65] max-w-[44ch]">
                          {m.echo}
                        </p>
                      </div>
                    </div>

                    {/* Primitives — comma-strung mono labels */}
                    <div className="flex flex-wrap gap-x-2 gap-y-2 font-mono text-[11px] tracking-[0.12em] uppercase">
                      {m.primitives.map((p, idx) => (
                        <span key={p} className="flex items-center gap-2">
                          <span className="text-bone-faint">{p}</span>
                          {idx < m.primitives.length - 1 && (
                            <span className="text-bone-dim">·</span>
                          )}
                        </span>
                      ))}
                    </div>

                    {m.primary && (
                      <Link
                        href="/predict/new"
                        className="group/cta inline-flex items-center gap-3 self-start mt-2 font-mono text-[12px] tracking-[0.16em] uppercase text-amber hover:text-amber-bright transition-colors"
                      >
                        <span className="underline decoration-amber/40 underline-offset-[6px] group-hover/cta:decoration-amber-bright">
                          Try this one yourself
                        </span>
                        <span className="transition-transform duration-300 group-hover/cta:translate-x-1" aria-hidden>
                          →
                        </span>
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ───────────────────────────────────────────────────────────────
              Horizon — Predict isn't a feature, it's horizontal
              ─────────────────────────────────────────────────────────────── */}
          <section
            id="horizon"
            className="mt-28 md:mt-36 fade-up scroll-mt-24"
            style={{ animationDelay: "850ms" }}
          >
            <div className="t-eyebrow mb-8 flex items-center gap-4">
              <span className="h-px w-10 bg-amber/55" />
              <span>What&apos;s next</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-5">
                <h2
                  className="font-display font-normal text-bone tracking-[-0.022em] leading-[1.04]"
                  style={{ fontSize: "clamp(30px, 4vw, 46px)" }}
                >
                  One simulator,
                  <br />
                  <span className="italic text-amber-bright">
                    every people decision.
                  </span>
                </h2>
                <p className="mt-7 text-bone-muted text-[16px] leading-[1.65] max-w-[42ch]">
                  Today, you can try one. Tomorrow, the same simulator handles
                  pay, careers, goals, and reorgs — all using the same Lattice
                  data your team already trusts.
                </p>
                <p className="mt-5 text-bone-muted text-[15px] leading-[1.6] max-w-[42ch]">
                  One simulator. One stand-in workforce. Five places to use it —
                  so far.
                </p>
              </div>

              {/* Horizon table */}
              <div className="lg:col-span-7">
                <div className="border-t border-hairline-strong">
                  {HORIZON.map((h) => (
                    <div
                      key={h.code}
                      className="group grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1.4fr_1.6fr_auto] items-baseline gap-4 md:gap-6 py-5 border-b border-hairline hover:bg-amber/[0.025] transition-colors px-2 -mx-2"
                    >
                      <span className="font-mono text-[11px] tracking-[0.16em] tabular-nums text-amber/65">
                        {h.code}
                      </span>
                      <div className="flex flex-col gap-1">
                        <span
                          className="font-display font-normal text-bone tracking-[-0.012em] leading-[1.1]"
                          style={{ fontSize: "clamp(20px, 2.2vw, 24px)" }}
                        >
                          {h.name}
                        </span>
                        <span className="t-eyebrow text-bone-dim md:hidden">
                          {h.surface}
                        </span>
                      </div>
                      <span className="hidden md:block text-bone-muted text-[14px] leading-[1.5] max-w-[44ch]">
                        {h.detail}
                      </span>
                      <span
                        className={`font-mono text-[10.5px] tracking-[0.18em] uppercase whitespace-nowrap ${
                          h.state === "live"
                            ? "text-amber-bright"
                            : h.state === "next"
                            ? "text-amber/80"
                            : "text-bone-faint"
                        }`}
                      >
                        {h.state === "live" && (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-bright mr-2 align-middle" />
                        )}
                        {STATE_LABEL[h.state]}
                      </span>
                      {/* Mobile-only detail row */}
                      <p className="md:hidden col-span-3 text-bone-muted text-[14px] leading-[1.55] -mt-1">
                        {h.detail}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-6 font-mono text-[11px] tracking-[0.14em] uppercase text-bone-faint">
                  All powered by the same simulator.
                </p>
              </div>
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────────────
              Engine — small visual breakdown of how it works
              ─────────────────────────────────────────────────────────────── */}
          <section
            id="engine"
            className="mt-28 md:mt-36 fade-up scroll-mt-24"
            style={{ animationDelay: "1000ms" }}
          >
            <div className="t-eyebrow mb-8 flex items-center gap-4">
              <span className="h-px w-10 bg-amber/55" />
              <span>How it works · in five steps</span>
            </div>

            <ol className="grid grid-cols-1 md:grid-cols-5 gap-px bg-hairline border border-hairline rounded-[2px] overflow-hidden">
              {[
                { k: "Read", v: "Echo pulls in your team, roles, and reporting lines — all anonymized." },
                { k: "Build", v: "It creates 50 stand-in employees, each with their own personality and concerns." },
                { k: "Add", v: "You drop in your draft policy, comp change, or new org chart." },
                { k: "Play", v: "30 days play out — DMs, complaints, requests, quiet quitting, resignations." },
                { k: "Show", v: "You see predicted morale, who's upset, who's likely to quit, where productivity dips." },
              ].map((s, i) => (
                <li
                  key={s.k}
                  className="bg-ink p-6 md:p-7 flex flex-col gap-3 min-h-[180px]"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[11px] tracking-[0.16em] tabular-nums text-amber/70">
                      0{i + 1}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-bone-dim">
                      step
                    </span>
                  </div>
                  <h4
                    className="font-display font-normal text-bone tracking-[-0.012em]"
                    style={{ fontSize: "22px" }}
                  >
                    {s.k}
                  </h4>
                  <p className="text-bone-muted text-[13.5px] leading-[1.55]">
                    {s.v}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* ───────────────────────────────────────────────────────────────
              Closing CTA + system readout
              ─────────────────────────────────────────────────────────────── */}
          <section
            className="mt-28 md:mt-36 fade-up"
            style={{ animationDelay: "1150ms" }}
          >
            <div className="relative overflow-hidden border border-hairline-strong rounded-[2px] px-8 md:px-14 py-14 md:py-20">
              {/* faint diagonal hairlines for atmosphere */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(115deg, var(--color-amber) 0 1px, transparent 1px 14px)",
                }}
                aria-hidden
              />

              <div className="relative grid grid-cols-1 md:grid-cols-12 items-end gap-10">
                <div className="md:col-span-8">
                  <div className="t-eyebrow text-amber/80 mb-5">Try it</div>
                  <h3
                    className="font-display font-normal text-bone tracking-[-0.022em] leading-[1.02]"
                    style={{ fontSize: "clamp(32px, 5vw, 60px)" }}
                  >
                    Paste a policy.{" "}
                    <span className="italic text-amber-bright">
                      Watch your workforce react
                    </span>{" "}
                    in real time.
                  </h3>
                  <p className="mt-6 max-w-[52ch] text-bone-muted text-[16px] leading-[1.65]">
                    Runs right in your browser. No setup. Pre-loaded with a
                    sample company — so you can run a scenario in under a minute.
                  </p>
                </div>

                <div className="md:col-span-4 flex md:justify-end">
                  <Link
                    href="/predict/new"
                    className="group inline-flex items-center gap-4 bg-amber text-ink px-8 py-5 rounded-[2px] font-mono text-[12.5px] tracking-[0.16em] uppercase font-medium hover:bg-amber-bright transition-colors"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />
                    Open the demo
                    <span className="transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden>
                      →
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────────────
              System readout
              ─────────────────────────────────────────────────────────────── */}
          <section
            className="mt-20 md:mt-24 pt-8 border-t border-hairline fade-up"
            style={{ animationDelay: "1300ms" }}
          >
            <div className="t-eyebrow mb-4 flex items-center gap-4">
              <span className="h-px w-10 bg-amber/55" />
              <span>System</span>
            </div>
            <NorthwindStatus />
          </section>

          {/* ───────────────────────────────────────────────────────────────
              Footer
              ─────────────────────────────────────────────────────────────── */}
          <footer
            className="mt-12 md:mt-20 pt-7 border-t border-hairline flex flex-col md:flex-row md:items-end justify-between gap-6 fade-up"
            style={{ animationDelay: "1450ms" }}
          >
            <p
              className="font-display italic text-bone-muted leading-[1.4] max-w-[420px]"
              style={{ fontSize: "clamp(15px, 1.6vw, 17px)" }}
            >
              See the consequences of a decision before you have to live with
              them.
            </p>
            <p className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-bone-dim">
              Echo · early build
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
