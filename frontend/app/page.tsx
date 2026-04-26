import Link from "next/link";
import NorthwindStatus from "./components/NorthwindStatus";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">Echo</h1>
          <p className="text-neutral-400">
            A wind tunnel for HR decisions. Paste any policy, watch your workforce act.
          </p>
        </header>

        <NorthwindStatus />

        <nav className="flex flex-col gap-3">
          <Link
            href="/predict/new"
            className="rounded-md border border-emerald-700/50 bg-emerald-950/20 hover:bg-emerald-950/40 px-4 py-3 transition"
          >
            <span className="font-medium text-emerald-200">Scenario builder →</span>
            <span className="block text-sm text-neutral-400">
              Paste a policy, run a simulation, watch the live action feed
            </span>
          </Link>
          <Link
            href="/graph"
            className="rounded-md border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900 px-4 py-3 transition"
          >
            <span className="font-medium">Org graph sandbox</span>
            <span className="block text-sm text-neutral-500">
              P2 — agent network + animations dev page
            </span>
          </Link>
          <Link
            href="/predict/compare"
            className="rounded-md border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900 px-4 py-3 transition"
          >
            <span className="font-medium">Compare v1 vs v2</span>
            <span className="block text-sm text-neutral-500">
              After running both, see side-by-side
            </span>
          </Link>
        </nav>
      </div>
    </main>
  );
}
