/**
 * Expense dates are plain "YYYY-MM-DD" text, so grouping by day can never shift. "Today" and "this month"
 * are decided on the Asia/Bangkok clock, whatever timezone the PC itself is set to.
 */
const bangkokDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Bangkok, "YYYY-MM-DD". */
export function bangkokToday(now: Date = new Date()): string {
  return bangkokDate.format(now);
}

/** The current month in Bangkok, "YYYY-MM". */
export function bangkokMonthKey(now: Date = new Date()): string {
  return bangkokToday(now).slice(0, 7);
}

function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [year = 1970, month = 1] = monthKey.split("-").map(Number);
  return { year, month };
}

/** "2026-12" + 1 -> "2027-01". */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonthKey(monthKey: string): number {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "2026-10" -> "2026-10-01". */
export function firstDayOfMonth(monthKey: string): string {
  return `${monthKey}-01`;
}
