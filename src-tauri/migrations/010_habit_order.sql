-- Lets the user put habits in their own order. Existing habits keep the order they have now (oldest first).
-- Additive only: no habit or log changes.
ALTER TABLE habits ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
UPDATE habits SET sort_order = (SELECT COUNT(*) FROM habits AS earlier WHERE earlier.id <= habits.id);
