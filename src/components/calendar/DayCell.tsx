import { useDraggable, useDroppable } from "@dnd-kit/core";
import { format, isSameMonth, isToday } from "date-fns";
import { TaskChip } from "@/components/calendar/TaskChip";
import type { CalendarMode } from "@/lib/calendar";
import { toDateString } from "@/lib/dates";
import type { Project } from "@/lib/db/projects";
import type { Task } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";

/** Tasks shown per cell in month view before collapsing into "+N more". */
const MONTH_VISIBLE_TASKS = 3;

interface DraggableTaskChipProps {
  task: Task;
  project: Project | undefined;
  onEdit: (task: Task) => void;
}

function DraggableTaskChip({ task, project, onEdit }: DraggableTaskChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(event) => {
        // Don't let the click fall through to the cell's "add task" handler.
        event.stopPropagation();
        onEdit(task);
      }}
      className={cn("cursor-grab touch-none", isDragging && "opacity-30")}
    >
      <TaskChip task={task} project={project} />
    </div>
  );
}

interface DayCellProps {
  day: Date;
  /** Month being viewed; days outside it are dimmed (month view only). */
  cursor: Date;
  mode: CalendarMode;
  tasks: Task[];
  projectsById: Map<number, Project>;
  onAdd: (date: string) => void;
  onEdit: (task: Task) => void;
  onShowDay: (day: Date) => void;
}

export function DayCell({
  day,
  cursor,
  mode,
  tasks,
  projectsById,
  onAdd,
  onEdit,
  onShowDay,
}: DayCellProps) {
  const date = toDateString(day);
  const { setNodeRef, isOver } = useDroppable({ id: date });

  const dimmed = mode === "month" && !isSameMonth(day, cursor);
  const limit = mode === "month" ? MONTH_VISIBLE_TASKS : tasks.length;
  const shown = tasks.slice(0, limit);
  const hidden = tasks.length - shown.length;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onAdd(date)}
      className={cn(
        "flex cursor-pointer flex-col gap-1 border-r border-b p-1.5 transition-colors hover:bg-accent/40",
        mode === "month" ? "min-h-28" : "min-h-80",
        dimmed && "bg-muted/30 text-muted-foreground",
        isOver && "bg-accent",
      )}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center self-end rounded-full text-xs",
          isToday(day) && "bg-primary font-semibold text-primary-foreground",
        )}
      >
        {mode === "week" ? format(day, "d") : day.getDate()}
      </span>
      {shown.map((task) => (
        <DraggableTaskChip
          key={task.id}
          task={task}
          project={task.projectId === null ? undefined : projectsById.get(task.projectId)}
          onEdit={onEdit}
        />
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onShowDay(day);
          }}
          className="px-1 text-left text-xs text-muted-foreground hover:text-foreground"
        >
          +{hidden} more
        </button>
      )}
    </div>
  );
}
