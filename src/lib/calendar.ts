import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type CalendarMode = "month" | "week" | "day";

/** The calendar's weeks run Sunday to Saturday. */
const WEEK_OPTIONS = { weekStartsOn: 0 } as const;

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Every day shown for the cursor date: the full weeks covering the month, one week, or one day. */
export function getVisibleDays(mode: CalendarMode, cursor: Date): Date[] {
  if (mode === "day") return [cursor];
  if (mode === "week") {
    return eachDayOfInterval({
      start: startOfWeek(cursor, WEEK_OPTIONS),
      end: endOfWeek(cursor, WEEK_OPTIONS),
    });
  }
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), WEEK_OPTIONS),
    end: endOfWeek(endOfMonth(cursor), WEEK_OPTIONS),
  });
}

export function shiftCursor(mode: CalendarMode, cursor: Date, direction: 1 | -1): Date {
  if (mode === "day") return addDays(cursor, direction);
  return mode === "month" ? addMonths(cursor, direction) : addWeeks(cursor, direction);
}

export function formatRangeTitle(mode: CalendarMode, days: Date[], cursor: Date): string {
  if (mode === "month") return format(cursor, "MMMM yyyy");
  if (mode === "day") return format(cursor, "EEEE, MMMM d");
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return format(cursor, "MMMM yyyy");
  const sameMonth = first.getMonth() === last.getMonth();
  return `${format(first, "MMM d")} – ${format(last, sameMonth ? "d, yyyy" : "MMM d, yyyy")}`;
}

/** The Sunday-to-Saturday week around a date (the Day view's week strip). */
export function weekOf(day: Date): Date[] {
  return eachDayOfInterval({ start: startOfWeek(day, WEEK_OPTIONS), end: endOfWeek(day, WEEK_OPTIONS) });
}
