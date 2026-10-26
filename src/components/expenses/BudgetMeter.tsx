import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { budgetState } from "@/lib/expenses";
import { formatTHB } from "@/lib/money";

interface BudgetMeterProps {
  spentSatang: number;
  budgetSatang: number;
}

const FILL_COLOR = {
  ok: "var(--viz-bar)",
  warning: "var(--viz-warning)",
  over: "var(--viz-critical)",
} as const;

/** Fill shifts blue → amber → red; the track is a pale wash of the same blue. State also gets an icon + label. */
export function BudgetMeter({ spentSatang, budgetSatang }: BudgetMeterProps) {
  const state = budgetState(spentSatang, budgetSatang);
  const percent = Math.min(100, Math.round((spentSatang / budgetSatang) * 100));
  const remaining = budgetSatang - spentSatang;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={budgetSatang}
        aria-valuenow={Math.min(spentSatang, budgetSatang)}
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
        {state === "ok" ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
        {state === "over"
          ? `Over budget by ${formatTHB(-remaining)}`
          : `${formatTHB(remaining)} left of ${formatTHB(budgetSatang)} (${percent}% used)`}
      </p>
    </div>
  );
}
