-- Quick Access on the App page: shortcuts to apps on this PC and to websites, with how often each
-- was opened from there. A new table only; nothing existing changes.
CREATE TABLE IF NOT EXISTS app_shortcuts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  -- 'app': target is "shell:AppsFolder\<id>", a file path (.exe / .lnk) or a URI such as "ms-settings:".
  -- 'website': target is an http(s) URL, opened in `browser`.
  kind             TEXT NOT NULL CHECK (kind IN ('app', 'website')),
  target           TEXT NOT NULL,
  -- 'default' (Windows' default browser), 'chrome', 'edge', 'firefox' or 'brave'. Only used by websites.
  browser          TEXT NOT NULL DEFAULT 'default',
  -- The icon as a data: URL; NULL draws the generic one.
  icon             TEXT,
  -- 'auto': taken from the app or the site (fetched again when the target changes); 'custom': chosen by hand.
  icon_source      TEXT NOT NULL DEFAULT 'auto' CHECK (icon_source IN ('auto', 'custom')),
  launch_count     INTEGER NOT NULL DEFAULT 0,
  -- Bangkok local time, "YYYY-MM-DD HH:MM:SS".
  last_launched_at TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
