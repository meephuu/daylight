import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  deleteTask,
  listTasks,
  setTaskDueDate,
  setTaskStatus,
  updateTask,
  type Task,
  type TaskInput,
  type TaskStatus,
} from "@/lib/db/tasks";

export const TASKS_KEY = ["tasks"] as const;
export const PROJECTS_KEY = ["projects"] as const;

export function useTasks() {
  return useQuery({ queryKey: TASKS_KEY, queryFn: listTasks });
}

/** Task changes also affect project progress, so both caches are refreshed. */
function useTaskMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
        queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
      ]),
  });
}

export function useCreateTask() {
  return useTaskMutation((input: TaskInput) => createTask(input));
}

export function useUpdateTask() {
  return useTaskMutation(({ id, input }: { id: number; input: TaskInput }) =>
    updateTask(id, input),
  );
}

export function useSetTaskStatus() {
  return useTaskMutation(({ id, status }: { id: number; status: TaskStatus }) =>
    setTaskStatus(id, status),
  );
}

/** Optimistic: the task jumps to its new day immediately (drag-and-drop), rolled back on error. */
export function useSetTaskDueDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dueDate }: { id: number; dueDate: string | null }) =>
      setTaskDueDate(id, dueDate),
    onMutate: async ({ id, dueDate }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY });
      const previous = queryClient.getQueryData<Task[]>(TASKS_KEY);
      queryClient.setQueryData<Task[]>(TASKS_KEY, (tasks) =>
        tasks?.map((task) => (task.id === id ? { ...task, dueDate } : task)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(TASKS_KEY, context.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
        queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
      ]),
  });
}

export function useDeleteTask() {
  return useTaskMutation((id: number) => deleteTask(id));
}
