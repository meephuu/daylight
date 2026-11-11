import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDueDateTime, isOverdue } from "@/lib/dates";
import type { Project } from "@/lib/db/projects";
import type { Task } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";

interface CompactTaskRowProps {
  task: Task;
  project: Project | undefined;
  onToggle: (task: Task) => void;
  /** Show the due date next to the title (useful outside the "today" list). */
  showDate?: boolean;
}

export function CompactTaskRow({ task, project, onToggle, showDate = false }: CompactTaskRowProps) {
  const overdue = isOverdue(task.dueDate);
  return (
    <li className="flex h-9 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-foreground/[0.05]">
      <Checkbox checked={false} onCheckedChange={() => onToggle(task)} aria-label={`Mark ${task.title} as done`} />
      <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
      {project && (
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: project.color }}
          title={project.name}
        />
      )}
      {showDate && task.dueDate && (
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums",
            overdue && "font-medium text-destructive",
          )}
        >
          {/* Late is said with an icon too, never colour alone. */}
          {overdue && <AlertTriangle className="size-3.5" aria-label="Overdue" />}
          {formatDueDateTime(task.dueDate, task.dueTime)}
        </span>
      )}
    </li>
  );
}
