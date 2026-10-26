import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EXPENSES_KEY } from "@/hooks/useExpenses";
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  renamePaymentMethod,
  setPaymentMethodArchived,
} from "@/lib/db/paymentMethods";

export const PAYMENT_METHODS_KEY = ["payment-methods"] as const;

export function usePaymentMethods() {
  return useQuery({ queryKey: PAYMENT_METHODS_KEY, queryFn: listPaymentMethods });
}

/** Deleting a method clears it from the entries that used it, so those refresh too. */
function usePaymentMethodMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_KEY }),
        queryClient.invalidateQueries({ queryKey: EXPENSES_KEY }),
        queryClient.invalidateQueries({ queryKey: ["recurring"] }),
      ]),
  });
}

export function useCreatePaymentMethod() {
  return usePaymentMethodMutation((name: string) => createPaymentMethod(name));
}

export function useRenamePaymentMethod() {
  return usePaymentMethodMutation(({ id, name }: { id: number; name: string }) => renamePaymentMethod(id, name));
}

export function useSetPaymentMethodArchived() {
  return usePaymentMethodMutation(({ id, archived }: { id: number; archived: boolean }) =>
    setPaymentMethodArchived(id, archived),
  );
}

export function useDeletePaymentMethod() {
  return usePaymentMethodMutation((id: number) => deletePaymentMethod(id));
}
