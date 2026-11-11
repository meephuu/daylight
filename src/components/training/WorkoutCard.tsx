import { useDraggable } from "@dnd-kit/core";
import { Clock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Workout } from "@/lib/db/workouts";
import { CATEGORY_INFO, type WorkoutStatus } from "@/lib/training";
import { cn } from "@/lib/utils";

interface WorkoutCardProps {
  workout: Workout;
  status: WorkoutStatus;
  onToggle: (workout: Workout) => void;
  onEdit: (workout: Workout) => void;
}

/** "18:00 · 60 min", "60 min", "18:00" or null. */
export function workoutTimeLabel(workout: Workout): string | null {
  const parts = [
    workout.startTime,
    workout.durationMinutes === null ? null : `${workout.durationMinutes} min`,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

/** Presentational card; DraggableWorkoutCard adds drag, the drag overlay reuses it as-is. */
export function WorkoutCardBody({
  workout,
  status,
  onToggle,
  className,
}: Pick<WorkoutCardProps, "workout" | "status" | "onToggle"> & { className?: string }) {
  const category = CATEGORY_INFO[workout.category];
  const done = status === "done";
  const time = workoutTimeLabel(workout);

  return (
    <div
      className={cn(
        "glass-well flex items-start gap-2 rounded-lg p-2 text-left shadow-[inset_0_0_0_1px_var(--glass-rim)] transition-colors hover:bg-foreground/[0.08]",
        done && "opacity-60",
        className,
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={() => onToggle(workout)}
        onPointerDown={(event) => event.stopPropagation()}
        // Ticking a workout must not also open it for editing (the card itself is clickable).
        onClick={(event) => event.stopPropagation()}
        aria-label={done ? "Mark as not done" : "Mark as done"}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", done && "line-through")}>{workout.title}</p>
        {time && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3 shrink-0" />
            <span className="truncate">{time}</span>
          </p>
        )}
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
          {category.label}
          {workout.exercises.length > 0 &&
            ` · ${workout.exercises.length} exercise${workout.exercises.length === 1 ? "" : "s"}`}
        </p>
        {status === "missed" && <p className="mt-0.5 text-xs font-medium text-destructive">Missed</p>}
      </div>
    </div>
  );
}

export function DraggableWorkoutCard({ workout, status, onToggle, onEdit }: WorkoutCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: workout.id,
    data: { workout },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onEdit(workout)}
      className={cn("cursor-grab touch-none", isDragging && "opacity-30")}
    >
      <WorkoutCardBody workout={workout} status={status} onToggle={onToggle} />
    </div>
  );
}
