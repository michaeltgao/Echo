import Link from "next/link";
import NorthwindStatus from "./components/NorthwindStatus";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-8 py-16">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">Lattice Predict</h1>
          <p className="text-neutral-400">
            A wind tunnel for HR decisions. Frontend dev index.
          </p>
        </header>

        <NorthwindStatus />

        <nav className="flex flex-col gap-3">
          <Link
            href="/graph"
            className="rounded-md border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900 px-4 py-3 transition"
          >
            <span className="font-medium">Graph sandbox</span>
            <span className="block text-sm text-neutral-500">
              P2 — org graph + animations dev page
            </span>
          </Link>
          <Link
            href="/predict/new"
            className="rounded-md border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900 px-4 py-3 transition"
          >
            <span className="font-medium">Scenario builder</span>
            <span className="block text-sm text-neutral-500">
              P3 — paste a policy, run simulation (placeholder until P3 lands)
            </span>
          </Link>
        </nav>
      </div>
    </main>
  );
}
