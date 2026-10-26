import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  deleteCategory,
  listCategories,
  reorderCategories,
  setCategoryArchived,
  updateCategory,
  type Category,
  type CategoryInput,
} from "@/lib/db/categories";
import { EXPENSES_KEY } from "@/hooks/useExpenses";
import { RECURRING_KEY } from "@/hooks/useRecurring";

export const CATEGORIES_KEY = ["categories"] as const;

export function useCategories() {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: listCategories });
}

/** Category changes can change how expenses display (names, colours) or move them, so both caches refresh. */
function useCategoryMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }),
        queryClient.invalidateQueries({ queryKey: EXPENSES_KEY }),
        queryClient.invalidateQueries({ queryKey: RECURRING_KEY }),
      ]),
  });
}

export function useCreateCategory() {
  return useCategoryMutation((input: CategoryInput) => createCategory(input));
}

export function useUpdateCategory() {
  return useCategoryMutation(({ id, input }: { id: number; input: CategoryInput }) => updateCategory(id, input));
}

export function useSetCategoryArchived() {
  return useCategoryMutation(({ id, archived }: { id: number; archived: boolean }) =>
    setCategoryArchived(id, archived),
  );
}

export function useDeleteCategory() {
  return useCategoryMutation(({ id, reassignTo }: { id: number; reassignTo: number | null }) =>
    deleteCategory(id, reassignTo),
  );
}

/** Optimistic: the list settles into its new order at once while the database catches up. */
export function useReorderCategories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: number[]) => reorderCategories(orderedIds),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: CATEGORIES_KEY });
      const previous = queryClient.getQueryData<Category[]>(CATEGORIES_KEY);
      queryClient.setQueryData<Category[]>(CATEGORIES_KEY, (categories) => {
        if (!categories) return categories;
        const position = new Map(orderedIds.map((id, index) => [id, index + 1]));
        return [...categories]
          .map((category) => ({ ...category, sortOrder: position.get(category.id) ?? category.sortOrder }))
          .sort((a, b) => Number(a.archived) - Number(b.archived) || a.sortOrder - b.sortOrder || a.id - b.id);
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(CATEGORIES_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}
