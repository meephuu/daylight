import { budgetState, type CategoryBudgetRow } from "@/lib/expenses";
import { formatTHB } from "@/lib/money";

const FILL_COLOR = {
  ok: "var(--viz-bar)",
  warning: "var(--viz-warning)",
  over: "var(--viz-critical)",
} as const;

/** One category's spending against its own monthly budget, with the same blue / amber / red states as the main meter. */
export function BudgetBar({ row }: { row: CategoryBudgetRow }) {
  const { category, budgetSatang, spentSatang } = row;
  const state = budgetState(spentSatang, budgetSatang);
  const percent = Math.round((spentSatang / budgetSatang) * 100);
  const remaining = budgetSatang - spentSatang;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
          <span className="truncate">{category.name}</span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatTHB(spentSatang)} / {formatTHB(budgetSatang)} · {percent}%
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${category.name} budget used`}
        aria-valuemin={0}
        aria-valuemax={budgetSatang}
        aria-valuenow={Math.min(spentSatang, budgetSatang)}
        aria-valuetext={
          state === "over" ? `${formatTHB(-remaining)} over budget` : `${percent}% used, ${formatTHB(remaining)} left`
        }
        className="h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: "color-mix(in srgb, var(--viz-bar) 18%, transparent)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, percent)}%`, backgroundColor: FILL_COLOR[state] }}
        />
      </div>
      {state === "over" && <p className="text-xs text-[var(--viz-critical)]">Over by {formatTHB(-remaining)}</p>}
    </div>
  );
}
