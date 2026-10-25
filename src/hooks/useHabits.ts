import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createHabit,
  deleteHabit,
  listHabitLogs,
  listHabits,
  setHabitArchived,
  setHabitLogCount,
  updateHabit,
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
