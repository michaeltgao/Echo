"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { ACTION_DURATION_MS, type ActiveAnimation } from "./animations";

// Watches `currentDay` advancing during playback and enqueues animations
// for actions whose day has just been reached. Also runs an rAF loop that
// expires completed animations and promotes anything waiting in the queue.
export function useActionAnimator() {
  const result = useAppStore((s) => s.result);
  const day = useAppStore((s) => s.currentDay);

  const enqueueAnimations = useAppStore((s) => s.enqueueAnimations);
  const expireAnimations = useAppStore((s) => s.expireAnimations);
  const clearAnimations = useAppStore((s) => s.clearAnimations);

  const lastEnqueuedDayRef = useRef<number>(-1);

  // Reset state when a new result lands (or is cleared).
  useEffect(() => {
    lastEnqueuedDayRef.current = -1;
    clearAnimations();
  }, [result, clearAnimations]);

  // When `day` advances, find newly-crossed action days and enqueue them.
  useEffect(() => {
    if (!result?.actions?.length) return;
    const dayInt = Math.floor(day);
    if (dayInt <= lastEnqueuedDayRef.current) return;

    const fromDay = lastEnqueuedDayRef.current + 1;
    const toDay = dayInt;
    const now = performance.now();
    const incoming: ActiveAnimation[] = [];
    for (const a of result.actions) {
      if (a.day >= fromDay && a.day <= toDay && a.action_type !== "DO_NOTHING") {
        incoming.push({
          id: a.id,
          action: a,
          startedAt: now,
          duration: ACTION_DURATION_MS[a.action_type] ?? 700,
        });
      }
    }
    if (incoming.length > 0) enqueueAnimations(incoming);
    lastEnqueuedDayRef.current = toDay;
  }, [day, result, enqueueAnimations]);

  // rAF loop — keep ticking while there are any animations or the queue is non-empty.
  useEffect(() => {
    let raf: number | null = null;
    const tick = () => {
      const st = useAppStore.getState();
      const hasWork =
        st.activeAnimations.length > 0 || st.animationQueue.length > 0;
      if (!hasWork) {
        raf = null;
        return;
      }
      expireAnimations(performance.now());
      raf = requestAnimationFrame(tick);
    };
    // Subscribe so we wake up the loop whenever the active list changes.
    const unsub = useAppStore.subscribe((s, prev) => {
      const has = s.activeAnimations.length + s.animationQueue.length;
      const had = prev.activeAnimations.length + prev.animationQueue.length;
      if (has > 0 && had === 0 && raf === null) {
        raf = requestAnimationFrame(tick);
      }
    });
    // Kick off immediately if there's already work.
    if (
      useAppStore.getState().activeAnimations.length > 0 ||
      useAppStore.getState().animationQueue.length > 0
    ) {
      raf = requestAnimationFrame(tick);
    }
    return () => {
      unsub();
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [expireAnimations]);
}
