import { getDaysInMonth, parseISO } from "date-fns";
import type { CalendarItem, OccurrenceState, OccurrenceStateRow } from "@/lib/db/calendarItems";

/** Weekday index of a "YYYY-MM-DD" date: 0 = Sunday ... 6 = Saturday. */
function weekdayOf(date: string): number {
  return parseISO(date).getDay();
}

/** Day of month an item lands on in the month of `date`, clamped for short months (31st -> 30th/28th). */
function clampedDay(startDay: number, date: Date): number {
  return Math.min(startDay, getDaysInMonth(date));
}

/** Does this item (or one of its repeats) fall on `date`? Skipped days are handled separately. */
export function occursOn(item: CalendarItem, date: string): boolean {
  if (date < item.startDate) return false;
  if (item.repeatRule === "none") return date === item.startDate;
  if (item.repeatUntil !== null && date > item.repeatUntil) return false;

  const day = parseISO(date);
  const start = parseISO(item.startDate);
  switch (item.repeatRule) {
    case "weekly": {
      const weekdays = item.repeatWeekdays.length > 0 ? item.repeatWeekdays : [weekdayOf(item.startDate)];
      return weekdays.includes(weekdayOf(date));
    }
    case "monthly":
      return day.getDate() === clampedDay(start.getDate(), day);
    case "yearly":
      // 29 Feb falls back to 28 Feb in non-leap years.
      return day.getMonth() === start.getMonth() && day.getDate() === clampedDay(start.getDate(), day);
  }
}

export interface Occurrence {
  item: CalendarItem;
  /** The day this occurrence is on, "YYYY-MM-DD". */
  date: string;
  /** "done" for a ticked-off reminder; skipped occurrences are never returned. */
  state: OccurrenceState | null;
}

export function stateKey(itemId: number, date: string): string {
  return `${itemId}|${date}`;
}

export function stateMap(rows: OccurrenceStateRow[]): Map<string, OccurrenceState> {
  return new Map(rows.map((row) => [stateKey(row.itemId, row.date), row.state]));
}

/** Everything happening on `date`, skipped days left out. */
export function occurrencesOn(
  items: CalendarItem[],
  date: string,
  states: Map<string, OccurrenceState>,
): Occurrence[] {
  const result: Occurrence[] = [];
  for (const item of items) {
    if (!occursOn(item, date)) continue;
    const state = states.get(stateKey(item.id, date)) ?? null;
    if (state === "skipped") continue;
    result.push({ item, date, state });
  }
  return result;
}

/** "HH:MM" -> minutes after midnight, or null. */
export function timeToMinutes(time: string | null): number | null {
  if (time === null) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "09:00" or "09:00 – 10:30"; null for all-day items. */
export function formatTimeRange(startTime: string | null, endTime: string | null): string | null {
  if (startTime === null) return null;
  return endTime === null ? startTime : `${startTime} – ${endTime}`;
}

export const DEFAULT_EVENT_COLOR = "#3b82f6";

export const REPEAT_LABELS: Record<CalendarItem["repeatRule"], string> = {
  none: "Does not repeat",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};
