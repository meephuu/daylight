import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFocusSession,
  deleteFocusSession,
  listFocusSessions,
  type FocusSessionInput,
} from "@/lib/db/focusSessions";

export const FOCUS_SESSIONS_KEY = ["focusSessions"] as const;

export function useFocusSessions() {
  return useQuery({ queryKey: FOCUS_SESSIONS_KEY, queryFn: listFocusSessions });
}

export function useCreateFocusSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FocusSessionInput) => createFocusSession(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOCUS_SESSIONS_KEY }),
  });
}

export function useDeleteFocusSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteFocusSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOCUS_SESSIONS_KEY }),
  });
}
