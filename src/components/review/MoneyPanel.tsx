import { format, parseISO } from "date-fns";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Repeat } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Expense } from "@/lib/db/expenses";
import { formatCompactBaht, formatTHB } from "@/lib/money";
import type { WeekReport } from "@/lib/weekReport";
import { cn } from "@/lib/utils";

interface MoneyPanelProps {
  report: WeekReport;
  previous: WeekReport;
  today: string;
  /** Recurring entries still waiting for confirmation (any week). */
  pending: Expense[];
  hasBudget: boolean;
}

export function MoneyPanel({ report, previous, today, pending, hasBudget }: MoneyPanelProps) {
  const { money } = report;
  const max = Math.max(...money.perDay, 1);
  const delta = money.spentSatang - previous.money.spentSatang;
  const pendingTotal = pending.reduce((sum, expense) => sum + expense.amountSatang, 0);
  const underPace = money.paceSatang !== null && money.spentSatang <= money.paceSatang;
  const topShare = money.topCategory && money.spentSatang > 0 ? Math.round((money.topCategory.totalSatang / money.spentSatang) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Money</CardTitle>
        <CardAction>
          <Link to="/expenses" className="text-xs text-muted-foreground hover:text-foreground">
            Open expenses
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Spent this week</p>
            <p className="text-4xl font-semibold tabular-nums">{formatTHB(money.spentSatang)}</p>
            {previous.money.spentSatang > 0 || money.spentSatang > 0 ? (
              <p className={cn("mt-1 flex items-center gap-1 text-xs", delta === 0 ? "text-muted-foreground" : delta < 0 ? "text-emerald-400" : "text-rose-400")}>
                {delta > 0 ? <ArrowUpRight className="size-3.5" /> : delta < 0 ? <ArrowDownRight className="size-3.5" /> : null}
                {delta === 0 ? "Same as last week" : `${formatTHB(Math.abs(delta))} ${delta > 0 ? "more" : "less"} than last week`}
              </p>
            ) : null}
          </div>

          {money.paceSatang !== null ? (
            <p
              className={cn(
                "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                underPace ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300",
              )}
            >
              {underPace ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
              <span>
                {underPace
                  ? `On track: ${formatTHB(money.paceSatang - money.spentSatang)} under the budget pace.`
                  : `${formatTHB(money.spentSatang - money.paceSatang)} over the budget pace.`}
                <span className="block text-xs opacity-80">Pace so far: {formatTHB(money.paceSatang)}</span>
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {hasBudget ? "The budget pace shows once the week has started." : (
                <>
                  No monthly budget set. <Link to="/expenses" className="underline">Set one</Link> to see if you are on pace.
                </>
              )}
            </p>
          )}

          {money.topCategory && (
            <div className="flex items-center gap-2 text-sm">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: money.topCategory.category.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                Top category: <strong className="font-medium">{money.topCategory.category.name}</strong>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatTHB(money.topCategory.totalSatang)} · {topShare}%
              </span>
            </div>
          )}

          {pending.length > 0 && (
            <Link to="/expenses" className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              <Repeat className="size-4 shrink-0" aria-hidden="true" />
              {pending.length} recurring expense{pending.length === 1 ? "" : "s"} waiting for confirmation ({formatTHB(pendingTotal)}), not counted above.
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Spending per day</p>
          {money.spentSatang === 0 ? (
            <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-8 text-sm text-muted-foreground">Nothing spent this week.</p>
          ) : (
            <div className="grid h-40 grid-cols-7 items-end gap-2" role="img" aria-label={`Spending per day: ${report.range.days.map((date, index) => `${format(parseISO(date), "EEEE")} ${formatTHB(money.perDay[index] ?? 0)}`).join(", ")}`}>
              {report.range.days.map((date, index) => {
                const value = money.perDay[index] ?? 0;
                const isToday = date === today;
                return (
                  <div key={date} className="flex h-full min-w-0 flex-col items-center justify-end gap-1" title={`${format(parseISO(date), "EEE, MMM d")}: ${formatTHB(value)}`}>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{value > 0 ? formatCompactBaht(value) : ""}</span>
                    <div
                      className={cn("w-full max-w-9 rounded-t-md", value === 0 && "h-0.5 bg-muted")}
                      style={value > 0 ? { height: `${Math.max(6, (value / max) * 100)}%`, backgroundColor: isToday ? "var(--primary)" : "var(--viz-bar)" } : undefined}
                    />
                    <span className={cn("text-[11px]", isToday ? "font-semibold text-foreground" : "text-muted-foreground")}>{format(parseISO(date), "EEEEE")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
