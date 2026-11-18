import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useFocusSettings } from "@/hooks/useFocus";
import { PHASE_LABELS, phaseMs, remainingAt, useFocusTimer } from "@/lib/focus";
import { shareSkyColors } from "@/lib/miniTimer";

/** Tauri calls fail in a plain browser (pnpm dev); the timer still works there, just without tray or alarm. */
function call(command: string, args: Record<string, unknown>) {
  invoke(command, args).catch(() => {});
}

/**
 * Runs the Focus timer for the whole app (renders nothing): ticks it, keeps the tray's tooltip and menu
 * in step, sets the alarm that shows a Windows notification when a run ends (kept in Rust, since the
 * window's own timers slow down while it is hidden), and answers the tray's Start / Pause / Skip.
 */
export function FocusService() {
  const settings = useFocusSettings();
  const setSettings = useFocusTimer((state) => state.setSettings);
  const status = useFocusTimer((state) => state.status);
  const phase = useFocusTimer((state) => state.phase);
  const endsAt = useFocusTimer((state) => state.endsAt);
  const remainingMs = useFocusTimer((state) => state.remainingMs);
  const task = useFocusTimer((state) => state.task);

  useEffect(() => setSettings(settings), [settings, setSettings]);

  // The mini timer wears the app's live sky colours. They are shared the moment they change: the sky
  // writes them on <html> (its style), and the theme switches them (its class / data attributes).
  useEffect(() => {
    shareSkyColors();
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(shareSkyColors);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class", "data-theme"] });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // Tick every second while running; a run that ended while the app was closed ends at once.
  useEffect(() => {
    useFocusTimer.getState().tick();
    if (status !== "running") return;
    const id = window.setInterval(() => useFocusTimer.getState().tick(), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // The alarm: a notification when this run ends.
  useEffect(() => {
    if (status !== "running" || endsAt === null) {
      call("focus_schedule", { atMs: 0, title: "", body: "" });
      return;
    }
    const title = phase === "focus" ? "Focus session done" : "Break's over";
    const body =
      phase === "focus"
        ? `${task ? `${task.title}. ` : ""}Time for a ${phaseMs(settings, "break") / 60_000}-minute break.`
        : "Ready for the next focus session?";
    call("focus_schedule", { atMs: Math.round(endsAt), title, body });
  }, [status, endsAt, phase, task, settings]);

  // The tray: "Focus · 18 min left" while it runs, and the menu item's Start / Pause label.
  useEffect(() => {
    const update = () => {
      const state = useFocusTimer.getState();
      const left = Math.ceil(remainingAt(state, Date.now()) / 60_000);
      const label = PHASE_LABELS[state.phase];
      const tooltip =
        state.status === "running"
          ? `Daylight · ${label} · ${left} min left`
          : state.status === "paused"
            ? `Daylight · ${label} paused · ${left} min left`
            : "Daylight";
      call("focus_tray", { tooltip, running: state.status === "running" });
    };
    update();
    if (status !== "running") return;
    const id = window.setInterval(update, 15_000);
    return () => window.clearInterval(id);
  }, [status, phase, endsAt, remainingMs]);

  // Tray menu presses and the alarm itself.
  useEffect(() => {
    let cancelled = false;
    const stops: (() => void)[] = [];
    const on = (event: string, handler: () => void) =>
      void listen(event, handler)
        .then((stop) => (cancelled ? stop() : stops.push(stop)))
        .catch(() => {});
    on("focus-toggle", () => useFocusTimer.getState().toggle());
    on("focus-skip", () => useFocusTimer.getState().skip());
    on("focus-ended", () => {
      const state = useFocusTimer.getState();
      // The alarm can fire a hair before this window's clock reaches the end; end the run regardless.
      if (state.endsAt !== null) state.tick(Math.max(Date.now(), state.endsAt));
    });
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, []);

  return null;
}
