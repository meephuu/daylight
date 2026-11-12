-- Music history: the songs Spotify played on this PC, as Daylight saw them (Music page stats).
-- A track is one title + artist; each time it starts playing is a play, with how long it was heard.
CREATE TABLE IF NOT EXISTS music_tracks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  artist     TEXT NOT NULL,
  album      TEXT NOT NULL DEFAULT '',
  -- Small cover thumbnail as a data: URL (a few KB), for the top-songs list.
  art        TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (title, artist)
);

CREATE TABLE IF NOT EXISTS music_plays (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id    INTEGER NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  -- Bangkok local time, "YYYY-MM-DD HH:MM:SS".
  started_at  TEXT NOT NULL,
  listened_ms INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_music_plays_started ON music_plays(started_at);
CREATE INDEX IF NOT EXISTS idx_music_plays_track ON music_plays(track_id);
