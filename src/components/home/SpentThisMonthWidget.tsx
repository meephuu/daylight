import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BudgetMeter } from "@/components/expenses/BudgetMeter";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExpenseSettings, useExpenses } from "@/hooks/useExpenses";
import { bangkokMonthKey, bangkokToday } from "@/lib/bangkok";
import { confirmedOnly, dailyTotals, expensesInMonth, sumSatang } from "@/lib/expenses";
import { formatTHB } from "@/lib/money";

const BAR_AREA = 44;

export function SpentThisMonthWidget() {
  const expensesQuery = useExpenses();
  const settings = useExpenseSettings();
  const monthKey = bangkokMonthKey();
  const today = bangkokToday();

  const confirmed = useMemo(() => confirmedOnly(expensesQuery.data ?? []), [expensesQuery.data]);
  const spent = useMemo(() => sumSatang(expensesInMonth(confirmed, monthKey)), [confirmed, monthKey]);
  // The month's days so far: the total's proof, one thin bar per day.
  const days = useMemo(() => dailyTotals(confirmed, monthKey).filter((day) => day.date <= today), [confirmed, monthKey, today]);
  const peak = Math.max(1, ...days.map((day) => day.totalSatang));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Spent this month</CardTitle>
        <CardAction>
          <Link to="/expenses" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <p className="display-num text-[40px]">{formatTHB(spent)}</p>

        {days.length > 0 && (
          <div className="flex items-end gap-[2px]" style={{ height: BAR_AREA }} aria-label="Spending per day this month">
            {days.map((day) => (
              <span
                key={day.date}
                title={`${day.day}: ${formatTHB(day.totalSatang)}`}
                className="min-w-[3px] flex-1 rounded-t-[3px] rounded-b-[1px]"
                style={{
                  height: day.totalSatang > 0 ? Math.max(3, (day.totalSatang / peak) * BAR_AREA) : 2,
                  backgroundColor:
                    day.totalSatang > 0 ? "var(--series-1)" : "color-mix(in srgb, var(--foreground) 12%, transparent)",
                }}
              />
            ))}
          </div>
        )}

        <div className="mt-auto">
          {settings.budgetSatang !== null ? (
            <BudgetMeter spentSatang={spent} budgetSatang={settings.budgetSatang} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No budget set.{" "}
              <Link to="/expenses" className="font-medium text-foreground underline underline-offset-4">
                Set one
              </Link>{" "}
              to track what is left.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
