---
name: Daylight 2.0
description: A personal dashboard of clear glass slabs lit by the real sky of this hour.
colors:
  ink-dark: "#f1f4ff"
  ink-dark-muted: "#b3bad6"
  ink-light: "#0d1430"
  ink-light-muted: "#475073"
  glass-dark: "rgb(12 16 44 / 0.4)"
  glass-dark-strong: "rgb(18 22 56 / 0.9)"
  glass-light: "rgb(255 255 255 / 0.58)"
  glass-light-strong: "rgb(255 255 255 / 0.86)"
  primary-dark: "#f4f6ff"
  primary-light: "#111a44"
  destructive-dark: "#ff6b81"
  destructive-light: "#d2334c"
  success-dark: "#4fd69a"
  success-light: "#16855a"
  warning-dark: "#ffc04d"
  warning-light: "#b86e00"
  ring-dark: "#93b6ff"
  ring-light: "#3d74e6"
  sky-night-top: "#02030c"
  sky-sunrise-bottom: "#ff8763"
  sky-midday-mid: "#1f63b8"
  sky-golden-bottom: "#ffa060"
  sky-sunset-mid: "#9a3f7d"
  series-1: "#3d8ef5"
  series-2: "#e35a3c"
  series-3: "#17a08a"
  series-4: "#c4860c"
  series-5: "#e0609e"
  series-6: "#4fa83a"
  series-7: "#9a7cf2"
  series-8: "#e95560"
typography:
  display-hero:
    fontFamily: "Instrument Serif, Anuphan Variable, serif"
    fontSize: "60px"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  page-title:
    fontFamily: "Instrument Serif, Anuphan Variable, serif"
    fontSize: "44px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.035em"
  pane-title:
    fontFamily: "Instrument Serif, Anuphan Variable, serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Onest Variable, Anuphan Variable, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "Onest Variable, Anuphan Variable, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  input: "14px"
  row: "16px"
  pane: "26px"
  dialog: "28px"
  pill: "9999px"
spacing:
  gutter: "12px"
  slab-pad: "20px"
  hero-pad: "24px"
components:
  pane:
    backgroundColor: "{colors.glass-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.pane}"
    padding: "24px"
  button-primary:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.pill}"
    height: "36px"
  dialog:
    backgroundColor: "{colors.glass-dark-strong}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.pane}"
    padding: "20px"
---

# Daylight 2.0

## Overview

Daylight is a single-user desktop dashboard (Tauri window). The 2.0 world is **Tunnel Glass**: every panel is a slab of clear acrylic, and the window behind them is the real sky over Bangkok at this minute. The sky is computed from today's sunrise, solar noon and sunset (`src/lib/sky.ts`) and blends through ten phases: Night, First light, Sunrise, Morning, Midday, Afternoon, Golden hour, Sunset, Dusk, Evening. Stars come out after dusk in dark mode.

The surface is an Operate tool: navigation and controls stay standard. The world contributes four things only: the sky as palette, glass as material, a calm desktop density, and one signature move, **the hour's light poured through the glass** (the sky accent on the Next-up slab, the active nav icon, checkboxes, switches and the now-line).

Dark is the owner's everyday theme; light uses the same sky lifted toward an airy rendition with white glass and deep ink.

## Colors

All theme colours are CSS custom properties in `src/index.css` (`:root` for light, `.dark` for dark).

### Primary
Ink is the primary: near-white in dark, deep navy in light. Primary buttons are solid ink with a glint on their top edge.

### Sky (live)
`SkyBackground` writes `--sky-top`, `--sky-mid`, `--sky-bottom`, `--sky-glow` and `--sky-accent` on `<html>` every 30 seconds; they are registered with `@property`, so changes fade. `--sky-accent` (Tailwind `sky-accent`) is the one colour that moves with the clock. Use it for small lit details only. The hour's accent holds through a phase and turns over only in its last stretch, so it never passes through a muddy midpoint.

### Data
Eight validated categorical series (`--series-1..8`; dataviz validator, all checks pass in both themes). Fixed order, never cycled. Entities with their own colour (projects, habits, categories, events) always use that colour, everywhere.

### Status
`--destructive`, `--success`, `--warning` are text-safe per theme. Status is never colour alone: pair it with an icon, a ring, a line style or a word.

### Named Rules
- **The sky is the only material.** No texture, grain or pattern on glass.
- **Black theme is the exception.** Settings > Appearance > Black (`.dark.black` on `<html>`) drops the sky for Daylight 1.0's look: a `#0a0a0a` window with the original app's one very blurry glow that moves through the day (orange top left in the morning, pale-blue ellipse across the top in the afternoon, red-orange top right in the evening, gone by 20:00; lib/classicGlow.ts, the original values unchanged), stars at night on the original timings, `#171717` slabs, neutral grey ink and a fixed `#7aa2ff` accent. Everything else in this file still applies.
- **One moving colour.** Only `--sky-accent` follows the clock; everything else is fixed.

## Typography

Two voices, both bundled offline, with Anuphan behind each for Thai:
- **Display face, switchable in Settings > Appearance > Display font** (lib/font.ts, `<html data-font>`): **Sora** by default (variable sans, uses the classes' semibold and tight tracking as-is), or **Instrument Serif**. Instrument Serif: one regular weight, never faked bold, `font-size-adjust: ex-height 0.5` so it matches the old sizes, tracking -0.005em): page titles at 44px set straight on the sky, the Home greeting up to 60px, pane titles at 19px, and every number that anchors a page (the clock, the month's spend, the week score at 120px, streaks, day numbers). Use `display-num` for numbers: proportional figures, tight tracking.
- **Onest** (UI): everything read and operated, 14px body, 12px meta.

