import type { Task, TaskPriority } from "@/lib/db/tasks";
import { addDays } from "date-fns";
import { toDateString, todayString } from "@/lib/dates";

export type TaskView = "upcoming" | "done" | "all";

export const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

/** Open tasks first by due date (undated last), then priority, then oldest first. */
function compareOpen(a: Task, b: Task): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  return byPriority !== 0 ? byPriority : a.id - b.id;
}

function compareDone(a: Task, b: Task): number {
  return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
}

export interface TaskSection {
  key: string;
  title: string | null;
  tasks: Task[];
}

export function filterByProject(tasks: Task[], projectId: number | null): Task[] {
  return projectId === null ? tasks : tasks.filter((task) => task.projectId === projectId);
}

/** Tasks that belong to a view, ignoring the project filter. "Upcoming" is everything still to do. */
export function tasksForView(tasks: Task[], view: TaskView): Task[] {
  switch (view) {
    case "upcoming":
      return tasks.filter((t) => t.status !== "done");
    case "done":
      return tasks.filter((t) => t.status === "done");
    case "all":
      return tasks;
  }
}

/** Open tasks due after today and up to `days` days from now, soonest first. */
export function upcomingWithin(tasks: Task[], days: number): Task[] {
  const today = todayString();
  const last = toDateString(addDays(new Date(), days));
  return tasks
    .filter((t) => t.status !== "done" && t.dueDate !== null && t.dueDate > today && t.dueDate <= last)
    .sort(compareOpen);
}

export function overdueTasks(tasks: Task[]): Task[] {
  const today = todayString();
  return tasks
    .filter((t) => t.status !== "done" && t.dueDate !== null && t.dueDate < today)
    .sort(compareOpen);
}

export function dueTodayTasks(tasks: Task[]): Task[] {
  const today = todayString();
  return tasks.filter((t) => t.status !== "done" && t.dueDate === today).sort(compareOpen);
}

export function buildSections(tasks: Task[], view: TaskView): TaskSection[] {
  const today = todayString();
  const open = tasks.filter((t) => t.status !== "done").sort(compareOpen);
  const done = tasks.filter((t) => t.status === "done").sort(compareDone);

  switch (view) {
    case "upcoming":
      // Everything still to do, nearest deadline first; overdue stands out at the top.
      return [
        { key: "overdue", title: "Overdue", tasks: open.filter((t) => t.dueDate !== null && t.dueDate < today) },
        { key: "today", title: "Today", tasks: open.filter((t) => t.dueDate === today) },
        { key: "later", title: "Later", tasks: open.filter((t) => t.dueDate !== null && t.dueDate > today) },
        { key: "undated", title: "No date", tasks: open.filter((t) => t.dueDate === null) },
      ].filter((section) => section.tasks.length > 0);
    case "done":
      return done.length > 0 ? [{ key: "done", title: null, tasks: done }] : [];
    case "all":
      return [
        { key: "open", title: null, tasks: open },
        { key: "done", title: "Completed", tasks: done },
      ].filter((section) => section.tasks.length > 0);
  }
}
