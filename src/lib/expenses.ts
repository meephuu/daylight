import { format } from "date-fns";
import type { Expense } from "@/lib/db/expenses";

export const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Education",
  "Other",
];

export const CURRENCIES = ["THB", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD"];

export const BUDGET_KEY = "monthly_budget";
export const CURRENCY_KEY = "currency";

/** Thai baht unless another currency was chosen under "Edit budget" on the Expenses page. */
export function defaultCurrency(): string {
  return "THB";
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** 1,284 / 12.9K - for chart labels, where space is tight. */
export function formatCompact(amount: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(amount);
}

/** "2026-10" for a date, matching the start of stored "YYYY-MM-DD" dates. */
export function monthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

export function expensesInMonth(expenses: Expense[], month: string): Expense[] {
  return expenses.filter((expense) => expense.date.startsWith(month));
}

export function sumAmounts(expenses: Expense[]): number {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

export interface CategoryTotal {
  category: string;
  total: number;
}

const MAX_CATEGORY_BARS = 8;

/** Totals per category, largest first; the long tail is folded into one "Other categories" bar. */
export function categoryTotals(expenses: Expense[]): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const key = expense.category.trim() || "Uncategorised";
    totals.set(key, (totals.get(key) ?? 0) + expense.amount);
  }
  const sorted = [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
  if (sorted.length <= MAX_CATEGORY_BARS) return sorted;
  const head = sorted.slice(0, MAX_CATEGORY_BARS - 1);
  const tail = sorted.slice(MAX_CATEGORY_BARS - 1);
  return [...head, { category: "Other categories", total: tail.reduce((sum, c) => sum + c.total, 0) }];
}

export type BudgetState = "ok" | "warning" | "over";

export function budgetState(spent: number, budget: number): BudgetState {
  if (spent > budget) return "over";
  return spent >= budget * 0.8 ? "warning" : "ok";
}
