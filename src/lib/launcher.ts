import { invoke } from "@tauri-apps/api/core";
import type { AppShortcut } from "@/lib/db/appShortcuts";

/** An app on this PC, as Start's "All apps" lists it (src-tauri/src/launcher.rs). */
export interface InstalledApp {
  name: string;
  /** "shell:AppsFolder\<id>". */
  target: string;
}

export const BROWSERS = [
  { id: "default", label: "Default browser" },
  { id: "chrome", label: "Google Chrome" },
  { id: "edge", label: "Microsoft Edge" },
  { id: "firefox", label: "Firefox" },
  { id: "brave", label: "Brave" },
] as const;

export function browserLabel(id: string): string {
  return BROWSERS.find((browser) => browser.id === id)?.label ?? "Default browser";
}

export const SEEDED_KEY = "apps_seeded";

const inApp = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function listInstalledApps(): Promise<InstalledApp[]> {
  if (!inApp()) return [];
  return invoke<InstalledApp[]>("launcher_apps");
}

/** The app's icon as a PNG data: URL, or null when Windows has none for it. */
export async function fetchAppIcon(target: string, size = 128): Promise<string | null> {
  if (!inApp()) return null;
  return invoke<string | null>("launcher_app_icon", { target, size }).catch(() => null);
}

/** The site's own icon as a data: URL (fetched from the site itself), or null. */
export async function fetchSiteIcon(url: string): Promise<string | null> {
  if (!inApp()) return null;
  return invoke<string | null>("launcher_site_icon", { url }).catch(() => null);
}

export function fetchIconFor(kind: AppShortcut["kind"], target: string): Promise<string | null> {
  return kind === "website" ? fetchSiteIcon(target) : fetchAppIcon(target);
}

/** Ids of the browsers in BROWSERS (other than "default") installed on this PC. */
export async function listInstalledBrowsers(): Promise<string[]> {
  if (!inApp()) return [];
  return invoke<string[]>("launcher_browsers");
}

/** Opens the shortcut; rejects with a sentence saying why when Windows could not. */
export async function openShortcut(shortcut: Pick<AppShortcut, "kind" | "target" | "browser">): Promise<void> {
  if (!inApp()) throw new Error("Opening apps only works in the desktop app.");
  await invoke("launcher_open", { kind: shortcut.kind, target: shortcut.target, browser: shortcut.browser });
}

/** A picked image file (or a picked program's icon) as a data: URL. */
export async function readImageFile(path: string): Promise<string> {
  return invoke<string>("launcher_read_image", { path });
}

/**
 * A typed web address made whole: "github.com" becomes "https://github.com/". Null when it is not an
 * http(s) address with a real host name.
 */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname;
    const looksReal = host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^[^.]+(\.[^.]+)+$/.test(host);
    if (!looksReal || host.startsWith(".") || host.endsWith(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** A website's host without "www.", for meta lines ("github.com"). */
export function siteHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** A readable line for where a shortcut goes: "github.com in Chrome", "App", or the file name. */
export function describeTarget(shortcut: Pick<AppShortcut, "kind" | "target" | "browser">): string {
  if (shortcut.kind === "website") {
    const host = siteHost(shortcut.target);
    return shortcut.browser === "default" ? host : `${host} in ${browserLabel(shortcut.browser).replace(/^(Google|Microsoft) /, "")}`;
  }
  if (shortcut.target.toLowerCase().startsWith("shell:appsfolder\\")) return "App on this PC";
  return shortcut.target.split(/[\\/]/).pop() || shortcut.target;
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** A-Z by name. */
export function sortShortcuts(shortcuts: AppShortcut[]): AppShortcut[] {
  return [...shortcuts].sort((a, b) => collator.compare(a.name, b.name) || a.id - b.id);
}

/** Case-insensitive match on the name. */
export function filterShortcuts(shortcuts: AppShortcut[], query: string): AppShortcut[] {
  const wanted = query.trim().toLocaleLowerCase();
  if (!wanted) return shortcuts;
  return shortcuts.filter((shortcut) => shortcut.name.toLocaleLowerCase().includes(wanted));
}

/** The first-run examples, matched against the apps installed here by name (first match wins). */
const SEEDS: { name: string; match: RegExp }[] = [
  { name: "Chrome", match: /^google chrome$/i },
  { name: "File Explorer", match: /^file explorer$/i },
  { name: "Settings", match: /^settings$/i },
  { name: "VS Code", match: /^visual studio code( \(user\))?$/i },
  { name: "Spotify", match: /^spotify$/i },
];

/** Picks the first-run examples that exist on this PC. File Explorer and Settings fall back to direct targets. */
export function pickSeeds(apps: InstalledApp[]): { name: string; target: string }[] {
  const picked: { name: string; target: string }[] = [];
  for (const seed of SEEDS) {
    const app = apps.find((candidate) => seed.match.test(candidate.name));
    if (app) picked.push({ name: seed.name, target: app.target });
    else if (seed.name === "File Explorer") picked.push({ name: seed.name, target: "C:\\Windows\\explorer.exe" });
    else if (seed.name === "Settings") picked.push({ name: seed.name, target: "ms-settings:" });
  }
  return picked;
}
