import { differenceInCalendarDays, parseISO } from "date-fns";

/** The chosen task ids live in the settings table as a comma separated list, e.g. "4,12,9". */
export const COUNTDOWN_KEY = "countdown_task_ids";

/** How many tasks the panel can show at once. */
export const MAX_COUNTDOWN_TASKS = 3;

export function parseCountdownIds(raw: string | undefined): number[] {
  if (!raw) return [];
  const ids = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)].slice(0, MAX_COUNTDOWN_TASKS);
}

export function serializeCountdownIds(ids: number[]): string {
  return ids.join(",");
}

/** Whole calendar days from `today` to `dueDate` (both "YYYY-MM-DD"); negative once overdue. */
export function daysUntil(dueDate: string, today: string): number {
  return differenceInCalendarDays(parseISO(dueDate), parseISO(today));
}

export type CountdownTone = "overdue" | "today" | "soon" | "later";

/** "soon" is the last 3 days; it is what turns the number amber. */
export function countdownTone(days: number): CountdownTone {
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return days <= 3 ? "soon" : "later";
}

export function countdownLabel(days: number): string {
  if (days < 0) return Math.abs(days) === 1 ? "day overdue" : "days overdue";
  if (days === 0) return "due today";
  return days === 1 ? "day left" : "days left";
}

/**
 * How far along the way to the deadline it is, 0 to 1, counted from the day the task was added.
 * A task added on its due day (or later) is simply "full".
 */
export function elapsedFraction(createdAt: string, dueDate: string, today: string): number {
  const start = createdAt.slice(0, 10);
  const total = differenceInCalendarDays(parseISO(dueDate), parseISO(start));
  if (total <= 0) return 1;
  const passed = differenceInCalendarDays(parseISO(today), parseISO(start));
  return Math.min(1, Math.max(0, passed / total));
}
