"use client";

import { useEffect } from "react";
import { fetchNorthwind } from "@/lib/api";
import { useAppStore } from "@/lib/store";

// Mounted once in the root layout. Loads the workforce roster into the store
// as soon as the app boots so any route can read from useAppStore().
export default function NorthwindLoader() {
  const status = useAppStore((s) => s.northwindStatus);
  const setNorthwind = useAppStore((s) => s.setNorthwind);
  const setNorthwindStatus = useAppStore((s) => s.setNorthwindStatus);

  useEffect(() => {
    if (status !== "idle") return;
    const controller = new AbortController();
    setNorthwindStatus("loading");
    fetchNorthwind(controller.signal)
      .then(setNorthwind)
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setNorthwindStatus("error", (err as Error).message);
      });
    return () => controller.abort();
  }, [status, setNorthwind, setNorthwindStatus]);

  return null;
}
