import { daysInMonthKey, shiftMonthKey } from "@/lib/bangkok";
import type { Category } from "@/lib/db/categories";
import type { Expense } from "@/lib/db/expenses";
import type { PaymentMethod } from "@/lib/db/paymentMethods";
import { formatTHB, satangToInput } from "@/lib/money";

/** The monthly budget lives in the settings table, in whole satang. */
export const BUDGET_KEY = "monthly_budget_satang";

/** Entries created by a recurring rule wait as "pending" and count towards nothing until confirmed. */
export function confirmedOnly(expenses: Expense[]): Expense[] {
  return expenses.filter((expense) => expense.status === "confirmed");
}

export function pendingOnly(expenses: Expense[]): Expense[] {
  return expenses.filter((expense) => expense.status === "pending");
}

export function expensesInMonth(expenses: Expense[], monthKey: string): Expense[] {
  return expenses.filter((expense) => expense.date.startsWith(monthKey));
}

export function sumSatang(expenses: Expense[]): number {
  return expenses.reduce((total, expense) => total + expense.amountSatang, 0);
}

export interface CategoryTotal {
  category: Category;
  totalSatang: number;
}

/** Spending per category, largest first. Categories with no spending are left out. */
export function categoryTotals(expenses: Expense[], categoriesById: Map<number, Category>): CategoryTotal[] {
  const totals = new Map<number, number>();
  for (const expense of expenses) {
    totals.set(expense.categoryId, (totals.get(expense.categoryId) ?? 0) + expense.amountSatang);
  }
  const result: CategoryTotal[] = [];
  for (const [categoryId, totalSatang] of totals) {
    const category = categoriesById.get(categoryId);
    if (category) result.push({ category, totalSatang });
  }
  return result.sort((a, b) => b.totalSatang - a.totalSatang);
}

// ---------------------------------------------------------------------------------------------------
// Budget state
// ---------------------------------------------------------------------------------------------------

export type BudgetState = "ok" | "warning" | "over";

/** Blue below 75% of the budget, amber from 75% up to and including 100%, red once it is exceeded. */
export function budgetState(spentSatang: number, budgetSatang: number): BudgetState {
  if (spentSatang > budgetSatang) return "over";
  return spentSatang * 4 >= budgetSatang * 3 ? "warning" : "ok";
}

// ---------------------------------------------------------------------------------------------------
// Summary figures
// ---------------------------------------------------------------------------------------------------

function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}

export interface SafeToSpend {
  /** Satang per day, rounded down; 0 when the budget is used up. */
  perDaySatang: number;
  daysLeft: number;
}

/**
 * What can be spent each remaining day (today included) without passing the budget. Not meaningful for a
 * month that is already over, so that returns null.
 */
export function safeToSpend(budgetSatang: number, spentSatang: number, monthKey: string, today: string): SafeToSpend | null {
  const currentMonth = today.slice(0, 7);
  if (monthKey < currentMonth) return null;
  const total = daysInMonthKey(monthKey);
  const daysLeft = monthKey === currentMonth ? total - dayOfMonth(today) + 1 : total;
  const remaining = budgetSatang - spentSatang;
  return { perDaySatang: remaining > 0 ? Math.floor(remaining / daysLeft) : 0, daysLeft };
}

/** Spending so far scaled to a full month, for the month in progress only. */
export function projectedMonthEnd(spentSatang: number, monthKey: string, today: string): number | null {
  if (monthKey !== today.slice(0, 7)) return null;
  return Math.round((spentSatang / dayOfMonth(today)) * daysInMonthKey(monthKey));
}

export interface MonthComparison {
  previousMonthKey: string;
  previousSatang: number;
  /** Day of the previous month the comparison stops at; null when the whole month is compared. */
  throughDay: number | null;
  deltaSatang: number;
  /** Rounded percent change, or null when the previous month had no spending. */
  percent: number | null;
}

/**
 * Compares with the month before. While the month is still running the comparison covers the same days of
 * the previous month, so a half-finished month is not set against a complete one.
 */
export function compareWithPreviousMonth(
  confirmed: Expense[],
  spentSatang: number,
  monthKey: string,
  today: string,
): MonthComparison | null {
  const currentMonth = today.slice(0, 7);
  if (monthKey > currentMonth) return null;
  const previousMonthKey = shiftMonthKey(monthKey, -1);
  const throughDay = monthKey === currentMonth ? Math.min(dayOfMonth(today), daysInMonthKey(previousMonthKey)) : null;
  const previousSatang = sumSatang(
    expensesInMonth(confirmed, previousMonthKey).filter(
      (expense) => throughDay === null || dayOfMonth(expense.date) <= throughDay,
    ),
  );
  const deltaSatang = spentSatang - previousSatang;
  return {
    previousMonthKey,
    previousSatang,
    throughDay,
    deltaSatang,
    percent: previousSatang > 0 ? Math.round((deltaSatang / previousSatang) * 100) : null,
  };
}

