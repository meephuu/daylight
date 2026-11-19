import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SETTINGS_KEY, useSettingsMap } from "@/hooks/useSettings";
import {
  createAppShortcut,
  deleteAppShortcut,
  listAppShortcuts,
  recordAppLaunch,
  restoreAppShortcut,
  setAutoIcon,
  updateAppShortcut,
  type AppShortcut,
  type AppShortcutInput,
} from "@/lib/db/appShortcuts";
import { setSetting } from "@/lib/db/settings";
import {
  fetchAppIcon,
  fetchIconFor,
  listInstalledApps,
  listInstalledBrowsers,
  openShortcut,
  pickSeeds,
  SEEDED_KEY,
} from "@/lib/launcher";
import { queryClient as sharedClient } from "@/lib/queryClient";

export const APP_SHORTCUTS_KEY = ["app-shortcuts"] as const;

export function useAppShortcuts() {
  return useQuery({ queryKey: APP_SHORTCUTS_KEY, queryFn: listAppShortcuts });
}

/** Looks up the icon after saving (a slow site, say), then fills it in if nothing else changed. */
async function fillIconLater(id: number, input: AppShortcutInput) {
  const icon = await fetchIconFor(input.kind, input.target);
  if (!icon) return;
  await setAutoIcon(id, input.target, icon);
  await sharedClient.invalidateQueries({ queryKey: APP_SHORTCUTS_KEY });
}

export interface SaveShortcutVariables {
  /** Omit to add a new shortcut. */
  id?: number;
  input: AppShortcutInput;
  /** The icon was still being looked up when the form was saved: finish it in the background. */
  iconPending?: boolean;
}

export function useSaveShortcut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input, iconPending }: SaveShortcutVariables) => {
      const savedId = id ?? (await createAppShortcut(input));
      if (id !== undefined) await updateAppShortcut(id, input);
      if (iconPending && input.iconSource === "auto") void fillIconLater(savedId, input);
      return savedId;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APP_SHORTCUTS_KEY }),
  });
}

export function useDeleteShortcut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAppShortcut,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APP_SHORTCUTS_KEY }),
  });
}

export function useRestoreShortcut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreAppShortcut,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APP_SHORTCUTS_KEY }),
  });
}

/**
 * Opens the shortcut, and records the opening once Windows has actually opened it (launch_count,
 * last_launched_at). Not shown anywhere for now: ranking by use will come from Screen Time.
 */
export function useLaunchShortcut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shortcut: AppShortcut) => {
      await openShortcut(shortcut);
      await recordAppLaunch(shortcut.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APP_SHORTCUTS_KEY }),
  });
}

export function useInstalledApps(enabled = true) {
  return useQuery({ queryKey: ["installed-apps"], queryFn: listInstalledApps, staleTime: 5 * 60_000, enabled });
}

export function useInstalledBrowsers() {
  return useQuery({ queryKey: ["installed-browsers"], queryFn: listInstalledBrowsers, staleTime: Infinity });
}

/** An installed app's icon for the picker list (small, cached for the session). */
export function useAppIcon(target: string, size = 64, enabled = true) {
  return useQuery({
    queryKey: ["app-icon", target, size],
    queryFn: () => fetchAppIcon(target, size),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    enabled,
  });
}

let seeding: Promise<void> | null = null;

/**
 * On the very first visit, fills the grid with a few apps that exist on this PC (Chrome, File Explorer,
 * Settings, VS Code, Spotify). Runs once ever: deleting them later does not bring them back.
 */
export function useSeedShortcuts() {
  const settings = useSettingsMap();
  const shortcuts = useAppShortcuts();
  const queryClient = useQueryClient();
  const ready = settings.isSuccess && shortcuts.isSuccess;
  const seeded = settings.data?.[SEEDED_KEY] === "1";
  const empty = (shortcuts.data?.length ?? 0) === 0;

  useEffect(() => {
    if (!ready || seeded || seeding) return;
    seeding = (async () => {
      if (empty) {
        const apps = await listInstalledApps().catch(() => []);
        for (const seed of pickSeeds(apps)) {
          const icon = await fetchAppIcon(seed.target);
          await createAppShortcut({ name: seed.name, kind: "app", target: seed.target, browser: "default", icon, iconSource: "auto" });
        }
      }
      await setSetting(SEEDED_KEY, "1");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: APP_SHORTCUTS_KEY }),
        queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
      ]);
    })().catch(() => {
      seeding = null;
    });
  }, [ready, seeded, empty, queryClient]);

  return useMemo(() => ({ seeding: ready && !seeded }), [ready, seeded]);
}
