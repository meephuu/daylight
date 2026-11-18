-- Fix for 014: databases from 1.x (and every database made by 001) already had an older
-- focus_sessions table (started_at + duration_minutes), so 014's CREATE TABLE IF NOT EXISTS
-- did nothing and every save failed. Rebuild the table in 014's shape (plus 015's note),
-- carrying over any rows already there.
ALTER TABLE focus_sessions RENAME TO focus_sessions_legacy;

CREATE TABLE focus_sessions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id          INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  task_title       TEXT,
  project_id       INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  -- Bangkok local time, "YYYY-MM-DD HH:MM:SS".
  started_at       TEXT NOT NULL,
  ended_at         TEXT NOT NULL,
  planned_seconds  INTEGER NOT NULL,
  focused_seconds  INTEGER NOT NULL,
  completed        INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  note             TEXT NOT NULL DEFAULT ''
);

INSERT INTO focus_sessions (task_id, task_title, project_id, started_at, ended_at, planned_seconds, focused_seconds, completed, note)
SELECT l.task_id, t.title, l.project_id, l.started_at,
       datetime(l.started_at, '+' || l.duration_minutes || ' minutes'),
       l.duration_minutes * 60, l.duration_minutes * 60, 1, COALESCE(l.note, '')
FROM focus_sessions_legacy l LEFT JOIN tasks t ON t.id = l.task_id;

DROP TABLE focus_sessions_legacy;

DROP INDEX IF EXISTS idx_focus_sessions_started;
DROP INDEX IF EXISTS idx_focus_sessions_task;
CREATE INDEX idx_focus_sessions_started ON focus_sessions(started_at);
CREATE INDEX idx_focus_sessions_task ON focus_sessions(task_id);
