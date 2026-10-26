import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EXPENSES_KEY } from "@/hooks/useExpenses";
import { bangkokToday } from "@/lib/bangkok";
import {
  createRecurring,
  deleteRecurring,
  generateDueExpenses,
  listRecurring,
  setRecurringActive,
  updateRecurring,
  type RecurringInput,
} from "@/lib/db/recurring";

export const RECURRING_KEY = ["recurring"] as const;

export function useRecurring() {
  return useQuery({ queryKey: RECURRING_KEY, queryFn: listRecurring });
}

function useRecurringMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: RECURRING_KEY }),
        queryClient.invalidateQueries({ queryKey: EXPENSES_KEY }),
      ]),
  });
}

export function useCreateRecurring() {
  return useRecurringMutation((input: RecurringInput) => createRecurring(input));
}

export function useUpdateRecurring() {
  return useRecurringMutation(({ id, input }: { id: number; input: RecurringInput }) => updateRecurring(id, input));
}

export function useSetRecurringActive() {
  return useRecurringMutation(({ id, active }: { id: number; active: boolean }) =>
    setRecurringActive(id, active, bangkokToday()),
  );
}

export function useDeleteRecurring() {
  return useRecurringMutation((id: number) => deleteRecurring(id));
}

/**
 * Turns every recurring expense that has fallen due (up to today, Bangkok time) into a pending entry.
 * Runs when the rules load or change; once a rule is up to date it costs nothing.
 */
export function useRecurringGenerator(): void {
  const queryClient = useQueryClient();
  const rules = useRecurring().data;

  useEffect(() => {
    if (!rules) return;
    void generateDueExpenses(bangkokToday())
      .then((created) => {
        if (created === 0) return;
        void queryClient.invalidateQueries({ queryKey: EXPENSES_KEY });
        void queryClient.invalidateQueries({ queryKey: RECURRING_KEY });
      })
      .catch((error: unknown) => console.error("Could not create recurring expenses", error));
  }, [rules, queryClient]);
}
