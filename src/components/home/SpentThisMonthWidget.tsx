import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BudgetMeter } from "@/components/expenses/BudgetMeter";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExpenseSettings, useExpenses } from "@/hooks/useExpenses";
import { bangkokMonthKey } from "@/lib/bangkok";
import { confirmedOnly, expensesInMonth, sumSatang } from "@/lib/expenses";
import { formatTHB } from "@/lib/money";

export function SpentThisMonthWidget() {
  const expensesQuery = useExpenses();
  const settings = useExpenseSettings();

  const spent = useMemo(
    () => sumSatang(expensesInMonth(confirmedOnly(expensesQuery.data ?? []), bangkokMonthKey())),
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
        <p className="text-3xl font-semibold">{formatTHB(spent)}</p>
        {settings.budgetSatang !== null ? (
          <BudgetMeter spentSatang={spent} budgetSatang={settings.budgetSatang} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No budget set. <Link to="/expenses" className="underline">Set one</Link> to track what is left.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
