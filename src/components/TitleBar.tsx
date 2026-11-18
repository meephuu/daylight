import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useNavigate } from "react-router-dom";
import { Copy, Maximize2, Minimize2, Minus, Square, Timer, X } from "lucide-react";
import { useNow } from "@/components/focus/FocusStage";
import { useAmbientMinutes } from "@/lib/ambient";
import { formatClock, isUnderway, PHASE_LABELS, remainingAt, useFocusTimer } from "@/lib/focus";
import { skyReadout } from "@/lib/sky";
import { cn } from "@/lib/utils";

interface TitleBarProps {
  /** Name of the page being shown. */
  section?: string;
}

/** The current window, or null outside the desktop app (a plain browser, tests). */
function appWindow() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

/**
 * While a Focus run is under way the middle of the title bar is its timer ("Focus · 18:42", or the task),
 * so it can be seen from any page; clicking it opens the Focus page.
 */
function FocusReadout() {
  const navigate = useNavigate();
  const timer = useFocusTimer();
  const running = timer.status === "running";
  const now = useNow(running);
  const left = remainingAt(timer, now);
  const label = timer.task && timer.phase === "focus" ? timer.task.title : PHASE_LABELS[timer.phase];
  return (
    <button
      type="button"
      onClick={() => navigate("/focus")}
      title="Open Focus"
      className="flex max-w-[360px] min-w-0 items-center gap-2 rounded-full px-3 py-1 text-xs text-foreground/80 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Timer className={cn("size-3.5 shrink-0 text-sky-accent", !running && "opacity-60")} aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
      <span aria-hidden="true">·</span>
      <span className={cn("shrink-0 font-semibold tabular-nums", !running && "text-foreground/55")}>
        {formatClock(left)}
        {timer.status === "paused" && " paused"}
      </span>
    </button>
  );
}

/**
 * The window's own title bar, drawn by the app so it sits on the sky with everything else (the native
 * one is switched off in tauri.conf.json). Dragging it moves the window, double-clicking it maximises.
 * The middle carries the live sky readout. The close button hides the window to the tray.
 *
 * Full screen (the button on the right, or F11) fills the whole screen with the app, taskbar included.
 * In full screen the bar stays, so the sky readout and the way back are always there, but it no longer
 * moves the window, and minimise / maximise give way to "Exit full screen".
 */
export function TitleBar({ section }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const minutes = useAmbientMinutes();
  const focusUnderway = useFocusTimer(isUnderway);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    const win = appWindow();
    if (!win) return;
    const sync = () => {
      win
        .isMaximized()
        .then((value) => !cancelled && setMaximized(Boolean(value)))
        .catch(() => undefined);
      win
        .isFullscreen()
        .then((value) => !cancelled && setFullscreen(Boolean(value)))
        .catch(() => undefined);
    };
    sync();
    win
      .onResized(sync)
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const win = appWindow();
    if (!win) return;
    try {
      const next = !(await win.isFullscreen());
      await win.setFullscreen(next);
      setFullscreen(next);
    } catch {
      // The window refused; the bar keeps showing the real state on the next resize.
    }
  }, []);

  // F11 toggles full screen, as it does in Windows apps and browsers.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "F11" || event.repeat) return;
      event.preventDefault();
      void toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  function run(action: "minimize" | "toggleMaximize" | "close") {
    void appWindow()?.[action]().catch(() => undefined);
  }

  // In full screen there is no window to drag or maximise, so the bar is not a drag region.
  const drag = fullscreen ? {} : { "data-tauri-drag-region": true };

  const buttonClass =
    "inline-flex h-full w-11 items-center justify-center text-foreground/70 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:bg-foreground/10 focus-visible:text-foreground";

  return (
    <header {...drag} className="relative z-40 grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center select-none">
      <div {...drag} className="flex min-w-0 items-center pl-5 text-xs">
        <span {...drag} className="truncate font-semibold text-foreground/85">
          {section ?? "Daylight"}
        </span>
      </div>

      {focusUnderway ? (
        <FocusReadout />
      ) : (
        <div {...drag} className="flex items-center gap-2 text-xs text-foreground/75">
          <span {...drag} aria-hidden="true" className="size-2 rounded-full bg-sky-accent shadow-[0_0_10px_1px_var(--sky-accent)]" />
          <span {...drag} className="tabular-nums" aria-live="off">
            {skyReadout(minutes)}
          </span>
        </div>
      )}

      <div className="flex h-full justify-end">
        <button
          type="button"
          className={buttonClass}
          onClick={() => void toggleFullscreen()}
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
          title={fullscreen ? "Exit full screen (F11)" : "Full screen (F11)"}
        >
          {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        {!fullscreen && (
          <>
            <button type="button" className={buttonClass} onClick={() => run("minimize")} aria-label="Minimize" title="Minimize">
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => run("toggleMaximize")}
              aria-label={maximized ? "Restore" : "Maximize"}
              title={maximized ? "Restore" : "Maximize"}
            >
              {maximized ? <Copy className="size-3.5 -scale-x-100" /> : <Square className="size-3.5" />}
            </button>
          </>
        )}
        <button
          type="button"
          className={cn(buttonClass, "hover:bg-destructive hover:text-white focus-visible:bg-destructive focus-visible:text-white")}
          onClick={() => run("close")}
          aria-label="Close to tray"
          title="Close (keeps running in the tray)"
        >
          <X className="size-4" />
        </button>
      </div>
    </header>
  );
}
