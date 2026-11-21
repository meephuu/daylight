import { addDays, format, isBefore, isToday, isTomorrow, isValid, parseISO, startOfDay, startOfWeek, subMonths } from "date-fns";

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

/** "Today 14:30", "Tomorrow", "Mon, Oct 27 09:00" ... */
export function formatDueDateTime(dueDate: string, dueTime: string | null): string {
  const date = formatDueDate(dueDate);
  return dueTime ? `${date} ${dueTime}` : date;
}

export function formatDueDate(dueDate: string): string {
  const date = parseISO(dueDate);
  if (!isValid(date)) return dueDate;
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

/** 85 -> "1h 25m", 40 -> "40m". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** "Today", "Yesterday", or the date ("Thu 19 Nov"; the year too when it is not this one). */
export function dayTitle(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === toDateString(addDays(parseISO(today), -1))) return "Yesterday";
  return format(parseISO(day), day.slice(0, 4) === today.slice(0, 4) ? "EEE d MMM" : "EEE d MMM yyyy");
}

/** "This week", "Last week", or its dates ("8 – 14 Nov", "29 Nov – 5 Dec"; with the year when not this one). */
export function weekTitle(sunday: string, today: string): string {
  const thisSunday = toDateString(startOfWeek(parseISO(today), { weekStartsOn: 0 }));
  if (sunday === thisSunday) return "This week";
  if (sunday === toDateString(addDays(parseISO(thisSunday), -7))) return "Last week";
  const start = parseISO(sunday);
  const end = addDays(start, 6);
  const year = end.getFullYear() !== parseISO(today).getFullYear() ? " yyyy" : "";
  return start.getMonth() === end.getMonth()
    ? `${format(start, "d")} – ${format(end, `d MMM${year}`)}`
    : `${format(start, "d MMM")} – ${format(end, `d MMM${year}`)}`;
}

/** "This month", "Last month", or its name ("October"; with the year when not this one). `month` is "YYYY-MM". */
export function monthTitle(month: string, today: string): string {
  const thisMonth = today.slice(0, 7);
  if (month === thisMonth) return "This month";
  const last = toDateString(subMonths(parseISO(`${thisMonth}-01`), 1)).slice(0, 7);
  if (month === last) return "Last month";
  return format(parseISO(`${month}-01`), month.slice(0, 4) === today.slice(0, 4) ? "MMMM" : "MMMM yyyy");
}
