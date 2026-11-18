import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listFocusDays, listFocusSessionsBetween, listFocusSessionsOn } from "@/lib/db/focus";
import { useSettingsMap } from "@/hooks/useSettings";
import { FOCUS_KEY, readFocusSettings } from "@/lib/focus";

export { FOCUS_KEY };

export function useFocusSessionsOn(day: string) {
  return useQuery({ queryKey: [...FOCUS_KEY, "day", day], queryFn: () => listFocusSessionsOn(day) });
}

export function useFocusSessionsBetween(from: string, to: string) {
  return useQuery({ queryKey: [...FOCUS_KEY, "between", from, to], queryFn: () => listFocusSessionsBetween(from, to) });
}

export function useFocusDays(from: string) {
  return useQuery({ queryKey: [...FOCUS_KEY, "days", from], queryFn: () => listFocusDays(from) });
}

/** The timer's lengths and the daily goal, from the settings table (defaults until they load). */
export function useFocusSettings() {
  const { data } = useSettingsMap();
  return useMemo(() => readFocusSettings(data ?? {}), [data]);
}
