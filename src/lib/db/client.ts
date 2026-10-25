import Database from "@tauri-apps/plugin-sql";

// Must match DB_URL in src-tauri/src/lib.rs so the migrations run against this file.
const DB_URL = "sqlite:my-dashboard.db";

let dbPromise: Promise<Database> | null = null;

/** Shared connection. Migrations have already run by the time load() resolves. */
export function getDb(): Promise<Database> {
  dbPromise ??= Database.load(DB_URL).then(async (db) => {
    // WAL lets the main window and the (later) quick-capture window share the file.
    await db.execute("PRAGMA journal_mode = WAL");
    await db.execute("PRAGMA foreign_keys = ON");
    return db;
  });
  return dbPromise;
}
