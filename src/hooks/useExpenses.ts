import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
  type ExpenseInput,
} from "@/lib/db/expenses";
import { SETTINGS_KEY } from "@/hooks/useSettings";
import { deleteSetting, listSettings, setSetting } from "@/lib/db/settings";
import { BUDGET_KEY, CURRENCY_KEY, defaultCurrency } from "@/lib/expenses";

export const EXPENSES_KEY = ["expenses"] as const;

export function useExpenses() {
  return useQuery({ queryKey: EXPENSES_KEY, queryFn: listExpenses });
}

function useExpenseMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXPENSES_KEY }),
  });
}

export function useCreateExpense() {
  return useExpenseMutation((input: ExpenseInput) => createExpense(input));
}

export function useUpdateExpense() {
  return useExpenseMutation(({ id, input }: { id: number; input: ExpenseInput }) =>
    updateExpense(id, input),
  );
}

export function useDeleteExpense() {
  return useExpenseMutation((id: number) => deleteExpense(id));
}

export interface ExpenseSettings {
  /** Monthly budget, or null when none is set. */
  budget: number | null;
  currency: string;
  isLoading: boolean;
}

export function useExpenseSettings(): ExpenseSettings {
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: listSettings });
  const rawBudget = Number(query.data?.[BUDGET_KEY]);
  return {
    budget: Number.isFinite(rawBudget) && rawBudget > 0 ? rawBudget : null,
    currency: query.data?.[CURRENCY_KEY] ?? defaultCurrency(),
    isLoading: query.isPending,
  };
}

export function useSaveExpenseSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ budget, currency }: { budget: number | null; currency: string }) => {
      if (budget === null) await deleteSetting(BUDGET_KEY);
      else await setSetting(BUDGET_KEY, String(budget));
      await setSetting(CURRENCY_KEY, currency);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
