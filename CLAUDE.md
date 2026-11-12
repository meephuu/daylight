# CLAUDE.md

Guidance for Claude Code when working in this repository. Read `PRODUCT.md` (what/why) and `DESIGN.md` (visual system) before any UI work.

## What this is

**Daylight** (the 2.0 redesign) is a redesign of the owner's personal "Daylight" dashboard app. It is a single-user Windows desktop app (Tauri 2 + React) for tasks/projects, calendar, sticky notes, habits, training planner, expenses and a weekly review. The signature is a live sky background that follows the real time of day in Bangkok, with glass panels on top ("Tunnel Glass").

Since 2026-11-12 this repo **is** the owner's installed Daylight: the release build (`pnpm release`) installs over the original 1.x app at `D:\Daylight` as the same app (identifier `com.phu.mydashboard`, product "Daylight", binary `my-dashboard.exe`, set in `src-tauri/tauri.release.conf.json`) and runs on the owner's **real data** in `%APPDATA%\com.phu.mydashboard`. Dev builds (`pnpm tauri dev`) keep the base config's identifier `com.phu.daylight2` and its own test copy of the data. The old 1.x source lives in `../daylight` (read-only reference); its installers in `../daylight/src-tauri/target/release/bundle/nsis` are the rollback path.

## Hard rules

- **Protect the real data.** Never run anything against `%APPDATA%\com.phu.mydashboard` except an installed release the user asked for; back it up before installing a new release. Develop and test against the `com.phu.daylight2` copy (dev builds do this by default). Never edit `../daylight`.
- **Don't change the base identifier** in `tauri.conf.json`: it is what keeps dev builds off the real data.
- **UI redesign only.** Do not change the DB schema, queries or features unless the user asks. Never lose user data.
- **Migrations are append-only.** Never edit an existing file in `src-tauri/migrations/`; add `013_*.sql` etc. and register it in `src-tauri/src/lib.rs`.
- Do not commit or push unless asked. Don't run destructive git commands.

## Commands (pnpm)

- `pnpm dev`: Vite only, port **1430** (strict). Tauri APIs (SQL, autostart, tray) don't work in a plain browser.
- `pnpm tauri dev`: full desktop app (runs `pnpm dev` itself).
- `pnpm build`: `tsc && vite build`. **Run this to type-check**; there are no tests or linter.
- `pnpm release`: the real installer (`tauri build` + `tauri.release.conf.json`): Daylight, `com.phu.mydashboard`, `my-dashboard.exe`. Bump `version` in `tauri.conf.json` (and `Cargo.toml`/`package.json`) above the installed one before releasing. Output: `src-tauri/target/release/bundle/nsis/Daylight_<version>_x64-setup.exe`.
- `pnpm tauri build`: a separate test install (`com.phu.daylight2`), not the real app.
- Demo build for screenshots: uses `src-tauri/tauri.demo.conf.json` (identifier `com.phu.daylight2.demo`); fill it with `python demo/seed_demo.py` (close the demo app first, run it once so migrations exist).

## Stack

React 18, TypeScript 6, Vite 8, Tailwind 4 (`@tailwindcss/vite`), shadcn + Base UI primitives (`src/components/ui`), lucide-react, Recharts, dnd-kit, react-hook-form + zod, TanStack Query, Zustand, react-router-dom 7, date-fns. Tauri plugins: sql (SQLite), autostart, opener, single-instance. Fonts bundled offline: Sora (display, default) or Instrument Serif (Settings), Onest (body), Anuphan (Thai).

Import alias: `@/` -> `src/`.

## Architecture

```
src/pages/        one file per route (Home, Tasks, Calendar, Habits, Training, Notes, Expenses, Review, Settings)
src/components/   shared pieces at top level; feature folders (home/, expenses/, training/, ...)
src/components/ui shadcn primitives
src/components/ambient/  SkyBackground, StarField, SkyOrb, debug panel
src/hooks/        TanStack Query hooks, one per domain (useTasks, useExpenses, ...)
src/lib/db/       SQL access per table (getDb() in client.ts), zod schemas and types
src/lib/          pure logic and helpers (sky.ts, bangkok.ts, review.ts, recurring.ts, ...)
src-tauri/        Rust shell: tray, single instance, autostart, migrations registry
src-tauri/migrations/  numbered SQLite migrations
```

