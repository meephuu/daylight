-- Focus page: one line on what a focus session got done, asked for when it ends.
ALTER TABLE focus_sessions ADD COLUMN note TEXT NOT NULL DEFAULT '';
