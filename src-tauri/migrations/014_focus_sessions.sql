-- Focus page: each focus session (Pomodoro) that ran, with the task it was for.
-- Breaks are not stored. The task's title and project are copied in, so history survives the task being deleted.
CREATE TABLE IF NOT EXISTS focus_sessions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id          INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  task_title       TEXT,
  project_id       INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  -- Bangkok local time, "YYYY-MM-DD HH:MM:SS".
  started_at       TEXT NOT NULL,
  ended_at         TEXT NOT NULL,
  -- The length it was set to, and the time it actually ran (pauses excluded).
  planned_seconds  INTEGER NOT NULL,
  focused_seconds  INTEGER NOT NULL,
  -- 1 when the timer ran out; 0 when it was stopped or skipped early.
  completed        INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_started ON focus_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task ON focus_sessions(task_id);
