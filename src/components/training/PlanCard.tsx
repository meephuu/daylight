import { CATEGORY_INFO, DAY_SHORT, type WorkoutTemplate } from "@/lib/training";
import { cn } from "@/lib/utils";

interface PlanCardProps {
  template: WorkoutTemplate;
  onSelect: (template: WorkoutTemplate) => void;
  disabled?: boolean;
}

/** A starter plan with a Sunday-to-Saturday strip showing what lands on each day. */
export function PlanCard({ template, onSelect, disabled }: PlanCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(template)}
      className="flex flex-col gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
    >
      <span>
        <span className="block font-medium">{template.name}</span>
        <span className="block text-xs text-muted-foreground">{template.description}</span>
      </span>
      <span className="grid grid-cols-7 gap-1">
        {DAY_SHORT.map((label, dayOfWeek) => {
          const workout = template.workouts.find((candidate) => candidate.dayOfWeek === dayOfWeek);
          return (
            <span key={label} className="flex min-w-0 flex-col items-center gap-0.5">
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <span
                className={cn(
                  "w-full truncate rounded px-0.5 py-1 text-center text-[10px] leading-none",
                  workout ? "text-white" : "bg-muted text-muted-foreground",
                )}
                style={workout ? { backgroundColor: CATEGORY_INFO[workout.category].color } : undefined}
                title={workout?.title ?? "Rest"}
              >
                {workout?.title ?? "Rest"}
              </span>
            </span>
          );
        })}
      </span>
    </button>
  );
}
