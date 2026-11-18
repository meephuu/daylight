import { create } from "zustand";
import { bangkokDateTime } from "@/lib/bangkok";
import { addFocusSession } from "@/lib/db/focus";
import { queryClient } from "@/lib/queryClient";

/**
 * The Focus page's timer: focus, then a break, then focus again. It lives here, outside the page, so it
 * keeps running on other pages and while the window is hidden in the tray. Time is kept as the moment the
 * run ends (not a count of ticks), so a slowed-down or sleeping window never makes it drift. FocusService
 * (mounted once in Layout) ticks it, sets the tray and the alarm. Nothing starts on its own: after each
 * run the timer waits for play.
 */

export const FOCUS_KEY = ["focus"] as const;

export type FocusPhase = "focus" | "break";
export type FocusStatus = "idle" | "running" | "paused";

export const PHASE_LABELS: Record<FocusPhase, string> = {
  focus: "Focus",
  break: "Break",
};

export interface FocusSettings {
  focusMin: number;
  breakMin: number;
  /** Daily goal of focused time. */
  goalMin: number;
}

export const FOCUS_SETTING_KEYS: Record<keyof FocusSettings, string> = {
  focusMin: "focus_minutes",
  breakMin: "focus_break_minutes",
  goalMin: "focus_daily_goal_minutes",
};

export const FOCUS_DEFAULTS: FocusSettings = { focusMin: 25, breakMin: 5, goalMin: 240 };

export const FOCUS_LIMITS: Record<keyof FocusSettings, { min: number; max: number; step: number }> = {
  focusMin: { min: 5, max: 180, step: 5 },
  breakMin: { min: 1, max: 60, step: 1 },
  goalMin: { min: 30, max: 720, step: 30 },
};

/** The lengths offered before a run starts. */
export const LENGTH_PRESETS: Record<FocusPhase, number[]> = {
  focus: [15, 25, 45, 60, 90],
  break: [5, 10, 15, 20],
};

export function readFocusSettings(map: Record<string, string>): FocusSettings {
  const result = { ...FOCUS_DEFAULTS };
  for (const key of Object.keys(FOCUS_SETTING_KEYS) as (keyof FocusSettings)[]) {
    const value = Number(map[FOCUS_SETTING_KEYS[key]]);
    const { min, max } = FOCUS_LIMITS[key];
    if (Number.isFinite(value) && value > 0) result[key] = Math.min(max, Math.max(min, Math.round(value)));
  }
  return result;
}

export function phaseMs(settings: FocusSettings, phase: FocusPhase): number {
  return (phase === "focus" ? settings.focusMin : settings.breakMin) * 60_000;
}

export interface FocusTask {
  id: number;
  title: string;
  projectId: number | null;
}

/** Shortest and longest a run can be pushed with the - / + buttons. */
const MIN_RUN_MS = 60_000;
const MAX_RUN_MS = 180 * 60_000;
/** A focus run stopped early is kept only when it lasted at least this long. */
const MIN_LOGGED_MS = 60_000;

interface Persisted {
  phase: FocusPhase;
  status: FocusStatus;
  /** Full length of this run, including - / + changes. */
  durationMs: number;
  /** Time left while idle or paused. */
  remainingMs: number;
  /** When the run ends (Unix ms), while running. */
  endsAt: number | null;
  task: FocusTask | null;
  /** When this focus run first started (Bangkok "YYYY-MM-DD HH:MM:SS"). */
  startedAt: string | null;
  /** Time run before the latest start or resume (pauses excluded). */
  focusedMs: number;
  /** When it was last started or resumed (Unix ms), while running. */
  resumedAt: number | null;
  /** Focus mode: the Focus page gives the whole window to the timer. On when a run starts, off when it ends or on X. */
  focusMode: boolean;
}

