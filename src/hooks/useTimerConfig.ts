import { useMemo } from "react";
import { useSettingsMap } from "@/hooks/useSettings";
import { DEFAULT_TIMER_CONFIG, type TimerConfig } from "@/lib/focusTimer";

export const TIMER_SETTING_KEYS = {
  focusMinutes: "focus_minutes",
  shortBreakMinutes: "short_break_minutes",
  longBreakMinutes: "long_break_minutes",
  sessionsUntilLongBreak: "sessions_until_long_break",
} as const;

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : fallback;
}

/** Timer lengths from the settings table, falling back to the classic 25/5/15 × 4. */
export function useTimerConfig(): TimerConfig {
  const { data } = useSettingsMap();
  return useMemo(
    () => ({
      focusMinutes: readPositiveInt(data?.[TIMER_SETTING_KEYS.focusMinutes], DEFAULT_TIMER_CONFIG.focusMinutes),
      shortBreakMinutes: readPositiveInt(
        data?.[TIMER_SETTING_KEYS.shortBreakMinutes],
        DEFAULT_TIMER_CONFIG.shortBreakMinutes,
      ),
      longBreakMinutes: readPositiveInt(
        data?.[TIMER_SETTING_KEYS.longBreakMinutes],
        DEFAULT_TIMER_CONFIG.longBreakMinutes,
      ),
      sessionsUntilLongBreak: readPositiveInt(
        data?.[TIMER_SETTING_KEYS.sessionsUntilLongBreak],
        DEFAULT_TIMER_CONFIG.sessionsUntilLongBreak,
      ),
    }),
    [data],
  );
}
