import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Task } from "@/lib/db/tasks";
import { PRIORITY_RANK } from "@/lib/taskViews";

export type CalendarMode = "month" | "week";

/** Weeks start on Monday. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Every day shown for the cursor date: the full weeks covering the month, or just one week. */
export function getVisibleDays(mode: CalendarMode, cursor: Date): Date[] {
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
  return mode === "month" ? addMonths(cursor, direction) : addWeeks(cursor, direction);
}

export function formatRangeTitle(mode: CalendarMode, days: Date[], cursor: Date): string {
  if (mode === "month") return format(cursor, "MMMM yyyy");
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return format(cursor, "MMMM yyyy");
  const sameMonth = first.getMonth() === last.getMonth();
  return `${format(first, "MMM d")} – ${format(last, sameMonth ? "d, yyyy" : "MMM d, yyyy")}`;
}

/** Tasks that have a due date, grouped by "YYYY-MM-DD"; open tasks first, then by priority. */
export function groupTasksByDate(tasks: Task[]): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const list = groups.get(task.dueDate);
    if (list) list.push(task);
    else groups.set(task.dueDate, [task]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const byDone = Number(a.status === "done") - Number(b.status === "done");
      if (byDone !== 0) return byDone;
      const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return byPriority !== 0 ? byPriority : a.id - b.id;
    });
  }
  return groups;
}