interface FocusState extends Persisted {
  settings: FocusSettings;
  /** A focus session for a task just ran out: the page asks whether the task is done. */
  finished: FocusTask | null;
  setSettings: (settings: FocusSettings) => void;
  setTask: (task: FocusTask | null) => void;
  setPhase: (phase: FocusPhase) => void;
  /** Sets the length of a run that has not started yet. */
  setLength: (minutes: number) => void;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  adjust: (deltaMs: number) => void;
  stop: () => void;
  skip: () => void;
  /** Called every second (and by the tray alarm): ends the run once its time is up. */
  tick: (now?: number) => void;
  dismissFinished: () => void;
  setFocusMode: (on: boolean) => void;
  /** Reloads the saved timer (another window, e.g. the mini timer, follows the main one this way). */
  rehydrate: () => void;
}

const STORAGE_KEY = "focusTimer";

const FRESH: Persisted = {
  phase: "focus",
  status: "idle",
  durationMs: phaseMs(FOCUS_DEFAULTS, "focus"),
  remainingMs: phaseMs(FOCUS_DEFAULTS, "focus"),
  endsAt: null,
  task: null,
  startedAt: null,
  focusedMs: 0,
  resumedAt: null,
  focusMode: false,
};

/** The timer as it was, so a restart (or reload) carries on where it left off. */
function readPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return FRESH;
    const value = { ...FRESH, ...(JSON.parse(raw) as Partial<Persisted>) };
    // Saved by an earlier version with short and long breaks.
    if (value.phase !== "focus" && value.phase !== "break") value.phase = "break";
    return value;
  } catch {
    return FRESH;
  }
}

/** Time left in the run at `now`. */
export function remainingAt(state: Pick<Persisted, "status" | "endsAt" | "remainingMs">, now: number): number {
  return state.status === "running" && state.endsAt !== null ? Math.max(0, state.endsAt - now) : state.remainingMs;
}

/** True once a run has been started (or its time changed while running). */
export function isUnderway(state: Pick<Persisted, "status" | "startedAt">): boolean {
  return state.status !== "idle" || state.startedAt !== null;
}

/** Saves the focus run that is ending (breaks are not stored); resolves to the saved session's id. */
function logRun(state: Persisted, completed: boolean, endMs: number): Promise<number | null> {
  if (state.phase !== "focus" || !state.startedAt) return Promise.resolve(null);
  const ranMs = state.focusedMs + (state.status === "running" && state.resumedAt !== null ? Math.max(0, endMs - state.resumedAt) : 0);
  if (!completed && ranMs < MIN_LOGGED_MS) return Promise.resolve(null);
  return addFocusSession({
    taskId: state.task?.id ?? null,
    taskTitle: state.task?.title ?? null,
    projectId: state.task?.projectId ?? null,
    startedAt: state.startedAt,
    endedAt: bangkokDateTime(new Date(endMs)),
    plannedSeconds: state.durationMs / 1000,
    focusedSeconds: ranMs / 1000,
    completed,
  })
    .then((id) => {
      void queryClient.invalidateQueries({ queryKey: FOCUS_KEY });
      return id;
    })
    .catch((error: unknown) => {
      console.error("Could not save the focus session", error);
      return null;
    });
}

/** A fresh, waiting run of `phase`. */
function ready(settings: FocusSettings, phase: FocusPhase): Partial<Persisted> {
  const ms = phaseMs(settings, phase);
  return { phase, status: "idle", durationMs: ms, remainingMs: ms, endsAt: null, startedAt: null, focusedMs: 0, resumedAt: null, focusMode: false };
}

