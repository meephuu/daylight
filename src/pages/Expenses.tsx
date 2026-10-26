import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, CreditCard, Plus, Repeat, Tags } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BudgetCard } from "@/components/expenses/BudgetCard";
import { CategoryBreakdown } from "@/components/expenses/CategoryBreakdown";
import { CategoryManagerDialog } from "@/components/expenses/CategoryManagerDialog";
import { DailySpendingChart } from "@/components/expenses/DailySpendingChart";
import { ExpenseFilterBar } from "@/components/expenses/ExpenseFilterBar";
import { ExpenseFormDialog, type ExpensePrefill } from "@/components/expenses/ExpenseFormDialog";
import { PaymentMethodManagerDialog } from "@/components/expenses/PaymentMethodManagerDialog";
import { PendingExpensesCard } from "@/components/expenses/PendingExpensesCard";
import { RecurringDialog } from "@/components/expenses/RecurringDialog";
import { TransactionList } from "@/components/expenses/TransactionList";
import { UpcomingRecurringCard } from "@/components/expenses/UpcomingRecurringCard";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCategories } from "@/hooks/useCategories";
import {
  useConfirmExpenses,
  useDeleteExpense,
  useExpenseSettings,
  useExpenses,
  useRestoreExpense,
} from "@/hooks/useExpenses";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useRecurring, useRecurringGenerator } from "@/hooks/useRecurring";
import { bangkokMonthKey, bangkokToday, firstDayOfMonth, shiftMonthKey } from "@/lib/bangkok";
import type { Expense } from "@/lib/db/expenses";
import {
  categoryBudgetRows,
  categoryTotals,
  confirmedOnly,
  dailyTotals,
  expensesInMonth,
  filterExpenses,
  hasActiveFilters,
  NO_FILTERS,
  pendingOnly,
  sortExpenses,
  sumSatang,
  type ExpenseFilters,
  type SortKey,
} from "@/lib/expenses";
import { formatTHB } from "@/lib/money";
import { showToast } from "@/lib/toast";

