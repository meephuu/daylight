-- Notes become free-form post-its placed on a board.
ALTER TABLE notes ADD COLUMN x       REAL    NOT NULL DEFAULT 40;
ALTER TABLE notes ADD COLUMN y       REAL    NOT NULL DEFAULT 40;
ALTER TABLE notes ADD COLUMN width   REAL    NOT NULL DEFAULT 224;
ALTER TABLE notes ADD COLUMN height  REAL    NOT NULL DEFAULT 208;
ALTER TABLE notes ADD COLUMN color   TEXT    NOT NULL DEFAULT '#fde68a';
ALTER TABLE notes ADD COLUMN z_index INTEGER NOT NULL DEFAULT 0;

-- Small key/value store for app settings (monthly budget, currency, ...).
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
