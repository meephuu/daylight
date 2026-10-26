import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listSettings, setSetting } from "@/lib/db/settings";

export const SETTINGS_KEY = ["settings"] as const;

/** Raw key/value settings; feature hooks (expenses, countdown) pick their own keys out of it. */
export function useSettingsMap() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: listSettings });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, string>) => {
      for (const [key, value] of Object.entries(values)) await setSetting(key, value);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
