import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEP =
  "grid size-7 place-items-center rounded-full text-foreground/70 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-30";

/**
 * Back and forward through time for a pane's stats (a day, a week, a month): two small round chevrons.
 * Forward stops at the current period; `onCurrent` adds a link (e.g. "Today") back to it while looking back.
 */
export function PeriodStepper({
  unit,
  onStep,
  canForward,
  onCurrent,
  currentLabel = "Today",
  className,
}: {
  /** "day", "week" or "month", for the buttons' labels. */
  unit: string;
  onStep: (direction: -1 | 1) => void;
  canForward: boolean;
  /** Shown while looking back: jumps to the current period. */
  onCurrent?: () => void;
  currentLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {onCurrent && (
        <button
          type="button"
          onClick={onCurrent}
          className="fade-in mr-1 h-7 rounded-full px-2.5 text-xs font-medium text-foreground/75 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {currentLabel}
        </button>
      )}
      <button type="button" className={STEP} onClick={() => onStep(-1)} aria-label={`Previous ${unit}`} title={`Previous ${unit}`}>
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        className={STEP}
        onClick={() => onStep(1)}
        disabled={!canForward}
        aria-label={`Next ${unit}`}
        title={`Next ${unit}`}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
