// SSE consumer for POST /simulate/stream.
// Parses event/data frames and dispatches into the Zustand store.
// Pattern from docs/briefing-p3.md.

import { API_BASE } from "./api";
import { useAppStore } from "./store";
import type { SSEEvent } from "./types/sse";

interface RunSimulationOpts {
  policyText: string;
  policyVersion?: "v1" | "v2";
  days?: number;
  useCache?: boolean;
  signal?: AbortSignal;
}

/**
 * Stream a simulation from the backend and dispatch each SSE event into the
 * global store. Resolves when the stream closes (after the `result` event).
 * Throws on network failure or non-2xx HTTP — caller should set
 * simulationError on the store from the catch block.
 */
export async function runSimulation({
  policyText,
  policyVersion = "v1",
  days = 30,
  useCache = true,
  signal,
}: RunSimulationOpts): Promise<void> {
  const store = useAppStore.getState();
  store.resetSimulation();
  store.beginLiveRun();

  const resp = await fetch(`${API_BASE}/simulate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      policy_text: policyText,
      policy_version: policyVersion,
      days,
      use_cache: useCache,
    }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`POST /simulate/stream failed: ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line. Keep the last (possibly
    // incomplete) frame in the buffer for the next read.
    const frames = buf.split("\n\n");
    buf = frames.pop() ?? "";
    for (const frame of frames) {
      const event = parseFrame(frame);
      if (event) dispatchEvent(event);
    }
  }

  // Flush any trailing frame.
  if (buf.trim()) {
    const event = parseFrame(buf);
    if (event) dispatchEvent(event);
  }
}

function parseFrame(frame: string): SSEEvent | null {
  let dataLine: string | null = null;
  for (const line of frame.split("\n")) {
    if (line.startsWith("data:")) {
      dataLine = line.slice(5).trim();
      break;
    }
  }
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine) as SSEEvent;
  } catch {
    return null;
  }
}

function dispatchEvent(event: SSEEvent): void {
  // Browser-side trace: open DevTools console while clicking Run on
  // /predict/new to confirm events are arriving from /simulate/stream.
  // Filtered to the [sse] tag so it's easy to grep in the console.
  if (typeof window !== "undefined") {
    const summary =
      event.type === "stage"
        ? event.stage
        : event.type === "tick"
          ? `${event.completed}/${event.total}`
          : event.type === "action"
            ? event.action.action_type
            : event.type === "error"
              ? event.message
              : "";
    // eslint-disable-next-line no-console
    console.debug("[sse]", event.type, summary);
  }

  const s = useAppStore.getState();
  switch (event.type) {
    case "stage":
      s.setStage(event.stage);
      return;
    case "parsed":
      s.setParsedPolicy(event.parsed_policy);
      return;
    case "action":
      s.appendAction(event.action);
      return;
    case "tick":
      s.setProgress(event.completed, event.total);
      return;
    case "result":
      s.setResult(event.result);
      s.endLiveRun();
      return;
    case "error":
      s.setSimulationError(event.message);
      return;
  }
}
