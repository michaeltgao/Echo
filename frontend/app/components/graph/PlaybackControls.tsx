"use client";

import { useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";

// Single horizontal control bar above the org graph. Three states:
//   Setup    — big amber PLAY CTA prompts the user to start the simulation
//   Playing  — small Pause pill, active scrubber, day counter advancing
//   Settled  — Restart prominent, scrubber pinned at end

export default function PlaybackControls() {
  const result = useAppStore((s) => s.result);
  const currentDay = useAppStore((s) => s.currentDay);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const setCurrentDay = useAppStore((s) => s.setCurrentDay);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const clearAnimations = useAppStore((s) => s.clearAnimations);

  const totalDays = result?.snapshots.length ?? 30;
  const lastDay = Math.max(0, totalDays - 1);
  const dayInt = Math.min(lastDay, Math.floor(currentDay));
  const atStart = currentDay <= 0.001;
  const atEnd = currentDay >= lastDay - 0.001;

  const ready = result !== null;

  const handlePlay = useCallback(() => {
    if (!ready) return;
    if (atEnd) {
      // Restart from beginning
      clearAnimations();
      setCurrentDay(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying(true);
  }, [ready, atEnd, clearAnimations, setCurrentDay, setIsPlaying]);

  const handlePause = useCallback(() => setIsPlaying(false), [setIsPlaying]);

  const handleRestart = useCallback(() => {
    clearAnimations();
    setCurrentDay(0);
    setIsPlaying(false);
  }, [clearAnimations, setCurrentDay, setIsPlaying]);

  return (
    <div className="flex flex-col gap-4">
      {/* Day-counter row + restart */}
      <div className="flex items-baseline justify-between gap-4">
        <div className="font-mono text-[12.5px] tracking-[0.16em] uppercase text-bone-faint flex items-baseline gap-3">
          <span>Timeline</span>
          <span className="text-bone-dim">/</span>
          <span className="tabular-nums text-bone">
            <span className={atStart ? "text-bone-faint" : "text-amber-bright"}>
              Day {String(dayInt).padStart(2, "0")}
            </span>
            <span className="text-bone-dim"> / {totalDays}</span>
          </span>
        </div>
        {!atStart && (
          <button
            type="button"
            onClick={handleRestart}
            className="font-mono text-[11px] tracking-[0.18em] uppercase text-bone-faint hover:text-amber transition-colors flex items-center gap-2"
          >
            <span aria-hidden>↺</span>
            <span>Restart</span>
          </button>
        )}
      </div>

      {/* Scrubber + play */}
      <div className="flex items-center gap-5">
        {/* Play / Pause primary */}
        {!isPlaying ? (
          <PlayButton
            ready={ready}
            atStart={atStart}
            atEnd={atEnd}
            onClick={handlePlay}
          />
        ) : (
          <PauseButton onClick={handlePause} />
        )}

        {/* Scrubber */}
        <Scrubber
          currentDay={currentDay}
          lastDay={lastDay}
          disabled={!ready}
          onChange={(v) => {
            setCurrentDay(v);
            // Pause when user drags to a new spot manually
            if (isPlaying) setIsPlaying(false);
          }}
        />
      </div>
    </div>
  );
}

function PlayButton({
  ready,
  atStart,
  atEnd,
  onClick,
}: {
  ready: boolean;
  atStart: boolean;
  atEnd: boolean;
  onClick: () => void;
}) {
  // BIG amber CTA in setup; smaller pill once playback has begun & paused.
  if (atStart) {
    return (
      <button
        type="button"
        disabled={!ready}
        onClick={onClick}
        className="group inline-flex items-center gap-3 bg-amber text-ink px-6 py-3 rounded-[2px] font-mono text-[12px] tracking-[0.18em] uppercase font-medium hover:bg-amber-bright transition-colors disabled:opacity-50 disabled:cursor-wait"
      >
        <PlayIcon />
        <span>{ready ? "Play the sample" : "Loading…"}</span>
      </button>
    );
  }
  // Mid-timeline (paused) → smaller "resume" pill
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-2.5 border border-amber/60 text-amber-bright hover:bg-amber/[0.08] px-4 py-2 rounded-[2px] font-mono text-[11px] tracking-[0.18em] uppercase transition-colors"
    >
      <PlayIcon small />
      <span>{atEnd ? "Replay" : "Resume"}</span>
    </button>
  );
}

function PauseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2.5 border border-hairline-strong text-bone hover:border-amber/60 hover:text-amber-bright px-4 py-2 rounded-[2px] font-mono text-[11px] tracking-[0.18em] uppercase transition-colors"
    >
      <PauseIcon />
      <span>Pause</span>
    </button>
  );
}

function PlayIcon({ small }: { small?: boolean }) {
  const size = small ? 9 : 11;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden
    >
      <path d="M1 0.5 L9 5 L1 9.5 Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <rect x={1} y={1} width={2.5} height={8} rx={0.5} />
      <rect x={6.5} y={1} width={2.5} height={8} rx={0.5} />
    </svg>
  );
}

function Scrubber({
  currentDay,
  lastDay,
  disabled,
  onChange,
}: {
  currentDay: number;
  lastDay: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const pct = lastDay > 0 ? (currentDay / lastDay) * 100 : 0;

  const computeFromEvent = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || lastDay <= 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onChange(ratio * lastDay);
    },
    [lastDay, onChange],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      draggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      computeFromEvent(e.clientX);
    },
    [disabled, computeFromEvent],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      computeFromEvent(e.clientX);
    },
    [computeFromEvent],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
    [],
  );

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={lastDay}
      aria-valuenow={currentDay}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "ArrowRight") onChange(Math.min(lastDay, currentDay + 1));
        if (e.key === "ArrowLeft") onChange(Math.max(0, currentDay - 1));
      }}
      className={`relative flex-1 h-7 cursor-pointer flex items-center ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      }`}
    >
      {/* Track */}
      <div className="absolute inset-x-0 h-px bg-hairline-strong" />
      {/* Filled portion */}
      <div
        className="absolute left-0 h-px bg-amber/70"
        style={{ width: `${pct}%` }}
      />
      {/* Knob */}
      <div
        className="absolute h-2.5 w-2.5 rounded-full bg-amber-bright shadow-[0_0_8px_rgba(219,160,63,0.55)]"
        style={{ left: `calc(${pct}% - 5px)` }}
      />
    </div>
  );
}
