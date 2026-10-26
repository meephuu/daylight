import { daysInMonthKey, shiftMonthKey } from "@/lib/bangkok";

export type Frequency = "monthly" | "weekly";

export interface RecurringSchedule {
  frequency: Frequency;
  /** 1-31; used when monthly. A month without that day uses its last day. */
  dayOfMonth: number | null;
  /** 0-6, Sunday first; used when weekly. */
  weekday: number | null;
  startDate: string;
}

/** Safety net so a rule that starts years ago cannot create thousands of entries in one go. */
const MAX_DATES = 500;

function parseDate(date: string): { year: number; month: number; day: number } {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return { year, month, day };
}

/** All date maths runs on UTC midnights of plain dates, so the PC's timezone and DST never matter. */
function toUtc(date: string): number {
  const { year, month, day } = parseDate(date);
  return Date.UTC(year, month - 1, day);
}

function fromUtc(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * 86_400_000);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function lastDayOfMonth(monthKey: string): string {
  return `${monthKey}-${String(daysInMonthKey(monthKey)).padStart(2, "0")}`;
}

/**
 * The dates a rule falls due on, after `afterDate` (exclusive, or null for "from the start") up to and
 * including `throughDate`, oldest first.
 */
export function dueDates(
  schedule: RecurringSchedule,
  afterDate: string | null,
  throughDate: string,
  limit: number = MAX_DATES,
): string[] {
  const afterNext = afterDate === null ? null : addDays(afterDate, 1);
  const lower = afterNext !== null && afterNext > schedule.startDate ? afterNext : schedule.startDate;
  if (lower > throughDate) return [];

  const dates: string[] = [];
  if (schedule.frequency === "weekly") {
    if (schedule.weekday === null) return [];
    let current = addDays(lower, (schedule.weekday - weekdayOf(lower) + 7) % 7);
    while (current <= throughDate && dates.length < limit) {
      dates.push(current);
      current = addDays(current, 7);
    }
    return dates;
  }

  if (schedule.dayOfMonth === null) return [];
  const lastKey = throughDate.slice(0, 7);
  for (let key = lower.slice(0, 7); key <= lastKey && dates.length < limit; key = shiftMonthKey(key, 1)) {
    const day = Math.min(schedule.dayOfMonth, daysInMonthKey(key));
    const candidate = `${key}-${String(day).padStart(2, "0")}`;
    if (candidate >= lower && candidate <= throughDate) dates.push(candidate);
  }
  return dates;
}

/** Due dates still ahead (after today) in the given month; nothing for months that are already over. */
export function upcomingInMonth(schedule: RecurringSchedule, monthKey: string, today: string): string[] {
  if (lastDayOfMonth(monthKey) <= today) return [];
  return dueDates(schedule, today, lastDayOfMonth(monthKey)).filter((date) => date.startsWith(monthKey));
}

/** The next date after today, for showing "Next: ..." on a rule. */
export function nextDueDate(schedule: RecurringSchedule, today: string): string | null {
  return dueDates(schedule, today, addDays(today, 400), 1)[0] ?? null;
}

export function describeSchedule(schedule: RecurringSchedule, weekdayNames: string[]): string {
  if (schedule.frequency === "weekly") return `Every ${weekdayNames[schedule.weekday ?? 0] ?? ""}`;
  return `Monthly on day ${schedule.dayOfMonth ?? 1}`;
}
