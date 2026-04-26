"use client";

import { useEffect, useRef } from "react";
import { fetchNorthwind } from "@/lib/api";
import { useAppStore } from "@/lib/store";

// Mounted once in the root layout. Loads the workforce roster into the store
// as soon as the app boots so any route can read from useAppStore().
//
// startedRef gates the effect so it runs at most once. Without this, status in
// deps + React Strict Mode double-invoke + the abort-on-cleanup pattern made
// the effect cancel its own fetch on the first re-render, leaving the store
// stuck at "loading".
export default function NorthwindLoader() {
  const startedRef = useRef(false);
  const setNorthwind = useAppStore((s) => s.setNorthwind);
  const setNorthwindStatus = useAppStore((s) => s.setNorthwindStatus);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setNorthwindStatus("loading");
    fetchNorthwind()
      .then(setNorthwind)
      .catch((err: unknown) => {
        setNorthwindStatus("error", (err as Error).message);
      });
  }, [setNorthwind, setNorthwindStatus]);

  return null;
}
