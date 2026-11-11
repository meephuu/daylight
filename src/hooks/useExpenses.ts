import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmExpenses,
  createExpense,
  deleteExpense,
  listExpenses,
  restoreExpense,
  updateExpense,
  type Expense,
  type ExpenseInput,
} from "@/lib/db/expenses";
import { SETTINGS_KEY } from "@/hooks/useSettings";
import { deleteSetting, listSettings, setSetting } from "@/lib/db/settings";
import { BUDGET_KEY } from "@/lib/expenses";

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

/** Puts a deleted expense back as it was; used by the Undo button. */
export function useRestoreExpense() {
  return useExpenseMutation((expense: Expense) => restoreExpense(expense));
}

export function useConfirmExpenses() {
  return useExpenseMutation((ids: number[]) => confirmExpenses(ids));
}

export interface ExpenseSettings {
  /** Monthly budget in satang, or null when none is set. */
  budgetSatang: number | null;
  isLoading: boolean;
}

export function useExpenseSettings(): ExpenseSettings {
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: listSettings });
  const raw = Number(query.data?.[BUDGET_KEY]);
  return {
    budgetSatang: Number.isSafeInteger(raw) && raw > 0 ? raw : null,
    isLoading: query.isPending,
  };
}

export function useSaveBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (budgetSatang: number | null) => {
      if (budgetSatang === null) await deleteSetting(BUDGET_KEY);
      else await setSetting(BUDGET_KEY, String(budgetSatang));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
