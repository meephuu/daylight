import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDueDateTime, isOverdue } from "@/lib/dates";
import type { Project } from "@/lib/db/projects";
import type { Task } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";

const LIMIT = 7;

interface HomeTasksProps {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  upcomingDays: number;
  projectsById: Map<number, Project>;
  onComplete: (task: Task) => void;
}

function TaskRow({ task, project, onComplete }: { task: Task; project: Project | undefined; onComplete: (task: Task) => void }) {
  const late = isOverdue(task.dueDate);
  return (
    <li className="flex min-h-10 items-center gap-3 rounded-2xl px-2.5 py-1.5 transition-colors hover:bg-foreground/[0.05]">
      <Checkbox checked={false} onCheckedChange={() => onComplete(task)} aria-label={`Mark ${task.title} as done`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {task.dueDate && (
            <span className={cn("flex items-center gap-1 tabular-nums", late && "font-medium text-destructive")}>
              {late && <AlertTriangle className="size-3" aria-label="Overdue" />}
              {formatDueDateTime(task.dueDate, task.dueTime)}
            </span>
          )}
          {project && (
            <span className="flex min-w-0 items-center gap-1">
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
              <span className="truncate">{project.name}</span>
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

/** Tasks on Home: what is due now (late first) or what is coming, one pane with a two-way switch. */
export function HomeTasks({ overdue, today, upcoming, upcomingDays, projectsById, onComplete }: HomeTasksProps) {
  const due = [...overdue, ...today];
  const [view, setView] = useState<"due" | "upcoming">(due.length > 0 ? "due" : "upcoming");
  const list = view === "due" ? due : upcoming;
  const shown = list.slice(0, LIMIT);
  const hidden = list.length - shown.length;

  const options = [
    { value: "due" as const, label: "Due", count: due.length },
    { value: "upcoming" as const, label: "Upcoming", count: upcoming.length },
  ];

  return (
    <section className="pane flex flex-col gap-3 p-5" aria-labelledby="home-tasks-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-tasks-title" className="font-display text-[19px] leading-tight font-semibold tracking-[-0.02em]">
          Tasks
        </h2>
        <div role="tablist" aria-label="Which tasks" className="glass-well flex rounded-full p-0.5 shadow-[inset_0_0_0_1px_var(--glass-rim)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={view === option.value}
              onClick={() => setView(option.value)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                view === option.value
                  ? "bg-white/85 text-foreground shadow-[inset_0_1px_0_var(--glass-edge)] dark:bg-white/[0.16]"
                  : "text-foreground/70 hover:text-foreground",
              )}
            >
              {option.label}
              <span className="tabular-nums opacity-70">{option.count}</span>
            </button>
          ))}
        </div>
      </div>

      {view === "due" && overdue.length > 0 && (
        <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-destructive">
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          {overdue.length} overdue
        </p>
      )}

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {view === "due" ? "Nothing due today." : `Nothing due in the next ${upcomingDays} days.`}
        </p>
      ) : (
        <ul className="-mx-1 flex flex-col">
          {shown.map((task) => (
            <TaskRow key={task.id} task={task} project={task.projectId === null ? undefined : projectsById.get(task.projectId)} onComplete={onComplete} />
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <Link to="/tasks" className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          {hidden} more on Tasks
        </Link>
      )}
    </section>
  );
}
