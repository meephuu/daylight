import { useMemo, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import { BudgetMeter } from "@/components/expenses/BudgetMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveBudget } from "@/hooks/useExpenses";
import type { Expense } from "@/lib/db/expenses";
import { compareWithPreviousMonth, projectedMonthEnd, safeToSpend } from "@/lib/expenses";
import { formatTHB, parseBahtToSatang, satangToInput } from "@/lib/money";
import { cn } from "@/lib/utils";

interface BudgetCardProps {
  monthKey: string;
  /** Today in Bangkok, "YYYY-MM-DD". */
  today: string;
  spentSatang: number;
  budgetSatang: number | null;
  /** Confirmed expenses of every month, for the comparison with last month. */
  confirmed: Expense[];
}

/** A fact beside the total: set as type on the sky, not boxed. */
function Stat({ label, children, detail, tone }: { label: string; children: ReactNode; detail?: ReactNode; tone?: "warn" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-l border-foreground/15 pl-5">
      <p className="text-sm text-foreground/75">{label}</p>
      <p className={cn("font-display text-[28px] leading-none font-semibold tracking-[-0.03em] whitespace-nowrap", tone === "warn" && "text-warning")}>
        {children}
      </p>
      {detail && <p className="text-xs text-foreground/65">{detail}</p>}
    </div>
  );
}

export function BudgetCard({ monthKey, today, spentSatang, budgetSatang, confirmed }: BudgetCardProps) {
  const [editing, setEditing] = useState(false);
  const monthLabel = format(parseISO(`${monthKey}-01`), "MMMM");

  const safe = useMemo(
    () => (budgetSatang === null ? null : safeToSpend(budgetSatang, spentSatang, monthKey, today)),
    [budgetSatang, spentSatang, monthKey, today],
  );
  const projected = useMemo(() => projectedMonthEnd(spentSatang, monthKey, today), [spentSatang, monthKey, today]);
  const comparison = useMemo(
    () => compareWithPreviousMonth(confirmed, spentSatang, monthKey, today),
    [confirmed, spentSatang, monthKey, today],
  );
  const previousLabel = comparison ? format(parseISO(`${comparison.previousMonthKey}-01`), "MMMM") : "";
  const projectedOver = projected !== null && budgetSatang !== null && projected > budgetSatang;

  return (
    // The month's total, set large on the sky, with the budget under it and the facts beside it.
    <section className="flex flex-col gap-7 px-1 pt-1 pb-3" aria-label={`Spent in ${monthLabel}`}>
      <div className="flex max-w-3xl min-w-0 flex-col gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-foreground/75">Spent in {monthLabel}</p>
            {!editing && (
              <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
                <Pencil className="size-3" />
                {budgetSatang === null ? "Set budget" : "Edit budget"}
              </Button>
            )}
          </div>
          <p className="display-num mt-2 text-[72px]">{formatTHB(spentSatang)}</p>
        </div>

        {editing ? (
          <BudgetForm budgetSatang={budgetSatang} onDone={() => setEditing(false)} />
        ) : budgetSatang !== null ? (
          <BudgetMeter spentSatang={spentSatang} budgetSatang={budgetSatang} />
        ) : (
          <p className="text-sm text-foreground/75">No monthly budget set. Set one to see how much you have left.</p>
        )}
      </div>

      <div className="grid max-w-5xl gap-x-6 gap-y-5 sm:grid-cols-3">
          {budgetSatang !== null && safe !== null && (
            <Stat
              label="Safe to spend per day"
              detail={safe.perDaySatang === 0 ? "Budget used up" : `${safe.daysLeft} day${safe.daysLeft === 1 ? "" : "s"} left`}
            >
              {formatTHB(safe.perDaySatang)}
            </Stat>
          )}
          {comparison && (
            <Stat
              label={comparison.deltaSatang === 0 ? `vs ${previousLabel}` : `${comparison.deltaSatang > 0 ? "More" : "Less"} than ${previousLabel}`}
              detail={
                (comparison.percent !== null && comparison.deltaSatang !== 0
                  ? `${comparison.percent > 0 ? "+" : ""}${comparison.percent}% · `
                  : "") +
                (comparison.throughDay === null
                  ? `${formatTHB(comparison.previousSatang)} in ${previousLabel}`
                  : `${formatTHB(comparison.previousSatang)} by day ${comparison.throughDay}`)
              }
            >
              {comparison.deltaSatang === 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Minus className="size-4" />
                  {comparison.previousSatang === 0 ? "No change" : "Same"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  {comparison.deltaSatang > 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                  {formatTHB(Math.abs(comparison.deltaSatang))}
                </span>
              )}
            </Stat>
          )}
          {projected !== null && (
            <Stat
              label="Projected by month end"
              tone={projectedOver ? "warn" : undefined}
              detail={
                projectedOver && budgetSatang !== null
                  ? `${formatTHB(projected - budgetSatang)} over budget at this pace`
                  : "if you keep this pace"
              }
            >
              {formatTHB(projected)}
            </Stat>
          )}
      </div>
    </section>
  );
}

function BudgetForm({ budgetSatang, onDone }: { budgetSatang: number | null; onDone: () => void }) {
  const save = useSaveBudget();
  const [text, setText] = useState(budgetSatang === null ? "" : satangToInput(budgetSatang));

  const parsed = text.trim() === "" ? null : parseBahtToSatang(text);
  const invalid = text.trim() !== "" && (parsed === null || parsed <= 0);

  async function submit() {
    if (invalid) return;
    await save.mutateAsync(parsed);
    onDone();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="budget-amount">Monthly budget (THB)</Label>
        <Input
          id="budget-amount"
          inputMode="decimal"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="No budget"
          aria-invalid={invalid}
          className="w-44"
          autoFocus
        />
      </div>
      <Button type="submit" disabled={invalid || save.isPending}>
        Save
      </Button>
      <Button type="button" variant="outline" onClick={onDone}>
        Cancel
      </Button>
      {invalid && <p className="w-full text-xs text-destructive">Enter a positive amount, or leave empty for no budget.</p>}
    </form>
  );
}
