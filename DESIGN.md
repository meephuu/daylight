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
  sky-night-top: "#03061a"
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
  page-title:
    fontFamily: "Geist Variable, Prompt, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  greeting:
    fontFamily: "Geist Variable, Prompt, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  slab-title:
    fontFamily: "Geist Variable, Prompt, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Variable, Prompt, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "Geist Variable, Prompt, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  control: "12px"
  row: "12px"
  slab: "21.6px"
spacing:
  gutter: "12px"
  slab-pad: "20px"
  hero-pad: "24px"
components:
  slab:
    backgroundColor: "{colors.glass-dark}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.slab}"
    padding: "{spacing.slab-pad}"
  button-primary:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.control}"
    height: "32px"
  dialog:
    backgroundColor: "{colors.glass-dark-strong}"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.slab}"
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
- **One moving colour.** Only `--sky-accent` follows the clock; everything else is fixed.

## Typography

Geist Variable for everything; Thai falls back to Prompt (bundled offline). Rank comes from size and weight, never from extra boxes. Tabular figures only where numbers align (times, axis ticks, counts in rows); big standalone numbers stay proportional.

### Hierarchy
Greeting 32/600, page title 28/600 (tracking -0.025em), slab title 15/600, body 14, captions and meta 12 in the muted ink. No uppercase tracked eyebrows.

## Layout

Title bar (40px, transparent, drag region, live sky readout in the centre), a 212px glass rail on the left, and the scrolling work area. A 12px gutter separates every slab from its neighbours and the window edge. Pages centre within their own max width (Home 1680px, Calendar and Training 1480px, Tasks 1320px, Expenses and Habits 1024px, Settings 896px). Home: hero (day) 8/12 beside Next-up 4/12 from 1024px, then habits, training and money in thirds, countdowns, task lists, projects.

## Elevation & Depth

Depth is glass, not shadow. A slab is a translucent fill with `backdrop-filter: blur(22px) saturate(150%)`, a 1px bright top edge (`--glass-edge`), a faint 1px rim (`--glass-rim`) and a light, offset shadow (`--glass-shadow`, about 0 8px 24px at low alpha). Menus, popovers and dialogs use the denser `glass-strong`. Recessed areas inside a slab (inputs, tracks, inner tiles) use `glass-well`. Never nest slab inside slab.

## Shapes

Slabs 21.6px (`rounded-2xl`), rows, controls and inner tiles 12px (`rounded-lg`/`rounded-xl`), chips 6px, data cells 3px. Dots mark identity colour; no coloured side borders on cards, chips or rows.

## Components

- **Slab** (`Card`, `.glass`): the single container.
- **Next-up slab**: the only slab washed with the hour's colour.
- **Day strip**: the day as one strip where block length is duration, the elapsed part dimmed, and a static now-line in the sky accent.
- **Rows**: 36px, rounded, hover wash `foreground/5%`, no dividers.
- **Buttons**: primary solid ink, outline clear glass, ghost bare; they lift 1px on hover and press down on click.
- **Checkbox and switch**: fill with the sky accent when on.
- **Charts**: series tokens, hairline grids (`--viz-grid`), glass-strong tooltips.

## Do's and Don'ts

- Do let the real sky show through every slab; keep text on the fill, not floating on bare sky (titles excepted).
- Do keep done things in place, struck through and dimmed, until the day rolls over.
- Do respect reduced motion: stars stop twinkling, the page entrance and sky transitions turn off.
- Don't add texture, gradients-as-decoration, coloured side borders, uppercase eyebrows or a second moving accent.
- Don't give a status colour without a second cue.
