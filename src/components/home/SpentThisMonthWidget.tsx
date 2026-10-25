import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BudgetMeter } from "@/components/expenses/BudgetMeter";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExpenseSettings, useExpenses } from "@/hooks/useExpenses";
import { expensesInMonth, formatMoney, monthKey, sumAmounts } from "@/lib/expenses";

export function SpentThisMonthWidget() {
  const expensesQuery = useExpenses();
  const settings = useExpenseSettings();

  const spent = useMemo(
    () => sumAmounts(expensesInMonth(expensesQuery.data ?? [], monthKey(new Date()))),
    [expensesQuery.data],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spent this month</CardTitle>
        <CardAction>
          <Link to="/expenses" className="text-xs text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-3xl font-semibold">{formatMoney(spent, settings.currency)}</p>
        {settings.budget !== null ? (
          <BudgetMeter spent={spent} budget={settings.budget} currency={settings.currency} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No budget set. <Link to="/expenses" className="underline">Set one</Link> to track what is left.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
