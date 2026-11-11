import { addDays, parseISO, startOfWeek } from "date-fns";
import { toDateString } from "@/lib/dates";
import type { Habit, HabitLog } from "@/lib/db/habits";
import type { Task } from "@/lib/db/tasks";

export interface WeekRange {
  /** Sunday, "YYYY-MM-DD". */
  start: string;
  /** Saturday, "YYYY-MM-DD". */
  end: string;
  /** The seven days, Sunday first. */
  days: string[];
}

export function weekRange(cursor: Date): WeekRange {
  const sunday = startOfWeek(cursor, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, index) => toDateString(addDays(sunday, index)));
  return { start: days[0] ?? toDateString(sunday), end: days[6] ?? toDateString(sunday), days };
}

function inRange(date: string, range: WeekRange): boolean {
  return date >= range.start && date <= range.end;
}

/** Stored timestamps are UTC ISO strings; weeks are judged by the local calendar day. */
function localDate(iso: string): string {
  return toDateString(parseISO(iso));
}

export function completedInWeek(tasks: Task[], range: WeekRange): Task[] {
  return tasks
    .filter((task) => task.completedAt !== null && inRange(localDate(task.completedAt), range))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
}

/**
 * Tasks due this week whose due day has passed without being finished on time: still open,
 * or completed after the due date.
 */
export function slippedInWeek(tasks: Task[], range: WeekRange, today: string): Task[] {
  return tasks
    .filter((task) => {
      if (task.dueDate === null || !inRange(task.dueDate, range) || task.dueDate >= today) return false;
      const doneOnTime =
        task.status === "done" && task.completedAt !== null && localDate(task.completedAt) <= task.dueDate;
      return !doneOnTime;
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

/** "pending" is today while still unmet: not yet a miss, and left out of the score. */
export type HabitDayStatus = "met" | "logged" | "missed" | "pending" | "future" | "before";

export interface HabitWeek {
  habit: Habit;
  days: HabitDayStatus[];
  /** Daily habits: days that met the target. Weekly habits: total logged in the week. */
  achieved: number;
  /** Daily habits: days that could have counted. Weekly habits: the weekly target. */
  possible: number;
  /** 0-1, or null when nothing could be judged yet (e.g. habit created later, or a future week). */
  ratio: number | null;
}

export function habitWeek(habit: Habit, logs: HabitLog[], range: WeekRange, today: string): HabitWeek {
  const counts = new Map(logs.map((log) => [log.date, log.count]));
  const created = localDate(habit.createdAt);

  const days: HabitDayStatus[] = range.days.map((date) => {
    if (date > today) return "future";
    if (date < created) return "before";
    const count = counts.get(date) ?? 0;
    const unmet = date === today ? "pending" : "missed";
    if (habit.frequency === "daily") return count >= habit.targetPerPeriod ? "met" : unmet;
    return count > 0 ? "logged" : unmet;
  });

  if (habit.frequency === "daily") {
    const possible = days.filter((day) => day === "met" || day === "missed").length;
    const achieved = days.filter((day) => day === "met").length;
    return { habit, days, achieved, possible, ratio: possible === 0 ? null : achieved / possible };
  }

  const total = range.days.reduce((sum, date) => sum + (counts.get(date) ?? 0), 0);
  const started = range.days.some((date) => date <= today && date >= created);
  return {
    habit,
    days,
    achieved: total,
    possible: habit.targetPerPeriod,
    ratio: started ? Math.min(total / habit.targetPerPeriod, 1) : null,
  };
}

/** Average of the individual habit ratios, or null when no habit could be judged. */
export function overallConsistency(weeks: HabitWeek[]): number | null {
  const ratios = weeks.map((week) => week.ratio).filter((ratio): ratio is number => ratio !== null);
  if (ratios.length === 0) return null;
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
}
