import { format, isBefore, isToday, isTomorrow, isValid, parseISO, startOfDay } from "date-fns";

/** Due dates are stored as local calendar dates, e.g. "2026-10-25". */
const DATE_FORMAT = "yyyy-MM-dd";

export function toDateString(date: Date): string {
  return format(date, DATE_FORMAT);
}

export function todayString(): string {
  return toDateString(new Date());
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const date = parseISO(dueDate);
  return isValid(date) && isBefore(date, startOfDay(new Date()));
}

export function formatDueDate(dueDate: string): string {
  const date = parseISO(dueDate);
  if (!isValid(date)) return dueDate;
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}
