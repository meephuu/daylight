import { occurrencesOn, timeToMinutes, type Occurrence } from "@/lib/calendarItems";
import type { CalendarItem, OccurrenceState } from "@/lib/db/calendarItems";
import type { Task, TaskPriority } from "@/lib/db/tasks";

export type EntryKind = "task" | "event" | "reminder";

/** One thing happening on one day: a task, an event or a reminder, in a common shape. */
export interface ScheduleEntry {
  /** Unique across kinds and days, e.g. "task-12" or "item-3-2026-10-26". */
  key: string;
  kind: EntryKind;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  color: string;
  done: boolean;
  task?: Task;
  occurrence?: Occurrence;
  /** Tasks and one-off items can be dragged to another day; one occurrence of a series cannot. */
  draggable: boolean;
}

/** Same three colours the Tasks page uses for priority dots. */
export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#94a3b8",
};

export const ENTRY_KIND_LABELS: Record<EntryKind, string> = {
  task: "Task",
  event: "Event",
  reminder: "Reminder",
};

const KIND_ORDER: Record<EntryKind, number> = { event: 0, reminder: 1, task: 2 };

export function taskEntry(task: Task, date: string): ScheduleEntry {
  return {
    key: `task-${task.id}`,
    kind: "task",
    title: task.title,
    date,
    startTime: task.dueTime,
    endTime: null,
    color: PRIORITY_COLORS[task.priority],
    done: task.status === "done",
    task,
    draggable: true,
  };
}

export function occurrenceEntry(occurrence: Occurrence): ScheduleEntry {
  const { item, date, state } = occurrence;
  return {
    key: `item-${item.id}-${date}`,
    kind: item.kind,
    title: item.title,
    date,
    startTime: item.startTime,
    endTime: item.endTime,
    color: item.color,
    done: state === "done",
    occurrence,
    draggable: item.repeatRule === "none",
  };
}

/** Timed entries first (by time), then all-day ones; ties by kind and title. */
export function compareEntries(a: ScheduleEntry, b: ScheduleEntry): number {
  const aTime = timeToMinutes(a.startTime);
  const bTime = timeToMinutes(b.startTime);
  if (aTime !== bTime) {
    if (aTime === null) return 1;
    if (bTime === null) return -1;
    return aTime - bTime;
  }
  const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  return byKind !== 0 ? byKind : a.title.localeCompare(b.title);
}

/** Tasks due on `date` plus events and reminders occurring on it, in display order. */
export function entriesForDate(
  date: string,
  tasks: Task[],
  items: CalendarItem[],
  states: Map<string, OccurrenceState>,
): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  for (const task of tasks) {
    if (task.dueDate === date) entries.push(taskEntry(task, date));
  }
  for (const occurrence of occurrencesOn(items, date, states)) {
    entries.push(occurrenceEntry(occurrence));
  }
  return entries.sort(compareEntries);
}

/** Entries for every date in `dates`, keyed by date. */
export function entriesByDate(
  dates: string[],
  tasks: Task[],
  items: CalendarItem[],
  states: Map<string, OccurrenceState>,
): Map<string, ScheduleEntry[]> {
  const tasksByDate = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.dueDate === null) continue;
    const list = tasksByDate.get(task.dueDate);
    if (list) list.push(task);
    else tasksByDate.set(task.dueDate, [task]);
  }
  return new Map(
    dates.map((date) => [date, entriesForDate(date, tasksByDate.get(date) ?? [], items, states)]),
  );
}
