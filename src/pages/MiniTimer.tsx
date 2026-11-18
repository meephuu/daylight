import { useEffect, useLayoutEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ArrowUpRight, Pause, Play, X } from "lucide-react";
import { useNow } from "@/components/focus/FocusStage";
import { formatClock, PHASE_LABELS, remainingAt, useFocusTimer } from "@/lib/focus";
import { applySharedSkyColors, sendTimerCommand, showMainWindow, SKY_COLORS_KEY } from "@/lib/miniTimer";
import { cn } from "@/lib/utils";

const ICON_BUTTON =
  "grid size-7 place-items-center rounded-full text-foreground/60 outline-none transition-colors hover:bg-foreground/12 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60";

const R = 22;
const STROKE = 4;

/**
 * The mini timer (its own small window, always on top of other apps; see lib/miniTimer.ts). A slab of
 * dark glass: the ring (in the app's live sky accent) with play / pause in it, the time, and what it is for. Close and "open
 * Daylight" come up on hover. Drag it anywhere. It follows the main window's timer through the saved copy
 * (the storage event) and sends its presses back as events, so the main window stays the only owner.
 */
export default function MiniTimer() {
  const timer = useFocusTimer();
  const running = timer.status === "running";
  const now = useNow(running);
  const left = remainingAt(timer, now);
  const progress = timer.durationMs > 0 ? left / timer.durationMs : 0;
  const onBreak = timer.phase === "break";

  // A see-through window: only the slab is drawn.
  useLayoutEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  // Follow the main window's timer, and its sky colours.
  useEffect(() => {
    applySharedSkyColors();
    const reload = () => {
      useFocusTimer.getState().rehydrate();
      applySharedSkyColors();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "focusTimer") useFocusTimer.getState().rehydrate();
      if (event.key === SKY_COLORS_KEY) applySharedSkyColors();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", reload);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", reload);
    };
  }, []);

  const label = timer.task && !onBreak ? timer.task.title : PHASE_LABELS[timer.phase];
  const circumference = 2 * Math.PI * R;

  return (
    <div className="dark h-screen w-screen p-1 text-foreground select-none">
      <div
        data-tauri-drag-region
        className="group relative flex h-full items-center gap-3 rounded-[22px] pr-3 pl-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_0_0_1px_rgb(255_255_255/0.08)]"
        style={{
          // The glass at 93%, coloured by the sky of this hour (shared by the main window as it changes):
          // its mid colour mixed into deep navy, with a faint wash of the hour's accent from the top left.
          background:
            "linear-gradient(160deg, color-mix(in srgb, var(--sky-accent) 14%, transparent), transparent 70%), color-mix(in srgb, color-mix(in srgb, var(--sky-mid) 40%, rgb(8 11 32)) 93%, transparent)",
        }}
      >
        {/* The ring, with play / pause inside it. */}
        <button
          type="button"
          onClick={() => sendTimerCommand("focus-toggle")}
          aria-label={running ? "Pause" : "Start"}
          title={running ? "Pause" : "Start"}
          className="relative grid size-14 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="28" cy="28" r={R} fill="none" strokeWidth={STROKE} className="stroke-white/10" />
            <circle
              cx="28"
              cy="28"
              r={R}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              className={cn(
                "stroke-sky-accent motion-reduce:transition-none",
                onBreak && "opacity-50",
                running ? "transition-[stroke-dashoffset] duration-1000 ease-linear" : "transition-[stroke-dashoffset] duration-500",
              )}
            />
          </svg>
          {running ? <Pause className="size-4" fill="currentColor" /> : <Play className="ml-0.5 size-4" fill="currentColor" />}
        </button>

        <div data-tauri-drag-region className="flex min-w-0 flex-1 flex-col">
          {/* Pure white at full strength, paused or not (the line below says "Paused"). */}
          <span data-tauri-drag-region className="display-num text-[30px] leading-none text-white tabular-nums">
            {formatClock(left)}
          </span>
          <span data-tauri-drag-region className="mt-1 truncate text-[12px] text-muted-foreground">
            {timer.status === "paused" ? `Paused · ${label}` : label}
          </span>
        </div>

        {/* On hover: back to Daylight, close. */}
        <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" className={ICON_BUTTON} onClick={showMainWindow} aria-label="Open Daylight" title="Open Daylight">
            <ArrowUpRight className="size-3.5" />
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            onClick={() => void getCurrentWindow().close().catch(() => {})}
            aria-label="Close the mini timer"
            title="Close the mini timer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
