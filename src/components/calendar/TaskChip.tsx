import type { Project } from "@/lib/db/projects";
import type { Task } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";

const FALLBACK_COLOR = "#94a3b8";

interface TaskChipProps {
  task: Task;
  project: Project | undefined;
  className?: string;
}

/** Presentational chip; DraggableTaskChip adds drag behaviour, DragOverlay reuses it as-is. */
export function TaskChip({ task, project, className }: TaskChipProps) {
  const done = task.status === "done";
  return (
    <div
      className={cn(
        "truncate rounded-md border-l-4 bg-secondary px-2 py-1 text-xs text-secondary-foreground",
        done && "text-muted-foreground line-through opacity-60",
        className,
      )}
      style={{ borderLeftColor: project?.color ?? FALLBACK_COLOR }}
      title={task.title}
    >
      {task.title}
    </div>
  );
}
