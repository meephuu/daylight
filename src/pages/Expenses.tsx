import { useMemo, useState } from "react";
import { addMonths, format, isSameMonth, parseISO, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { BudgetCard } from "@/components/expenses/BudgetCard";
import { CategoryChart } from "@/components/expenses/CategoryChart";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteExpense, useExpenseSettings, useExpenses } from "@/hooks/useExpenses";
import { toDateString } from "@/lib/dates";
import type { Expense } from "@/lib/db/expenses";
import {
  categoryTotals,
  DEFAULT_CATEGORIES,
  expensesInMonth,
  formatMoney,
  monthKey,
  sumAmounts,
} from "@/lib/expenses";

export default function ExpensesPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const expensesQuery = useExpenses();
  const settings = useExpenseSettings();
  const deleteExpense = useDeleteExpense();

  const allExpenses = useMemo(() => expensesQuery.data ?? [], [expensesQuery.data]);
  const monthExpenses = useMemo(
    () => expensesInMonth(allExpenses, monthKey(month)),
    [allExpenses, month],
  );
  const spent = useMemo(() => sumAmounts(monthExpenses), [monthExpenses]);
  const byCategory = useMemo(() => categoryTotals(monthExpenses), [monthExpenses]);
  const categorySuggestions = useMemo(
    () => [...new Set([...DEFAULT_CATEGORIES, ...allExpenses.map((expense) => expense.category)])],
    [allExpenses],
  );

  // Rows grouped under their date, newest day first (the query already sorts by date).
  const days = useMemo(() => {
    const groups = new Map<string, Expense[]>();
    for (const expense of monthExpenses) {
      const list = groups.get(expense.date);
      if (list) list.push(expense);
      else groups.set(expense.date, [expense]);
    }
    return [...groups.entries()];
  }, [monthExpenses]);

  const isCurrentMonth = isSameMonth(month, new Date());
  // Adding while looking at another month defaults to that month's first day, not today.
  const defaultDate = isCurrentMonth ? undefined : toDateString(month);

  function openForm(expense: Expense | null) {
    setEditing(expense);
    setFormOpen(true);
  }

  function handleDelete(expense: Expense) {
    const label = expense.note || expense.category;
    if (window.confirm(`Delete expense "${label}" (${formatMoney(expense.amount, settings.currency)})?`)) {
      deleteExpense.mutate(expense.id);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">{format(month, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
          {!isCurrentMonth && (
            <Button variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>
              This month
            </Button>
          )}
          <Button onClick={() => openForm(null)}>
            <Plus className="size-4" />
            Add expense
          </Button>
        </div>
      </div>

      {expensesQuery.isError && (
        <p className="text-sm text-destructive">Could not load expenses: {String(expensesQuery.error)}</p>
      )}

      <BudgetCard monthLabel={format(month, "MMMM")} spent={spent} settings={settings} />

      <Card>
        <CardHeader>
          <CardTitle>Spending by category</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryChart data={byCategory} currency={settings.currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Transactions · {monthExpenses.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {days.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nothing recorded for {format(month, "MMMM")}. Add an expense to get started.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {days.map(([date, expenses]) => (
                <section key={date}>
                  <h3 className="mb-1 flex justify-between text-xs font-medium text-muted-foreground">
                    <span>{format(parseISO(date), "EEEE, MMM d")}</span>
                    <span>{formatMoney(sumAmounts(expenses), settings.currency)}</span>
                  </h3>
                  <ul className="divide-y">
                    {expenses.map((expense) => (
                      <li key={expense.id} className="group flex items-center gap-3 py-2">
                        <button
                          type="button"
                          onClick={() => openForm(expense)}
                          className="flex min-w-0 flex-1 flex-col items-start text-left"
                        >
                          <span className="text-sm font-medium">{expense.category}</span>
                          {expense.note && (
                            <span className="max-w-full truncate text-xs text-muted-foreground">{expense.note}</span>
                          )}
                        </button>
                        <span className="text-sm tabular-nums">{formatMoney(expense.amount, settings.currency)}</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                          onClick={() => handleDelete(expense)}
                          aria-label="Delete expense"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editing}
        categories={categorySuggestions}
        defaultDate={defaultDate}
      />
    </div>
  );
}
