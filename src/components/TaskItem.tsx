import { CalendarDays, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDueDateTime, isOverdue } from "@/lib/dates";
import type { Project } from "@/lib/db/projects";
import type { Task, TaskPriority } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
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

  return (
    <li className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <Checkbox
        checked={done}
        onCheckedChange={() => onToggle(task)}
        aria-label={done ? "Mark as not done" : "Mark as done"}
      />
      <span
        className={cn("size-2 shrink-0 rounded-full", PRIORITY_STYLES[task.priority])}
        title={`${task.priority} priority`}
      />
      <button
        type="button"
        onClick={() => onEdit(task)}
        className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
      >
        <span className={cn("max-w-full truncate text-sm", done && "text-muted-foreground line-through")}>
          {task.title}
        </span>
        {(task.dueDate || project || task.tags.length > 0 || task.status === "doing") && (
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.status === "doing" && <Badge variant="secondary">In progress</Badge>}
            {task.dueDate && (
              <span className={cn("flex items-center gap-1", overdue && "font-medium text-red-500")}>
                <CalendarDays className="size-3" />
                {formatDueDateTime(task.dueDate, task.dueTime)}
              </span>
            )}
            {project && (
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
              </span>
            )}
            {task.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </span>
        )}
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => onDelete(task)}
        aria-label="Delete task"
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
