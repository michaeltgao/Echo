"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";

// rAF-driven playback. While `isPlaying` is true, advances `currentDay` from
// 0 to lastDay over `playbackMs` (default 3000ms). When it reaches the end,
// auto-pauses and clamps to the final day.
//
// The hook updates store state every frame, so any subscriber (AgentNode for
// sentiment color, edges for highlights, etc.) re-renders smoothly.
export function usePlayback() {
  const isPlaying = useAppStore((s) => s.isPlaying);
  const playbackMs = useAppStore((s) => s.playbackMs);
  const setCurrentDay = useAppStore((s) => s.setCurrentDay);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const result = useAppStore((s) => s.result);

  const startTimeRef = useRef<number | null>(null);
  const startDayRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying || !result || !result.snapshots?.length) return;
    const lastDay = result.snapshots.length - 1;

    // Capture starting position so play resumes from the current scrubbed day.
    startTimeRef.current = null;
    startDayRef.current = useAppStore.getState().currentDay;

    const tick = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;
      const startDay = startDayRef.current;
      // Total time to traverse remaining days at the configured speed.
      const remainingFrac = (lastDay - startDay) / lastDay;
      const totalMs = Math.max(1, playbackMs * remainingFrac);
      const t = Math.min(1, elapsed / totalMs);
      const day = startDay + (lastDay - startDay) * t;
      setCurrentDay(day);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setIsPlaying(false);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, playbackMs, result, setCurrentDay, setIsPlaying]);
}
