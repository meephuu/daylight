-- Expenses overhaul, part 1: user-defined categories, payment methods, and money stored as integer satang.
-- The old table is kept as `expenses_legacy` (renamed, never read by the app) so nothing can be lost.

-- ---------------------------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------------------------
CREATE TABLE categories (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    name                  TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    color                 TEXT    NOT NULL DEFAULT '#9CA3AF',   -- "#RRGGBB"
    icon                  TEXT,                                 -- name of a lucide icon, optional
    monthly_budget_satang INTEGER,                              -- optional per-category monthly budget
    sort_order            INTEGER NOT NULL DEFAULT 0,
    archived              INTEGER NOT NULL DEFAULT 0,
    is_fallback           INTEGER NOT NULL DEFAULT 0,           -- 1 = "Other": cannot be deleted or archived
    created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO categories (name, color, icon, sort_order, is_fallback) VALUES
    ('Food & Drinks',     '#F59E0B', 'UtensilsCrossed', 1, 0),
    ('Transport',         '#3B82F6', 'Bus',             2, 0),
    ('Bills & Utilities', '#64748B', 'Receipt',         3, 0),
    ('Education',         '#14B8A6', 'GraduationCap',   4, 0),
    ('Subscriptions',     '#A855F7', 'Repeat',          5, 0),
    ('Shopping',          '#EC4899', 'ShoppingBag',     6, 0),
    ('Entertainment',     '#EF4444', 'Clapperboard',    7, 0),
    ('Other',             '#9CA3AF', 'Ellipsis',        8, 1);

-- Category names already used by existing expenses that are not defaults get their own category of the same
-- name ("Bills" is the old name of "Bills & Utilities"). Names are matched ignoring case and surrounding spaces.
INSERT OR IGNORE INTO categories (name, color, sort_order)
SELECT name,
       CASE (n - 1) % 6
         WHEN 0 THEN '#22C55E' WHEN 1 THEN '#06B6D4' WHEN 2 THEN '#F97316'
         WHEN 3 THEN '#84CC16' WHEN 4 THEN '#6366F1' ELSE '#F43F5E'
       END,
       100 + n
FROM (
    SELECT TRIM(category) AS name, ROW_NUMBER() OVER (ORDER BY MIN(id)) AS n
    FROM expenses
    WHERE TRIM(category) <> '' AND LOWER(TRIM(category)) <> 'bills'
    GROUP BY LOWER(TRIM(category))
);

-- ---------------------------------------------------------------------------------------------
-- Payment methods (editable list)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE payment_methods (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    icon       TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO payment_methods (name, icon, sort_order) VALUES
    ('Cash',          'Banknote',   1),
    ('PromptPay/QR',  'QrCode',     2),
    ('Debit card',    'CreditCard', 3),
    ('Credit card',   'CreditCard', 4),
    ('e-Wallet',      'Wallet',     5);

-- ---------------------------------------------------------------------------------------------
-- Expenses: integer satang, category by id, optional payment method
-- ---------------------------------------------------------------------------------------------
ALTER TABLE expenses RENAME TO expenses_legacy;
-- Indexes keep their names when a table is renamed, so the old one must go before the new one is created.
DROP INDEX IF EXISTS idx_expenses_date;

CREATE TABLE expenses (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    amount_satang     INTEGER NOT NULL,                                              -- 1 baht = 100 satang
    category_id       INTEGER NOT NULL REFERENCES categories(id)      ON DELETE RESTRICT,
    payment_method_id INTEGER          REFERENCES payment_methods(id) ON DELETE SET NULL,
    note              TEXT    NOT NULL DEFAULT '',
    date              TEXT    NOT NULL,                                              -- YYYY-MM-DD
    created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_expenses_date     ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category_id);

INSERT INTO expenses (id, amount_satang, category_id, payment_method_id, note, date, created_at)
SELECT l.id,
       CAST(ROUND(l.amount * 100) AS INTEGER),
       COALESCE(
         (SELECT c.id FROM categories c
           WHERE c.name = CASE WHEN LOWER(TRIM(l.category)) = 'bills' THEN 'Bills & Utilities' ELSE TRIM(l.category) END),
         (SELECT id FROM categories WHERE is_fallback = 1)
       ),
       NULL,
       l.note,
       l.date,
       l.created_at
FROM expenses_legacy l;

-- ---------------------------------------------------------------------------------------------
-- The monthly budget becomes satang too (the old baht key is left untouched).
-- ---------------------------------------------------------------------------------------------
INSERT OR REPLACE INTO settings (key, value)
SELECT 'monthly_budget_satang', CAST(ROUND(CAST(value AS REAL) * 100) AS INTEGER)
FROM settings
WHERE key = 'monthly_budget' AND CAST(value AS REAL) > 0;
