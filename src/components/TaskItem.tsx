import { AlertTriangle, Flag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDueDateTime, isOverdue } from "@/lib/dates";
import type { Project } from "@/lib/db/projects";
import type { Task, TaskPriority } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";

/** High and medium priority get a flag (shape and colour); low priority stays unmarked. */
const PRIORITY_FLAG: Partial<Record<TaskPriority, string>> = {
  high: "text-[#ff5d6c] fill-[#ff5d6c]",
  medium: "text-[#ffb02e]",
};

interface TaskItemProps {
  task: Task;
  project: Project | undefined;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskItem({ task, project, onToggle, onEdit, onDelete }: TaskItemProps) {
  const done = task.status === "done";
  const overdue = !done && isOverdue(task.dueDate);
  const flag = PRIORITY_FLAG[task.priority];

  return (
    <li className="group flex items-center gap-3.5 rounded-2xl px-3 py-2.5 transition-colors hover:bg-foreground/[0.05]">
      <Checkbox
        checked={done}
        onCheckedChange={() => onToggle(task)}
        aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
      />
      <button type="button" onClick={() => onEdit(task)} className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left outline-none focus-visible:underline">
        <span className="flex max-w-full items-center gap-2">
          {flag && <Flag className={cn("size-3.5 shrink-0", flag)} aria-label={`${task.priority} priority`} />}
          <span className={cn("truncate text-[15px] font-medium", done && "text-muted-foreground line-through")}>{task.title}</span>
          {task.status === "doing" && (
            <span className="shrink-0 rounded-full bg-sky-accent/20 px-2 py-0.5 text-[11px] font-semibold text-foreground">In progress</span>
          )}
        </span>
        {(task.notes.trim() !== "" || task.tags.length > 0) && (
          <span className="flex max-w-full items-center gap-2 text-xs text-muted-foreground">
            {task.tags.map((tag) => (
              <span key={tag} className="shrink-0">
                #{tag}
              </span>
            ))}
            {task.notes.trim() !== "" && <span className="truncate">{task.notes}</span>}
          </span>
        )}
      </button>

      {project && (
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-foreground/[0.07] px-2.5 py-1 text-xs font-medium sm:flex">
          <span className="size-2 rounded-full" style={{ backgroundColor: project.color }} />
          {project.name}
        </span>
      )}
      {task.dueDate && (
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
            overdue ? "bg-destructive/15 text-destructive" : "bg-foreground/[0.07] text-foreground/80",
          )}
        >
          {overdue && <AlertTriangle className="size-3" aria-label="Overdue" />}
          {formatDueDateTime(task.dueDate, task.dueTime)}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => onDelete(task)}
        aria-label={`Delete ${task.title}`}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
