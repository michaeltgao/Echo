import type { Northwind, SimulationResult } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "https://echo-production-4ead.up.railway.app";

export async function fetchNorthwind(signal?: AbortSignal): Promise<Northwind> {
  const res = await fetch(`${API_BASE}/northwind`, { signal });
  if (!res.ok) throw new Error(`GET /northwind failed: ${res.status}`);
  return (await res.json()) as Northwind;
}

export interface SimulateRequest {
  policy_text: string;
  policy_version?: "v1" | "v2";
  days?: number;
  use_cache?: boolean;
}

/**
 * One-shot, non-streaming simulate. Used by the P2 sandbox to load a real
 * cached result (canonical RTO v1/v2) end-to-end. P3 will use the SSE variant
 * for the live demo.
 */
export async function postSimulate(
  req: SimulateRequest,
  signal?: AbortSignal,
): Promise<SimulationResult> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ use_cache: true, ...req }),
    signal,
  });
  if (!res.ok) throw new Error(`POST /simulate failed: ${res.status}`);
  return (await res.json()) as SimulationResult;
}

// Canonical demo policies — kept in sync with backend/main.py::_load_canonical_policies.
// Useful for sandbox dev so we can load a real cached result without typing.
export const CANONICAL_POLICIES = {
  rto_v1: `Effective June 1, 2026, all employees based in our San Francisco and New York offices are required to work from the office Tuesday, Wednesday, and Thursday each week. This policy applies to all departments and levels.

We believe in-person collaboration is essential to building the products our customers need and the culture we want to be known for. The era of indefinite remote flexibility is ending, and we are aligning with industry best practices.

Exceptions will be reviewed case-by-case at manager discretion. Employees who cannot meet the in-office requirement should discuss alternatives with their manager.

We are confident this change will accelerate execution, strengthen mentorship, and improve company performance. We appreciate your partnership in this transition.`,
  rto_v2: `Starting September 1, 2026, we are moving to a hybrid collaboration model for our San Francisco and New York offices. The default expectation is two days per week in-office (Tuesday and Wednesday), with the third day flexible at the team level.

Why we're doing this: Customer-facing teams have asked for more in-person time for cross-functional planning, and our engineering retros consistently rate hybrid sprints highest. We piloted this model with the Sales team in Q1 and saw measurable lift in pipeline velocity.

What's changing for you:
- Two anchor days (Tue/Wed) for cross-team collaboration
- One flexible team-choice day, owned by your manager and team
- Caregiving, medical, and accessibility exceptions are guaranteed, not discretionary — apply through People Ops, not your manager
- Fully-remote roles remain fully-remote; this policy applies to those already assigned to an office
- Three-month ramp: optional in June–August, expected starting September

We'll run a pulse survey 30 and 90 days after rollout and adjust based on what we learn. This is a starting point, not a final answer.`,
};
