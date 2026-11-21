import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listFocusDays, listFocusSessionsBetween, listFocusSessionsOn, setFocusSessionTask } from "@/lib/db/focus";
import { useSettingsMap } from "@/hooks/useSettings";
import { FOCUS_KEY, readFocusSettings } from "@/lib/focus";

export { FOCUS_KEY };

export function useFocusSessionsOn(day: string) {
  return useQuery({ queryKey: [...FOCUS_KEY, "day", day], queryFn: () => listFocusSessionsOn(day) });
}

export function useFocusSessionsBetween(from: string, to: string) {
  return useQuery({ queryKey: [...FOCUS_KEY, "between", from, to], queryFn: () => listFocusSessionsBetween(from, to) });
}

export function useFocusDays(from: string, to?: string) {
  return useQuery({
    queryKey: [...FOCUS_KEY, "days", from, to],
    queryFn: () => listFocusDays(from, to),
    placeholderData: (previous) => previous,
  });
}

/** Changes the task a finished session counts for. */
export function useSetFocusSessionTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, task }: { id: number; task: Parameters<typeof setFocusSessionTask>[1] }) => setFocusSessionTask(id, task),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FOCUS_KEY }),
  });
}

/** The timer's lengths and the daily goal, from the settings table (defaults until they load). */
export function useFocusSettings() {
  const { data } = useSettingsMap();
  return useMemo(() => readFocusSettings(data ?? {}), [data]);
}