export interface DailyTotal {
  day: number;
  date: string;
  totalSatang: number;
}

/** One entry per day of the month, zero for days without spending. */
export function dailyTotals(expenses: Expense[], monthKey: string): DailyTotal[] {
  const totals = new Array<number>(daysInMonthKey(monthKey)).fill(0);
  for (const expense of expenses) {
    if (!expense.date.startsWith(monthKey)) continue;
    const index = dayOfMonth(expense.date) - 1;
    if (index >= 0 && index < totals.length) totals[index] = (totals[index] ?? 0) + expense.amountSatang;
  }
  return totals.map((totalSatang, index) => ({
    day: index + 1,
    date: `${monthKey}-${String(index + 1).padStart(2, "0")}`,
    totalSatang,
  }));
}

// ---------------------------------------------------------------------------------------------------
// Per-category budgets
// ---------------------------------------------------------------------------------------------------

export interface CategoryBudgetRow {
  category: Category;
  budgetSatang: number;
  spentSatang: number;
}

/** Categories that have a monthly budget, with what has been spent in them this month. */
export function categoryBudgetRows(totals: CategoryTotal[], categories: Category[]): CategoryBudgetRow[] {
  const spentById = new Map(totals.map((item) => [item.category.id, item.totalSatang]));
  return categories
    .filter((category) => category.monthlyBudgetSatang !== null && (!category.archived || spentById.has(category.id)))
    .map((category) => ({
      category,
      budgetSatang: category.monthlyBudgetSatang ?? 0,
      spentSatang: spentById.get(category.id) ?? 0,
    }));
}

// ---------------------------------------------------------------------------------------------------
// Searching, filtering, sorting
// ---------------------------------------------------------------------------------------------------

export type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export interface ExpenseFilters {
  search: string;
  categoryId: number | null;
  /** A payment method id, "none" for entries without one, or null for any. */
  paymentMethod: number | "none" | null;
  minSatang: number | null;
  maxSatang: number | null;
}

export const NO_FILTERS: ExpenseFilters = {
  search: "",
  categoryId: null,
  paymentMethod: null,
  minSatang: null,
  maxSatang: null,
};

export function hasActiveFilters(filters: ExpenseFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.categoryId !== null ||
    filters.paymentMethod !== null ||
    filters.minSatang !== null ||
    filters.maxSatang !== null
  );
}

export function filterExpenses(
  expenses: Expense[],
  filters: ExpenseFilters,
  categoriesById: Map<number, Category>,
  methodsById: Map<number, PaymentMethod>,
): Expense[] {
  const terms = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return expenses.filter((expense) => {
    if (filters.categoryId !== null && expense.categoryId !== filters.categoryId) return false;
    if (filters.paymentMethod === "none" && expense.paymentMethodId !== null) return false;
    if (typeof filters.paymentMethod === "number" && expense.paymentMethodId !== filters.paymentMethod) return false;
    if (filters.minSatang !== null && expense.amountSatang < filters.minSatang) return false;
    if (filters.maxSatang !== null && expense.amountSatang > filters.maxSatang) return false;
    if (terms.length === 0) return true;
    const haystack = [
      expense.note,
      categoriesById.get(expense.categoryId)?.name ?? "",
      expense.paymentMethodId === null ? "" : (methodsById.get(expense.paymentMethodId)?.name ?? ""),
      satangToInput(expense.amountSatang),
      formatTHB(expense.amountSatang),
      expense.date,
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function sortExpenses(expenses: Expense[], sort: SortKey): Expense[] {
  const sorted = [...expenses];
  switch (sort) {
    case "date-desc":
      return sorted.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    case "date-asc":
      return sorted.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    case "amount-desc":
      return sorted.sort((a, b) => b.amountSatang - a.amountSatang || b.id - a.id);
    case "amount-asc":
      return sorted.sort((a, b) => a.amountSatang - b.amountSatang || b.id - a.id);
  }
}

/** Splits an already sorted list into consecutive runs sharing a date. */
export function groupByDate(expenses: Expense[]): [string, Expense[]][] {
  const groups: [string, Expense[]][] = [];
  for (const expense of expenses) {
    const last = groups[groups.length - 1];
    if (last && last[0] === expense.date) last[1].push(expense);
    else groups.push([expense.date, [expense]]);
  }
  return groups;
}
