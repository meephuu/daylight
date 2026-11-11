-- Weekly training plan: a repeating schedule of workouts, each with its exercises,
-- plus a log of which workouts were completed in which week.

CREATE TABLE workouts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    title            TEXT    NOT NULL,
    day_of_week      INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Monday ... 6 = Sunday
    start_time       TEXT,                                                  -- "HH:MM", optional
    duration_minutes INTEGER,                                               -- planned length, optional
    category         TEXT    NOT NULL DEFAULT 'strength',
    notes            TEXT    NOT NULL DEFAULT '',
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_workouts_day ON workouts(day_of_week);

CREATE TABLE workout_exercises (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    sets       INTEGER,
    reps       TEXT,           -- free text so "8-10", "AMRAP" or "30s" all work
    weight     REAL,           -- kg, optional
    position   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_workout_exercises_workout ON workout_exercises(workout_id);

-- One row = this workout was done during that week. Keyed by week (not date) so moving a workout
-- to another day later does not make past completions disappear.
CREATE TABLE workout_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    week_start TEXT    NOT NULL,   -- the Monday of that week, YYYY-MM-DD
    done_date  TEXT    NOT NULL,   -- the day it was actually ticked off, YYYY-MM-DD
    UNIQUE (workout_id, week_start)
);
