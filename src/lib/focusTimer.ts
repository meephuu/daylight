import { create } from "zustand";

export type TimerPhase = "focus" | "shortBreak" | "longBreak";
export type TimerStatus = "idle" | "running" | "paused";

export interface TimerConfig {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** A long break replaces the short one after this many completed focus sessions. */
  sessionsUntilLongBreak: number;
}

export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
};

/** A finished (or ended-early) focus block waiting to be written to the database. */
export interface PendingSession {
  startedAt: string;
  durationMinutes: number;
  taskId: number | null;
  projectId: number | null;
}

const MIN_SAVED_MS = 60_000;

function phaseMs(phase: TimerPhase, config: TimerConfig): number {
  const minutes =
    phase === "focus"
      ? config.focusMinutes
      : phase === "shortBreak"
        ? config.shortBreakMinutes
        : config.longBreakMinutes;
  return minutes * 60_000;
}

/** Fields that put the timer into a fresh, not-yet-started phase. */
function idlePhase(phase: TimerPhase, config: TimerConfig) {
  const totalMs = phaseMs(phase, config);
  return {
    phase,
    status: "idle" as const,
    totalMs,
    remainingMs: totalMs,
    endsAt: null,
    startedAt: null,
  };
}

interface FocusTimerState {
  config: TimerConfig;
  phase: TimerPhase;
  status: TimerStatus;
  totalMs: number;
  /** Time left; only meaningful when not running (use `endsAt` while running). */
  remainingMs: number;
  /** Wall-clock end time in ms while running, so the countdown cannot drift. */
  endsAt: number | null;
  /** When the current focus block was first started (ISO), kept across pauses. */
  startedAt: string | null;
  taskId: number | null;
  projectId: number | null;
  /** Focus sessions completed since the app opened; decides when a long break is due. */
  completedFocus: number;
  pendingSave: PendingSession | null;
  /** Bumped whenever a phase finishes by itself, so the UI can play a chime. */
  completions: number;

  setConfig: (config: TimerConfig) => void;
  setTarget: (taskId: number | null, projectId: number | null) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Throw away the current phase without saving anything. */
  reset: () => void;
  /** End a focus block now and save the time done so far (if at least a minute). */
  finishEarly: () => void;
  skipBreak: () => void;
  tick: (now: number) => void;
  clearPendingSave: () => void;
}

export const useFocusTimer = create<FocusTimerState>((set, get) => ({
  config: DEFAULT_TIMER_CONFIG,
  ...idlePhase("focus", DEFAULT_TIMER_CONFIG),
  taskId: null,
  projectId: null,
  completedFocus: 0,
  pendingSave: null,
  completions: 0,

  setConfig: (config) => {
    const state = get();
    // New lengths apply immediately only if nothing is in progress.
    set(state.status === "idle" ? { config, ...idlePhase(state.phase, config) } : { config });
  },

  setTarget: (taskId, projectId) => set({ taskId, projectId }),

  start: () => {
    const state = get();
    if (state.status !== "idle") return;
    set({
      status: "running",
      endsAt: Date.now() + state.remainingMs,
      startedAt: state.phase === "focus" ? new Date().toISOString() : null,
    });
  },

  pause: () => {
    const { status, endsAt } = get();
    if (status !== "running" || endsAt === null) return;
    set({ status: "paused", remainingMs: Math.max(0, endsAt - Date.now()), endsAt: null });
  },

  resume: () => {
    const { status, remainingMs } = get();
    if (status !== "paused") return;
    set({ status: "running", endsAt: Date.now() + remainingMs });
  },

  reset: () => {
    const { phase, config } = get();
    set(idlePhase(phase, config));
  },

  finishEarly: () => {
    const state = get();
    if (state.phase !== "focus" || state.status === "idle") return;
    const remaining =
      state.status === "running" && state.endsAt !== null
        ? Math.max(0, state.endsAt - Date.now())
        : state.remainingMs;
    const elapsedMs = state.totalMs - remaining;
    set({
      ...idlePhase("focus", state.config),
      pendingSave:
        elapsedMs >= MIN_SAVED_MS
          ? {
              startedAt: state.startedAt ?? new Date(Date.now() - elapsedMs).toISOString(),
              durationMinutes: Math.round(elapsedMs / 60_000),
              taskId: state.taskId,
              projectId: state.projectId,
            }
          : state.pendingSave,
    });
  },

  skipBreak: () => {
    const { phase, config } = get();
    if (phase === "focus") return;
    set(idlePhase("focus", config));
  },

  tick: (now) => {
    const state = get();
    if (state.status !== "running" || state.endsAt === null || now < state.endsAt) return;

    if (state.phase === "focus") {
      const completedFocus = state.completedFocus + 1;
      const nextPhase =
        completedFocus % state.config.sessionsUntilLongBreak === 0 ? "longBreak" : "shortBreak";
      set({
        ...idlePhase(nextPhase, state.config),
        completedFocus,
        completions: state.completions + 1,
        pendingSave: {
          startedAt: state.startedAt ?? new Date(now - state.totalMs).toISOString(),
          durationMinutes: Math.max(1, Math.round(state.totalMs / 60_000)),
          taskId: state.taskId,
          projectId: state.projectId,
        },
      });
    } else {
      set({ ...idlePhase("focus", state.config), completions: state.completions + 1 });
    }
  },

  clearPendingSave: () => set({ pendingSave: null }),
}));

export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** 85 -> "1h 25m", 40 -> "40m". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export const PHASE_LABELS: Record<TimerPhase, string> = {
  focus: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

/** A short two-note chime; silently does nothing if audio is unavailable. */
export function playChime(): void {
  try {
    const context = new AudioContext();
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.22;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.55);
    });
    window.setTimeout(() => void context.close(), 1500);
  } catch {
    // Audio is a nicety; the timer still works without it.
  }
}
