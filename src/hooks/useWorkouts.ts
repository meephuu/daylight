import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWorkout,
  deleteWorkout,
  listWorkoutLogs,
  listWorkouts,
  moveWorkout,
  replaceAllWorkouts,
  setWorkoutDone,
  updateWorkout,
  type Workout,
  type WorkoutInput,
  type WorkoutLog,
} from "@/lib/db/workouts";

export const WORKOUTS_KEY = ["workouts"] as const;
export const WORKOUT_LOGS_KEY = ["workoutLogs"] as const;

export function useWorkouts() {
  return useQuery({ queryKey: WORKOUTS_KEY, queryFn: listWorkouts });
}

export function useWorkoutLogs() {
  return useQuery({ queryKey: WORKOUT_LOGS_KEY, queryFn: listWorkoutLogs });
}

function useWorkoutMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: WORKOUTS_KEY }),
        queryClient.invalidateQueries({ queryKey: WORKOUT_LOGS_KEY }),
      ]),
  });
}

// Every plan change takes the week being looked at: it applies from that week onward and earlier weeks keep
// what they had (see lib/db/workouts.ts).

export function useCreateWorkout() {
  return useWorkoutMutation(({ input, weekStart }: { input: WorkoutInput; weekStart: string }) =>
    createWorkout(input, weekStart),
  );
}

export function useUpdateWorkout() {
  return useWorkoutMutation(({ id, input, weekStart }: { id: number; input: WorkoutInput; weekStart: string }) =>
    updateWorkout(id, input, weekStart),
  );
}

export function useDeleteWorkout() {
  return useWorkoutMutation(({ id, weekStart }: { id: number; weekStart: string }) => deleteWorkout(id, weekStart));
}

/** Adds every workout of a starter plan, one after another. */
export function useCreateWorkouts() {
  return useWorkoutMutation(async ({ inputs, weekStart }: { inputs: WorkoutInput[]; weekStart: string }) => {
    for (const input of inputs) await createWorkout(input, weekStart);
  });
}

/** Replaces the plan from this week onward with a starter plan; earlier weeks are left alone. */
export function useReplaceWorkouts() {
  return useWorkoutMutation(({ inputs, weekStart }: { inputs: WorkoutInput[]; weekStart: string }) =>
    replaceAllWorkouts(inputs, weekStart),
  );
}

/** Optimistic: the card jumps to its new day straight away (drag-and-drop), rolled back on error. */
export function useMoveWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dayOfWeek, weekStart }: { id: number; dayOfWeek: number; weekStart: string }) =>
      moveWorkout(id, dayOfWeek, weekStart),
    onMutate: async ({ id, dayOfWeek }) => {
      await queryClient.cancelQueries({ queryKey: WORKOUTS_KEY });
      const previous = queryClient.getQueryData<Workout[]>(WORKOUTS_KEY);
      queryClient.setQueryData<Workout[]>(WORKOUTS_KEY, (workouts) =>
        workouts?.map((workout) => (workout.id === id ? { ...workout, dayOfWeek } : workout)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(WORKOUTS_KEY, context.previous);
    },
    // A move can split the workout into a new version, which takes this week's ticks with it.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: WORKOUTS_KEY }),
        queryClient.invalidateQueries({ queryKey: WORKOUT_LOGS_KEY }),
      ]),
  });
}

/** Optimistic tick so the check mark responds instantly. */
export function useSetWorkoutDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { workoutId: number; weekStart: string; doneDate: string; done: boolean }) =>
      setWorkoutDone(variables.workoutId, variables.weekStart, variables.doneDate, variables.done),
    onMutate: async ({ workoutId, weekStart, doneDate, done }) => {
      await queryClient.cancelQueries({ queryKey: WORKOUT_LOGS_KEY });
      const previous = queryClient.getQueryData<WorkoutLog[]>(WORKOUT_LOGS_KEY);
      queryClient.setQueryData<WorkoutLog[]>(WORKOUT_LOGS_KEY, (logs) => {
        const rest = (logs ?? []).filter(
          (log) => !(log.workoutId === workoutId && log.weekStart === weekStart),
        );
        // Temporary negative id until the refetch brings the real row.
        return done ? [...rest, { id: -Date.now(), workoutId, weekStart, doneDate }] : rest;
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(WORKOUT_LOGS_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: WORKOUT_LOGS_KEY }),
  });
}