export const useFocusTimer = create<FocusState>((set, get) => ({
  ...readPersisted(),
  settings: FOCUS_DEFAULTS,
  finished: null,

  setSettings: (settings) => {
    const state = get();
    // A run that has not started yet takes the new length; one under way keeps its own.
    set(isUnderway(state) ? { settings } : { settings, ...ready(settings, state.phase) });
  },

  setTask: (task) => set({ task }),

  setPhase: (phase) => {
    const state = get();
    if (phase === state.phase && !isUnderway(state)) return;
    logRun(state, false, Date.now());
    set({ ...ready(state.settings, phase), finished: null });
  },

  setLength: (minutes) => {
    if (isUnderway(get())) return;
    const ms = Math.min(MAX_RUN_MS, Math.max(MIN_RUN_MS, minutes * 60_000));
    set({ durationMs: ms, remainingMs: ms });
  },

  start: () => {
    const state = get();
    if (state.status === "running") return;
    const now = Date.now();
    set({
      status: "running",
      endsAt: now + state.remainingMs,
      resumedAt: now,
      startedAt: state.startedAt ?? bangkokDateTime(new Date(now)),
      finished: null,
      // A fresh run opens focus mode; resuming leaves it as it was (closed with X stays closed).
      focusMode: state.startedAt === null ? true : state.focusMode,
    });
  },

  pause: () => {
    const state = get();
    if (state.status !== "running" || state.endsAt === null) return;
    const now = Date.now();
    set({
      status: "paused",
      remainingMs: Math.max(0, state.endsAt - now),
      endsAt: null,
      focusedMs: state.focusedMs + (state.resumedAt !== null ? now - state.resumedAt : 0),
      resumedAt: null,
    });
  },

  toggle: () => (get().status === "running" ? get().pause() : get().start()),

  adjust: (deltaMs) => {
    const state = get();
    const left = remainingAt(state, Date.now());
    const next = Math.min(MAX_RUN_MS, Math.max(MIN_RUN_MS, left + deltaMs));
    const change = next - left;
    if (change === 0) return;
    set({
      durationMs: isUnderway(state) ? Math.max(next, state.durationMs + change) : next,
      remainingMs: state.status === "running" ? state.remainingMs : next,
      endsAt: state.status === "running" && state.endsAt !== null ? state.endsAt + change : state.endsAt,
    });
  },

  stop: () => {
    const state = get();
    logRun(state, false, Date.now());
    set({ ...ready(state.settings, state.phase), finished: null });
  },

  skip: () => {
    const state = get();
    logRun(state, false, Date.now());
    set({ ...ready(state.settings, state.phase === "focus" ? "break" : "focus"), finished: null });
  },

  tick: (now = Date.now()) => {
    const state = get();
    if (state.status !== "running" || state.endsAt === null || now < state.endsAt) return;
    void logRun(state, true, state.endsAt);
    if (state.phase === "focus") set({ ...ready(state.settings, "break"), finished: state.task });
    else set({ ...ready(state.settings, "focus") });
  },

  dismissFinished: () => set({ finished: null }),

  setFocusMode: (on) => set({ focusMode: on && isUnderway(get()) }),

  rehydrate: () => set(readPersisted()),
}));

/** The mini timer window only shows the timer; the main window owns it (and its saved copy). */
export const IS_MINI_WINDOW = typeof window !== "undefined" && window.location.pathname === "/mini";

// Keep the timer across restarts (per PC; the history itself is in the database).
useFocusTimer.subscribe((state) => {
  if (IS_MINI_WINDOW) return;
  const persisted: Persisted = {
    phase: state.phase,
    status: state.status,
    durationMs: state.durationMs,
    remainingMs: state.remainingMs,
    endsAt: state.endsAt,
    task: state.task,
    startedAt: state.startedAt,
    focusedMs: state.focusedMs,
    resumedAt: state.resumedAt,
    focusMode: state.focusMode,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // The timer still works for this session without storage.
  }
});

/** Minutes and seconds (hours in front past an hour), as separate parts for the big clock. */
export function clockParts(ms: number): { hours: number; minutes: string; seconds: string } {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return {
    hours,
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(total % 60).padStart(2, "0"),
  };
}

/** 18:42, or 1:05:00 past an hour. */
export function formatClock(ms: number): string {
  const { hours, minutes, seconds } = clockParts(ms);
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

/** 2h 35m, 40m, 0m. */
export function formatFocused(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
