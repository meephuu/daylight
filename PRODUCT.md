# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(React + Vite UI shipped inside a Tauri 2 desktop window on Windows. Custom title bar, no native decorations, minimum window 900x600, default 1200x780. Runs in the tray; closing hides to tray.)

## Users

One person: the owner, a university student in Bangkok who uses Daylight every day on a Windows desktop to run their own life. Mixed English and Thai content (Thai renders in Prompt). Opens it in the morning, glances at it through the day, and does a weekly review.

## Product Purpose

Daylight is a personal dashboard that keeps a day's moving parts in one window: tasks and projects, a calendar with timed items, sticky-note board, habits with streak heatmaps, a training (workout) planner with history, expenses with budgets, categories, payment methods and recurring bills, and a weekly review that summarizes the week. Success is opening it and knowing at a glance what today holds, then acting on it in a click or two.

## Positioning

A private, offline, single-user dashboard whose background follows the actual time of day (morning glow, afternoon sky, evening glow, night stars). The name is literal: the app is lit by the day you are living.

## Operating Context

- Desktop window, often left open beside study work; checked repeatedly rather than used in long sessions.
- Bangkok timezone; weeks start on Sunday; currency is Thai baht.
- Data lives in a local SQLite file (tauri-plugin-sql); no account, no sync (sync is a deferred plan).
- Tray "Quick add task" brings the window up with the quick-add input focused.

## Capabilities and Constraints

- Pages: Home, Tasks, Calendar, Notes, Habits, Training, Expenses, Music, Weekly review, Settings.
- Music: Spotify on this PC through Windows media controls (no account), a local listening history (migration 013, added at the owner's request), and optionally the Spotify Web API (owner's own developer app, PKCE sign-in) for search, queue and playlists.
- Since 2026-11-12 the redesign is the installed Daylight: release builds upgrade the original app in place (same identifier, same real data); dev builds use a separate identifier and a test copy of the data. The real data must never be lost: back it up before every install.
- UI redesign only: database schema, queries, and features stay as they are.
- Existing stack: React 18, Tailwind 4, shadcn/Base UI primitives, lucide icons, Recharts, dnd-kit, Geist + Prompt (Thai) fonts bundled offline.

## Brand Commitments

- Name: Daylight (this version: Daylight 2.0). Existing logo in src/assets/logo.png and app icons.
- The time-of-day sky is the signature and is to be made the star of 2.0 (owner's decision).
- Owner's binding visual direction for 2.0: glassy, with noticeably more color than v1.
- Owner uses the app mostly in dark mode; light mode must still work.

## Evidence on Hand

Real personal data (owner's database copy). A demo seed script (demo/seed_demo.py) exists for screenshot data. No testimonials or marketing claims are needed or to be invented.

## Product Principles

1. Today first: the current day's tasks, schedule and countdowns are always one glance away.
2. Calm repeat use: something opened twenty times a day must stay legible and quick, never noisy.
3. The day is the theme: time of day, not a settings toggle, sets the mood.
4. Never lose data: the redesign changes how things look, not what is stored.

## Accessibility & Inclusion

Single user, no stated requirement. Keep readable contrast on glass in both themes, keyboard focus visible, and respect reduced motion (the stars already do).
