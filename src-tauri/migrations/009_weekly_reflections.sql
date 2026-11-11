-- One short written reflection per week (weeks are identified by the Sunday that starts them).
-- Additive only: nothing existing changes.
CREATE TABLE weekly_reflections (
    week_start TEXT PRIMARY KEY,                       -- YYYY-MM-DD, a Sunday
    went_well  TEXT NOT NULL DEFAULT '',
    to_improve TEXT NOT NULL DEFAULT '',
    next_focus TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
