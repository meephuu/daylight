import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { budgetState, formatMoney } from "@/lib/expenses";

interface BudgetMeterProps {
  spent: number;
  budget: number;
  currency: string;
}

const FILL_COLOR = {
  ok: "var(--viz-bar)",
  warning: "var(--viz-warning)",
  over: "var(--viz-critical)",
} as const;

/** Fill shifts blue → amber → red; the track is a pale wash of the same blue. State also gets an icon + label. */
export function BudgetMeter({ spent, budget, currency }: BudgetMeterProps) {
  const state = budgetState(spent, budget);
  const percent = Math.min(100, Math.round((spent / budget) * 100));
  const remaining = budget - spent;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={Math.min(spent, budget)}
        aria-label="Budget used"
        className="h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: "color-mix(in srgb, var(--viz-bar) 18%, transparent)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: FILL_COLOR[state] }}
        />
      </div>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {state === "ok" ? (
          <CheckCircle2 className="size-4" />
        ) : (
          <AlertTriangle className="size-4" />
        )}
        {state === "over"
          ? `Over budget by ${formatMoney(-remaining, currency)}`
          : `${formatMoney(remaining, currency)} left of ${formatMoney(budget, currency)} (${percent}% used)`}
      </p>
    </div>
  );
}
