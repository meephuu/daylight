import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SETTINGS_KEY, useSaveSettings, useSettingsMap } from "@/hooks/useSettings";
import { COUNTDOWN_KEY, parseCountdownIds, serializeCountdownIds } from "@/lib/countdown";

/** The task ids pinned to the Home countdown panel, plus a way to change them. */
export function useCountdownTasks() {
  const settings = useSettingsMap();
  const save = useSaveSettings();
  const queryClient = useQueryClient();
  const ids = useMemo(() => parseCountdownIds(settings.data?.[COUNTDOWN_KEY]), [settings.data]);

  return {
    ids,
    isLoading: settings.isPending,
    setIds: (next: number[]) => {
      const value = serializeCountdownIds(next);
      // Show the change at once, so ticking several boxes in a row builds on the previous click.
      queryClient.setQueryData<Record<string, string>>(SETTINGS_KEY, (current) => ({ ...current, [COUNTDOWN_KEY]: value }));
      save.mutate({ [COUNTDOWN_KEY]: value });
    },
  };
}
