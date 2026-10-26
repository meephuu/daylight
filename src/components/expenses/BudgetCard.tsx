import { useMemo, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import { BudgetMeter } from "@/components/expenses/BudgetMeter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

function Stat({ label, children, detail, tone }: { label: string; children: ReactNode; detail?: ReactNode; tone?: "warn" }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-base font-semibold whitespace-nowrap tabular-nums", tone === "warn" && "text-[var(--viz-warning)]")}>{children}</p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
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
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Spent in {monthLabel}</p>
            <p className="mt-1 text-5xl font-semibold">{formatTHB(spentSatang)}</p>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
              {budgetSatang === null ? "Set budget" : "Edit budget"}
            </Button>
          )}
        </div>

        {editing ? (
          <BudgetForm budgetSatang={budgetSatang} onDone={() => setEditing(false)} />
        ) : budgetSatang !== null ? (
          <BudgetMeter spentSatang={spentSatang} budgetSatang={budgetSatang} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No monthly budget set. Set one to see how much you have left.
          </p>
        )}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-2">
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
              label={`vs ${previousLabel}`}
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
                  <span className="text-sm font-normal text-muted-foreground">{comparison.deltaSatang > 0 ? "more" : "less"}</span>
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
      </CardContent>
    </Card>
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
