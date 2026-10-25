import { Checkbox } from "@/components/ui/checkbox";
import { formatDueDate, isOverdue } from "@/lib/dates";
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
    <li className="flex items-center gap-3 py-1.5">
      <Checkbox checked={false} onCheckedChange={() => onToggle(task)} aria-label="Mark as done" />
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
            "shrink-0 text-xs text-muted-foreground",
            overdue && "font-medium text-red-500",
          )}
        >
          {formatDueDate(task.dueDate)}
        </span>
      )}
    </li>
  );
}
