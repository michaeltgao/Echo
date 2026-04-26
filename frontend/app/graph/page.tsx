import NorthwindStatus from "../components/NorthwindStatus";
import OrgGraph from "../components/graph/OrgGraph";
import SandboxControls from "../components/graph/SandboxControls";

export default function GraphPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 px-8 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Org graph sandbox</h1>
        <p className="text-sm text-neutral-400">
          P2 dev page. Load a canonical policy to see sentiment animate over 30 days.
        </p>
      </header>
      <NorthwindStatus />
      <SandboxControls />
      <OrgGraph />
    </main>
  );
}