/** True while typing in a field, where single-letter shortcuts must not fire. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

export default function ExpensesPage() {
  const [monthKey, setMonthKey] = useState(bangkokMonthKey);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [prefill, setPrefill] = useState<ExpensePrefill | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [methodsOpen, setMethodsOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [filters, setFilters] = useState<ExpenseFilters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [filterBarKey, setFilterBarKey] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useRecurringGenerator();
  const expensesQuery = useExpenses();
  const categoriesQuery = useCategories();
  const methodsQuery = usePaymentMethods();
  const recurringQuery = useRecurring();
  const settings = useExpenseSettings();
  const deleteExpense = useDeleteExpense();
  const restoreExpense = useRestoreExpense();
  const confirmExpenses = useConfirmExpenses();

  const allExpenses = useMemo(() => expensesQuery.data ?? [], [expensesQuery.data]);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const methods = useMemo(() => methodsQuery.data ?? [], [methodsQuery.data]);
  const rules = useMemo(() => recurringQuery.data ?? [], [recurringQuery.data]);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const methodsById = useMemo(() => new Map(methods.map((method) => [method.id, method])), [methods]);

  const today = bangkokToday();
  // Pending entries (from recurring rules) are in no total, chart or budget until they are confirmed.
  const confirmed = useMemo(() => confirmedOnly(allExpenses), [allExpenses]);
  const pending = useMemo(() => pendingOnly(allExpenses), [allExpenses]);
  const monthExpenses = useMemo(() => expensesInMonth(confirmed, monthKey), [confirmed, monthKey]);
  const spent = useMemo(() => sumSatang(monthExpenses), [monthExpenses]);
  const byCategory = useMemo(() => categoryTotals(monthExpenses, categoriesById), [monthExpenses, categoriesById]);
  const budgetRows = useMemo(() => categoryBudgetRows(byCategory, categories), [byCategory, categories]);
  const days = useMemo(() => dailyTotals(monthExpenses, monthKey), [monthExpenses, monthKey]);

  const visible = useMemo(
    () => sortExpenses(filterExpenses(monthExpenses, filters, categoriesById, methodsById), sort),
    [monthExpenses, filters, categoriesById, methodsById, sort],
  );
  const filtered = hasActiveFilters(filters);

  const currentMonth = bangkokMonthKey();
  const isCurrentMonth = monthKey === currentMonth;
  const monthDate = parseISO(firstDayOfMonth(monthKey));
  // Adding while looking at another month defaults to that month's first day, not today.
  const defaultDate = isCurrentMonth ? today : firstDayOfMonth(monthKey);

  function openForm(expense: Expense | null, copyOf: ExpensePrefill | null = null) {
    setEditing(expense);
    setPrefill(copyOf);
    setFormOpen(true);
  }

  function duplicate(expense: Expense) {
    openForm(null, {
      amountSatang: expense.amountSatang,
      categoryId: expense.categoryId,
      paymentMethodId: expense.paymentMethodId,
      note: expense.note,
      date: today,
    });
  }

  function describe(expense: Expense): string {
    const name = categoriesById.get(expense.categoryId)?.name ?? "expense";
    return `${formatTHB(expense.amountSatang)} · ${expense.note || name}`;
  }

  /** Deletes right away and offers Undo for five seconds, which puts the very same row back. */
  function removeWithUndo(expense: Expense) {
    deleteExpense.mutate(expense.id, {
      onSuccess: () =>
        showToast({
          message: `Deleted ${describe(expense)}`,
          actionLabel: "Undo",
          onAction: () => restoreExpense.mutate(expense),
        }),
    });
  }

  function confirmPending(items: Expense[]) {
    confirmExpenses.mutate(items.map((item) => item.id));
  }

  function clearFilters() {
    setFilters(NO_FILTERS);
    setFilterBarKey((key) => key + 1);
  }

  // N adds an expense and / jumps to the search box, unless a field or dialog has the keyboard.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (isTyping(event.target) || document.querySelector('[role="dialog"]') !== null) return;
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openForm(null);
      } else if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeRules = rules.filter((rule) => rule.active).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium" aria-live="polite">
            {format(monthDate, "MMMM yyyy")}
          </span>
          <Button variant="outline" size="icon" onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
          {!isCurrentMonth && (
            <Button variant="outline" onClick={() => setMonthKey(currentMonth)}>
              This month
            </Button>
          )}
          <Button onClick={() => openForm(null)} title="Shortcut: N">
            <Plus className="size-4" />
            Add expense
            <kbd className="ml-1 rounded border border-primary-foreground/40 px-1 text-[10px]">N</kbd>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setManagerOpen(true)}>
          <Tags className="size-4" />
          Categories
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMethodsOpen(true)}>
          <CreditCard className="size-4" />
          Payment methods
        </Button>
        <Button variant="outline" size="sm" onClick={() => setRecurringOpen(true)}>
          <Repeat className="size-4" />
          Recurring{activeRules > 0 ? ` · ${activeRules}` : ""}
        </Button>
      </div>

      {(expensesQuery.isError || categoriesQuery.isError) && (
        <p className="text-sm text-destructive">
          Could not load expenses: {String(expensesQuery.error ?? categoriesQuery.error)}
        </p>
      )}

      <BudgetCard monthKey={monthKey} today={today} spentSatang={spent} budgetSatang={settings.budgetSatang} confirmed={confirmed} />

      <PendingExpensesCard
        pending={pending}
        categoriesById={categoriesById}
        onConfirm={confirmPending}
        onEdit={(expense) => openForm(expense)}
        onSkip={removeWithUndo}
      />
      <UpcomingRecurringCard rules={rules} monthKey={monthKey} today={today} categoriesById={categoriesById} />

      <CategoryBreakdown
        data={byCategory}
        budgets={budgetRows}
        selectedId={filters.categoryId}
        onSelect={(categoryId) => setFilters((current) => ({ ...current, categoryId }))}
      />
      <DailySpendingChart days={days} budgetSatang={settings.budgetSatang} />

      <Card>
        <CardHeader>
          <CardTitle>
            Transactions · {visible.length}
            {filtered && monthExpenses.length !== visible.length ? ` of ${monthExpenses.length}` : ""}
          </CardTitle>
          {visible.length > 0 && (
            <CardAction>
              <span className="text-sm tabular-nums text-muted-foreground">
                {filtered ? "Filtered total " : "Total "}
                {formatTHB(sumSatang(visible))}
              </span>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {monthExpenses.length > 0 && (
            <ExpenseFilterBar
              key={filterBarKey}
              ref={searchRef}
              filters={filters}
              onChange={setFilters}
              sort={sort}
              onSortChange={setSort}
              categories={categories}
              paymentMethods={methods}
              onClear={clearFilters}
            />
          )}

          {monthExpenses.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing recorded for {format(monthDate, "MMMM")} yet.
              </p>
              <Button onClick={() => openForm(null)}>
                <Plus className="size-4" />
                Add your first expense
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">No transactions match these filters.</p>
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <TransactionList
              expenses={visible}
              sort={sort}
              today={today}
              categoriesById={categoriesById}
              methodsById={methodsById}
              onEdit={(expense) => openForm(expense)}
              onDuplicate={duplicate}
              onDelete={setDeleting}
            />
          )}
        </CardContent>
      </Card>

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={editing}
        prefill={prefill}
        categories={categories}
        paymentMethods={methods}
        defaultDate={defaultDate}
        onDelete={setDeleting}
      />
      <CategoryManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
      <PaymentMethodManagerDialog open={methodsOpen} onOpenChange={setMethodsOpen} />
      <RecurringDialog open={recurringOpen} onOpenChange={setRecurringOpen} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title="Delete this expense?"
        description={deleting ? `${describe(deleting)} on ${format(parseISO(deleting.date), "MMM d, yyyy")}. You can undo it for a few seconds afterwards.` : ""}
        confirmLabel="Delete"
        onConfirm={() => deleting && removeWithUndo(deleting)}
      />
    </div>
  );
}
