import { z } from "zod";
import { getDb } from "./client";

/**
 * Listening history: the songs Spotify played on this PC, as Daylight saw them (migration 013).
 * Times are Bangkok local "YYYY-MM-DD HH:MM:SS" text, so grouping by day is plain string work.
 */

/** A play counts as a "listen" (and a song makes the top lists) after this much time heard. */
export const LISTEN_MIN_MS = 30_000;

export interface TrackInput {
  title: string;
  artist: string;
  album: string;
  /** Small cover thumbnail as a data: URL. */
  art: string | null;
}

export interface DayListening {
  day: string; // YYYY-MM-DD
  ms: number;
}

export interface TopTrack {
  id: number;
  title: string;
  artist: string;
  art: string | null;
  plays: number;
  ms: number;
}

export interface TopArtist {
  artist: string;
  songs: number;
  ms: number;
  /** The cover of their most-heard song in the period (a stand-in when there is no artist photo). */
  art: string | null;
}

/** The track's id, adding it the first time it is seen (and refreshing its album and cover). */
export async function upsertTrack(track: TrackInput): Promise<number> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO music_tracks (title, artist, album, art) VALUES ($1, $2, $3, $4)
     ON CONFLICT (title, artist) DO UPDATE SET album = excluded.album, art = COALESCE(excluded.art, music_tracks.art)`,
    [track.title, track.artist, track.album, track.art],
  );
  const rows = z
    .array(z.object({ id: z.number() }))
    .parse(await db.select<unknown>("SELECT id FROM music_tracks WHERE title = $1 AND artist = $2", [track.title, track.artist]));
  return rows[0]!.id;
}

export async function startPlay(trackId: number, startedAt: string, durationMs: number | null): Promise<number> {
  const db = await getDb();
  const result = await db.execute("INSERT INTO music_plays (track_id, started_at, duration_ms) VALUES ($1, $2, $3)", [
    trackId,
    startedAt,
    durationMs,
  ]);
  return Number(result.lastInsertId);
}

export async function updatePlay(playId: number, listenedMs: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE music_plays SET listened_ms = $1 WHERE id = $2", [Math.round(listenedMs), playId]);
}

/** Time listened per day, from `from` (YYYY-MM-DD) on. Days with nothing are left out. */
export async function listListeningDays(from: string): Promise<DayListening[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    "SELECT substr(started_at, 1, 10) AS day, SUM(listened_ms) AS ms FROM music_plays WHERE started_at >= $1 GROUP BY day ORDER BY day",
    [from],
  );
  return z.array(z.object({ day: z.string(), ms: z.number() })).parse(rows);
}

export async function listTopTracks(from: string, limit = 5): Promise<TopTrack[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    `SELECT t.id, t.title, t.artist, t.art,
            SUM(CASE WHEN p.listened_ms >= ${LISTEN_MIN_MS} THEN 1 ELSE 0 END) AS plays,
            SUM(p.listened_ms) AS ms
       FROM music_plays p JOIN music_tracks t ON t.id = p.track_id
      WHERE p.started_at >= $1
      GROUP BY t.id
     HAVING ms >= ${LISTEN_MIN_MS}
      ORDER BY ms DESC
      LIMIT $2`,
    [from, limit],
  );
  return z
    .array(
      z.object({ id: z.number(), title: z.string(), artist: z.string(), art: z.string().nullable(), plays: z.number(), ms: z.number() }),
    )
    .parse(rows);
}

export async function listTopArtists(from: string, limit = 5): Promise<TopArtist[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    `SELECT t.artist, COUNT(DISTINCT t.id) AS songs, SUM(p.listened_ms) AS ms,
            (SELECT t2.art
               FROM music_plays p2 JOIN music_tracks t2 ON t2.id = p2.track_id
              WHERE t2.artist = t.artist AND t2.art IS NOT NULL AND p2.started_at >= $1
              GROUP BY t2.id
              ORDER BY SUM(p2.listened_ms) DESC
              LIMIT 1) AS art
       FROM music_plays p JOIN music_tracks t ON t.id = p.track_id
      WHERE p.started_at >= $1
      GROUP BY t.artist
     HAVING ms >= ${LISTEN_MIN_MS}
      ORDER BY ms DESC
      LIMIT $2`,
    [from, limit],
  );
  return z
    .array(z.object({ artist: z.string(), songs: z.number(), ms: z.number(), art: z.string().nullable() }))
    .parse(rows);
}
