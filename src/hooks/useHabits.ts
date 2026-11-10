import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createHabit,
  deleteHabit,
  listHabitLogs,
  listHabits,
  reorderHabits,
  setHabitArchived,
  setHabitLogCount,
  updateHabit,
  type Habit,
  type HabitInput,
} from "@/lib/db/habits";

export const HABITS_KEY = ["habits"] as const;
export const HABIT_LOGS_KEY = ["habitLogs"] as const;

export function useHabits() {
  return useQuery({ queryKey: HABITS_KEY, queryFn: listHabits });
}

export function useHabitLogs() {
  return useQuery({ queryKey: HABIT_LOGS_KEY, queryFn: listHabitLogs });
}

function useHabitMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: HABITS_KEY }),
        queryClient.invalidateQueries({ queryKey: HABIT_LOGS_KEY }),
      ]),
  });
}

export function useCreateHabit() {
  return useHabitMutation((input: HabitInput) => createHabit(input));
}

export function useUpdateHabit() {
  return useHabitMutation(({ id, input }: { id: number; input: HabitInput }) =>
    updateHabit(id, input),
  );
}

export function useSetHabitArchived() {
  return useHabitMutation(({ id, archived }: { id: number; archived: boolean }) =>
    setHabitArchived(id, archived),
  );
}

export function useDeleteHabit() {
  return useHabitMutation((id: number) => deleteHabit(id));
}

export function useSetHabitLogCount() {
  return useHabitMutation(
    ({ habitId, date, count }: { habitId: number; date: string; count: number }) =>
      setHabitLogCount(habitId, date, count),
  );
}

/** Optimistic: the cards jump to their new places at once, and snap back if saving fails. */
export function useReorderHabits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: number[]) => reorderHabits(orderedIds),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: HABITS_KEY });
      const previous = queryClient.getQueryData<Habit[]>(HABITS_KEY);
      queryClient.setQueryData<Habit[]>(HABITS_KEY, (habits) => {
        if (!habits) return habits;
        const position = new Map(orderedIds.map((id, index) => [id, index + 1]));
        return [...habits]
          .map((habit) => ({ ...habit, sortOrder: position.get(habit.id) ?? habit.sortOrder }))
          .sort((a, b) => Number(a.archived) - Number(b.archived) || a.sortOrder - b.sortOrder || a.id - b.id);
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(HABITS_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: HABITS_KEY }),
  });
}
