-- Tasks can carry a time of day (only meaningful together with due_date).
ALTER TABLE tasks ADD COLUMN due_time TEXT;  -- "HH:MM", optional

-- Events and reminders that live on the calendar. One-off, or repeating (uni classes, subscriptions...).
CREATE TABLE calendar_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    kind             TEXT    NOT NULL CHECK (kind IN ('event', 'reminder')),
    title            TEXT    NOT NULL,
    notes            TEXT    NOT NULL DEFAULT '',
    start_date       TEXT    NOT NULL,                    -- first (or only) day, YYYY-MM-DD
    start_time       TEXT,                                -- "HH:MM"; NULL = all day
    end_time         TEXT,                                -- "HH:MM"; events only
    color            TEXT    NOT NULL DEFAULT '#3b82f6',
    repeat_rule      TEXT    NOT NULL DEFAULT 'none' CHECK (repeat_rule IN ('none', 'weekly', 'monthly', 'yearly')),
    repeat_weekdays  TEXT    NOT NULL DEFAULT '',         -- weekly only, e.g. "0,2,4" (0 = Monday); empty = weekday of start_date
    repeat_until     TEXT,                                -- last day a repeating item may occur; NULL = forever
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_calendar_items_start ON calendar_items(start_date);

-- Per-day state of a repeating item: ticked off (reminders) or skipped (e.g. a cancelled class).
CREATE TABLE calendar_occurrence_states (
    item_id INTEGER NOT NULL REFERENCES calendar_items(id) ON DELETE CASCADE,
    date    TEXT    NOT NULL,                             -- YYYY-MM-DD
    state   TEXT    NOT NULL CHECK (state IN ('done', 'skipped')),
    PRIMARY KEY (item_id, date)
);
