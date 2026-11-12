import { useEffect, useState } from "react";
import { create } from "zustand";

/**
 * Shows the slide-up "time of day" tester (bottom right), which can scrub the sky through a whole day.
 * The sky itself always follows the real clock while the tester is not overriding it.
 */
export const SHOW_TIME_DEBUG_PANEL = true;

const MINUTES_PER_DAY = 24 * 60;
const at = (hours: number, minutes = 0) => hours * 60 + minutes;

export function periodName(minutes: number): "Morning" | "Afternoon" | "Evening" | "Night" {
  const time = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (time >= at(5) && time < at(12)) return "Morning";
  if (time >= at(12) && time < at(16)) return "Afternoon";
  if (time >= at(16) && time < at(20)) return "Evening";
  return "Night";
}

export function formatMinutes(minutes: number): string {
  const time = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
}

interface AmbientTimeState {
  /** Minutes after midnight forced by the tester, or null to follow the real clock. */
  override: number | null;
  setOverride: (minutes: number | null) => void;
}

export const useAmbientTime = create<AmbientTimeState>((set) => ({
  override: null,
  setOverride: (override) => set({ override }),
}));

interface WeatherState {
  /** Rain over the sky (switched from the time tester for now; not saved). */
  rain: boolean;
  setRain: (rain: boolean) => void;
}

export const useWeather = create<WeatherState>((set) => ({
  rain: false,
  setRain: (rain) => set({ rain }),
}));

// Development only: lets screenshot scripts scrub the sky (`__daylight.setSkyTime(18 * 60)`).
if (import.meta.env.DEV) {
  (window as unknown as { __daylight?: Record<string, unknown> }).__daylight = {
    ...(window as unknown as { __daylight?: Record<string, unknown> }).__daylight,
    setSkyTime: (minutes: number | null) => useAmbientTime.getState().setOverride(minutes),
    setRain: (on: boolean) => useWeather.getState().setRain(on),
  };
}

const NIGHT_STARS_KEY = "nightStars";

function readNightStars(): boolean {
  try {
    return localStorage.getItem(NIGHT_STARS_KEY) !== "off";
  } catch {
    return true;
  }
}

interface AmbientPrefsState {
  /** Show the twinkling stars at night. On by default. */
  nightStars: boolean;
  setNightStars: (on: boolean) => void;
}

export const useAmbientPrefs = create<AmbientPrefsState>((set) => ({
  nightStars: readNightStars(),
  setNightStars: (on) => {
    try {
      localStorage.setItem(NIGHT_STARS_KEY, on ? "on" : "off");
    } catch {
      // The choice still applies for this session if storage is unavailable.
    }
    set({ nightStars: on });
  },
}));

function realMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

/** The time the sky should show: the tester's value if set, otherwise the real clock. */
export function useAmbientMinutes(): number {
  const override = useAmbientTime((state) => state.override);
  const [real, setReal] = useState(realMinutes);

  useEffect(() => {
    const id = window.setInterval(() => setReal(realMinutes()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return override ?? real;
}
