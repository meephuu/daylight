-- Recurring expenses (monthly on day X, or weekly) and a "pending" status for entries that were created
-- automatically and still wait for the user to confirm them.
--
-- Additive only: no existing row changes. Existing expenses become 'confirmed'.

CREATE TABLE recurring_expenses (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    amount_satang     INTEGER NOT NULL CHECK (amount_satang > 0),
    category_id       INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    payment_method_id INTEGER          REFERENCES payment_methods(id) ON DELETE SET NULL,
    note              TEXT    NOT NULL DEFAULT '',
    frequency         TEXT    NOT NULL CHECK (frequency IN ('monthly', 'weekly')),
    day_of_month      INTEGER          CHECK (day_of_month BETWEEN 1 AND 31),  -- monthly; short months use their last day
    weekday           INTEGER          CHECK (weekday BETWEEN 0 AND 6),         -- weekly; 0 = Sunday
    start_date        TEXT    NOT NULL,                                          -- YYYY-MM-DD, first date that may be due
    generated_through TEXT,                                                      -- every due date up to here was already created
    active            INTEGER NOT NULL DEFAULT 1,
    created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

ALTER TABLE expenses ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending'));
ALTER TABLE expenses ADD COLUMN recurring_id INTEGER REFERENCES recurring_expenses(id) ON DELETE SET NULL;

-- A recurring rule can only ever create one entry per due date, even if the generator runs twice.
CREATE UNIQUE INDEX idx_expenses_recurring_date ON expenses(recurring_id, date) WHERE recurring_id IS NOT NULL;
CREATE INDEX idx_expenses_status ON expenses(status);
