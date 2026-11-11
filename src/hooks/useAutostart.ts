import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

const AUTOSTART_KEY = ["autostart"] as const;

/** Whether the OS launches the app at login. The state lives in the OS (registry), not our DB. */
export function useAutostart() {
  return useQuery({ queryKey: AUTOSTART_KEY, queryFn: isEnabled });
}

export function useSetAutostart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (enabled) await enable();
      else await disable();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: AUTOSTART_KEY }),
  });
}