### Hierarchy
Page title 44 > big numbers 40-120 > pane title 19 > body 14 > meta 12. No uppercase tracked eyebrows; a heading carries its own weight.

## Layout

Title bar (40px, transparent, drag region, live sky readout in the centre), a 212px glass rail on the left (or, with "Small sidebar" on, a 60px rail of icons only: logo, nav icons, Settings at the foot; names show on hover), and the scrolling work area. A 12px gutter separates every slab from its neighbours and the window edge. Pages centre within their own max width (Home 1680px, Calendar and Training 1480px, Tasks 1320px, Expenses and Habits 1024px, Settings 896px). Home: hero (day) 8/12 beside Next-up 4/12 from 1024px, then habits, training and money in thirds, countdowns, task lists, projects.

## Elevation & Depth

Depth is glass, not shadow. A slab is a translucent fill with `backdrop-filter: blur(22px) saturate(150%)`, a 1px bright top edge (`--glass-edge`), a faint 1px rim (`--glass-rim`) and a light, offset shadow (`--glass-shadow`, about 0 8px 24px at low alpha). Menus, popovers and dialogs use the denser `glass-strong`. Recessed areas inside a slab (inputs, tracks, inner tiles) use `glass-well`. Never nest slab inside slab.

## Shapes

Panes 26px, dialogs 28px, rows 16px, inputs 14px. Every control that can be a pill is one: buttons, toggles, segmented switches, chips, the quick-add field, the search field, the nav items. Checkboxes and habit toggles are round. Heatmap cells are dots. Dots mark identity colour; no coloured side borders anywhere.

## Components

- **PageHeader**: title on the sky, a one-line summary in the page's own numbers, actions grouped in one glass pill toolbar.
- **Pane** (`Card`, `.pane`): the single container; never nested.
- **Home**: hero on the sky (greeting, day summary, the sun's real arc with the clock), then the vertical agenda (blocks as tall as they last, now-line), Next-up (the hour's colour), Tasks (Due / Upcoming switch), Habits as round toggles, training, money.
- **Habit card**: one lead per card, the streak (44px `display-num`); name at pane-title size with its colour dot; no primary button (checking off lives in the Today toggles above); edit / archive / delete appear on hover or focus; heatmap labels recede.
- **Calendar Day view** (`DayView`, Month / Week / Day switch): main pane is the day as hours (56px an hour, blocks as tall as they last, overlapping ones side by side in lanes of at most 440px, all-day items as pills above, a now-line with a time pill); the side pane has a week strip (lit slab on the chosen day, today's number in the sky accent, up to three entry-colour dots), the day's numbers as type with hairlines (Planned / To do / Done) and the day as an ordered checklist.
- **Rows**: round check, title, meta line, pills on the right (project, due date; overdue tinted red with an icon).
- **Numbers on the sky**: page-level totals (Expenses, Training, Review) are set as type with hairline separators, never boxed in tiles.
- **Charts**: series tokens, hairline grids, glass-strong tooltips; Training's history is a column per week.

## Motion

One language: arrivals decelerate with ease-out-quint (`--ease-out`, `cubic-bezier(0.16, 1, 0.3, 1)`); feedback is 150-280ms, layout changes about 400ms, and only the page entrance takes ~520ms. Keyframes use `backwards` fill and `translate`/`scale` rather than `transform`, so they never fight a drag transform or linger after they end.

- **Page entrance (the one authored moment):** when a page opens, its outermost blocks (header, then each pane in reading order; `[data-settle]` opts other blocks in) come into focus: blur clears, opacity rises, they settle 10px. Stagger 40ms, capped at 8 steps. Content is never hidden by default.
- **Sidebar:** the lit slab behind the active page is one element that glides to the next page (420ms). Full ↔ small slides the rail width (380ms) while every icon and the logo keep their exact position; labels fade and are clipped.
- **Segmented switches** (`Segmented`): one lit slab slides and resizes to the chosen option. Used for Due/Upcoming, Tasks views, Month/Week, chart type and theme.
- **Feedback:** checkbox fills and its tick draws from the short stroke; task titles get a drawn strike line; habit rings grow to their new step and close into the fill with the tick popping in; toasts rise in and slip out; a new sticky note drops onto the board; a switched panel's content fades in.
- **Theme switch:** the whole window cross-fades (View Transitions).
- Dialogs, popovers and menus keep their quick fade-and-zoom.
- **Animations setting** (Settings > Appearance): Follow Windows (default) / On / Off. lib/motion.ts writes `<html data-motion="full|reduce">`; CSS, Tailwind's `motion-reduce:` (redefined in index.css) and script motion all read that, never the media query directly.

## Do's and Don'ts

- Do let the real sky show through every slab; keep text on the fill, not floating on bare sky (titles excepted).
- Do keep done things in place, struck through and dimmed, until the day rolls over.
- Do respect reduced motion: nothing moves or blurs; arrivals become a short fade, the sky stops transitioning and the stars stop twinkling.
- Don't add texture, gradients-as-decoration, coloured side borders, uppercase eyebrows or a second moving accent.
- Don't give a status colour without a second cue.
