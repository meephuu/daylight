import { addDays, parseISO, startOfWeek } from "date-fns";
import { toDateString } from "@/lib/dates";
import type { Habit, HabitFrequency, HabitLog } from "@/lib/db/habits";

export function groupLogsByHabit(logs: HabitLog[]): Map<number, HabitLog[]> {
  const groups = new Map<number, HabitLog[]>();
  for (const log of logs) {
    const list = groups.get(log.habitId);
    if (list) list.push(log);
    else groups.set(log.habitId, [log]);
  }
  return groups;
}

export function logCountsByDate(logs: HabitLog[]): Map<string, number> {
  return new Map(logs.map((log) => [log.date, log.count]));
}

/** Daily habits are counted per day, weekly habits per Sunday-to-Saturday week. */
function periodKey(frequency: HabitFrequency, date: string): string {
  return frequency === "daily" ? date : toDateString(startOfWeek(parseISO(date), { weekStartsOn: 0 }));
}

export interface StreakInfo {
  /** Consecutive periods (days or weeks) that met the target, up to now. */
  current: number;
  best: number;
  /** Total logged in the current period (today, or this week). */
  currentTotal: number;
  currentMet: boolean;
}

/**
 * A streak is not broken until a period ends without meeting its target, so an unfinished
 * today (or this week) neither counts nor resets the streak.
 */
export function computeStreak(habit: Habit, logs: HabitLog[], today: string): StreakInfo {
  const totals = new Map<string, number>();
  for (const log of logs) {
    const key = periodKey(habit.frequency, log.date);
    totals.set(key, (totals.get(key) ?? 0) + log.count);
  }

  const stepDays = habit.frequency === "daily" ? 1 : 7;
  const shift = (key: string, direction: 1 | -1) =>
    toDateString(addDays(parseISO(key), direction * stepDays));
  const isMet = (key: string) => (totals.get(key) ?? 0) >= habit.targetPerPeriod;

  const currentKey = periodKey(habit.frequency, today);
  let key = isMet(currentKey) ? currentKey : shift(currentKey, -1);
  let current = 0;
  while (isMet(key)) {
    current += 1;
    key = shift(key, -1);
  }

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const metKey of [...totals.keys()].filter(isMet).sort()) {
    run = previous !== null && shift(previous, 1) === metKey ? run + 1 : 1;
    best = Math.max(best, run);
    previous = metKey;
  }

  return {
    current,
    best,
    currentTotal: totals.get(currentKey) ?? 0,
    currentMet: isMet(currentKey),
  };
}

/** Most logs a single day can hold before cycling back to zero (heatmap click). */
export function dailyCap(habit: Habit): number {
  return Math.max(habit.targetPerPeriod, 1);
}

export function nextCount(count: number, cap: number): number {
  return count >= cap ? 0 : count + 1;
}