Data flow: `pages/components -> hooks/useX (react-query) -> lib/db/x (SQL via plugin-sql)`. Keep SQL in `lib/db`, query keys and cache invalidation in `hooks`, and UI free of SQL. Mutations that affect other data invalidate those caches too (e.g. task changes also refresh projects).

Database: `sqlite:my-dashboard.db`, WAL mode, foreign keys on. `DB_URL` in `src/lib/db/client.ts` must match `src-tauri/src/lib.rs`.

App behaviour: custom title bar (no native decorations), min window 900x600, default 1200x780. Closing the window hides to the tray; "Quit" in the tray menu exits. Tray "Quick add task" focuses the quick-add input. Autostart launches into the tray.

## Locale conventions

- Timezone is **Bangkok**; use `src/lib/bangkok.ts` and `src/lib/dates.ts`, not raw `new Date()` day math.
- **Weeks start on Sunday.**
- Currency is Thai baht (`src/lib/money.ts`).
- Content mixes English and Thai; make sure text styling works with the Thai fallback font.

## Design rules (summary; full detail in DESIGN.md)

- Dark mode is the primary theme; light mode must still work. Check both.
- Panels are glass slabs (`.pane`, `glass-strong` for menus/dialogs, `glass-well` for recessed areas). **Never nest slab inside slab.** Depth comes from glass, not heavy shadows.
- Radii: pane 26px, dialog 28px, row 16px, input 14px; anything that can be a pill is a pill.
- Sky colours come from CSS variables written by `SkyBackground` (`--sky-*`); `sky-accent` is the single moving accent, used for small details only.
- Use the 8 fixed `--series-1..8` chart colours, in order. Entities with their own colour (projects, habits, categories) always use it.
- Status is never colour alone; pair with an icon, ring, line style or word.
- Don't add: decorative gradients or textures, coloured side borders, uppercase eyebrows, a second moving accent.
- Respect `prefers-reduced-motion`.
- Page-level totals are type with hairline separators, not boxed tiles.
- Keep done items in place (struck through, dimmed) until the day rolls over.

## Frontend skills

The owner wants Claude to use its frontend skills for **all UI work in this project**, without asking first. Pick by task:

- **`impeccable`**: the main skill for this app. Use it to design, redesign, critique, audit, polish or animate any page, component, dialog or the shell. It owns `PRODUCT.md`, `DESIGN.md` and `.impeccable/` (the brief/direction contract and per-surface notes, e.g. `.impeccable/surfaces/src-components-layout-tsx.md`). Read those before starting, and keep `DESIGN.md` and the surface notes current when the design changes.
- **`dataviz`**: load it before touching any chart, heatmap, progress ring/meter, sparkline, stat number or chart colours (Recharts in `components/charts`, `expenses/DailySpendingChart`, `habits/HabitHeatmap`, `review/*`, `training/ProgressMeter`, etc.). The `--series-1..8` palette was already checked with its validator; re-validate if colours change.
- **`design-taste-frontend`**: use it for its anti-generic, "doesn't look AI-made" taste checks and micro-interaction polish. Its marketing-site rules (hero sections, photography, one section per screen) don't apply to this desktop app. Where it conflicts with `DESIGN.md`, `DESIGN.md` wins.
- **`run`**: launch the app (`pnpm tauri dev`) to see a UI change working.

Several skills can apply to one task (e.g. a Review-page redesign uses `impeccable` + `dataviz`). The hard rules above still hold: UI only, no schema or data changes.

## Workflow notes

- For UI changes, verify visually in the running app (`pnpm tauri dev`) in both themes when possible. `TimeOfDayDebugPanel` can scrub the time of day to check each sky phase.
- Match existing patterns in neighbouring files before introducing new ones; prefer existing components in `src/components` over new ones.
- `dist/` and `node_modules/` are build output; don't edit them.
- The `.impeccable/` folder is the `impeccable` skill's working context; update it only through that skill.
