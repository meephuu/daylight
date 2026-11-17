import { bangkokDateTime } from "@/lib/bangkok";
import { importPlay } from "@/lib/db/music";
import { queryClient } from "@/lib/queryClient";
import { canReadHistory, getRecentlyPlayed, imageFor, useSpotify } from "@/lib/spotify";

/**
 * Brings plays from other devices (the phone) into the listening history, from Spotify's recently
 * played list. Spotify keeps only the last 50 songs there, so older plays made while Daylight was
 * closed cannot be recovered. Plays the PC already recorded live are skipped (see importPlay).
 */

const CURSOR_KEY = "spotifyHistoryAfter";

function readCursor(): number | undefined {
  try {
    const value = Number(localStorage.getItem(CURSOR_KEY));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeCursor(value: number) {
  try {
    localStorage.setItem(CURSOR_KEY, String(value));
  } catch {
    // Without storage the next sync re-reads the list; duplicates are still skipped.
  }
}

let syncing: Promise<number> | null = null;

/** Imports new plays and returns how many were added. Safe to call often: one sync runs at a time. */
export function syncRecentlyPlayed(): Promise<number> {
  syncing ??= run().finally(() => {
    syncing = null;
  });
  return syncing;
}

async function run(): Promise<number> {
  if (!canReadHistory(useSpotify.getState().auth)) return 0;
  const after = readCursor();
  const items = await getRecentlyPlayed(after);
  if (items.length === 0) return 0;

  let added = 0;
  let newest = after ?? 0;
  // Oldest first, so the history fills in order.
  for (const item of [...items].reverse()) {
    const playedAt = Date.parse(item.played_at);
    if (!Number.isFinite(playedAt)) continue;
    const duration = item.track.duration_ms;
    // Spotify logs a play when it finishes, so it started about one song-length earlier.
    const imported = await importPlay({
      title: item.track.name,
      artists: item.track.artists.map((artist) => artist.name),
      album: item.track.album?.name ?? "",
      art: imageFor(item.track.album?.images, 64),
      startedAt: bangkokDateTime(new Date(playedAt - duration)),
      endedAt: bangkokDateTime(new Date(playedAt)),
      durationMs: duration,
    });
    if (imported) added += 1;
    newest = Math.max(newest, playedAt);
  }
  writeCursor(newest);
  if (added > 0) await queryClient.invalidateQueries({ queryKey: ["music"] });
  return added;
}
