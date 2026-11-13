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
- **The sky is the only material.** No texture, grain or pattern on glass. One exception, owner-requested: rain on the glass (`GlassRain`) while it rains, gone when the glass dries.
- **Black theme is the exception.** Settings > Appearance > Black (`.dark.black` on `<html>`) drops the sky for Daylight 1.0's look: a `#0a0a0a` window with the original app's one very blurry glow that moves through the day (orange top left in the morning, pale-blue ellipse across the top in the afternoon, red-orange top right in the evening, gone by 20:00; lib/classicGlow.ts, the original values unchanged), stars at night on the original timings, `#171717` slabs, neutral grey ink and a fixed `#7aa2ff` accent. Everything else in this file still applies.
- **One moving colour.** Only `--sky-accent` follows the clock; everything else is fixed.

## Typography

Two voices, both bundled offline, with Anuphan behind each for Thai:
- **Display face, switchable in Settings > Appearance > Display font** (lib/font.ts, `<html data-font>`): **Sora** by default (variable sans, uses the classes' semibold and tight tracking as-is), or **Instrument Serif**. Instrument Serif: one regular weight, never faked bold, `font-size-adjust: ex-height 0.5` so it matches the old sizes, tracking -0.005em): page titles at 44px set straight on the sky, the Home greeting up to 60px, pane titles at 19px, and every number that anchors a page (the clock, the month's spend, the week score at 120px, streaks, day numbers). Use `display-num` for numbers: proportional figures, tight tracking.
- **Onest** (UI): everything read and operated, 14px body, 12px meta.

### Hierarchy
Page title 44 > big numbers 40-120 > pane title 19 > body 14 > meta 12. No uppercase tracked eyebrows; a heading carries its own weight.

## Layout

Title bar (40px, transparent, drag region, live sky readout in the centre; on the right full screen (also F11), minimise, maximise, close; in full screen the bar stays but stops being a drag region, and minimise / maximise give way to "Exit full screen"), a 212px glass rail on the left (or, with "Small sidebar" on, a 60px rail of icons only: logo, nav icons, Settings at the foot; names show on hover), and the scrolling work area. A 12px gutter separates every slab from its neighbours and the window edge. Pages centre within their own max width (Home 1680px, Calendar and Training 1480px, Tasks 1320px, Expenses and Habits 1024px, Settings 896px). Home: hero on the sky, then two rows that line up across three columns from 1280px: the day (5/12) spans both rows and scrolls inside the height the others set; Next up (4/12) and Now playing (3/12) share row 1 and are the same height; Tasks and the habits / training / money stack share row 2, Tasks and the last card stretching so every column ends on one line (stack cards keep their natural height and never shrink; Tasks shows as many whole rows as fit, then "N more on Tasks"; below 1280px it shows 7). From 1024px: the day beside Next up and Tasks, then Now playing (natural height) beside the stack. Then countdowns and projects.

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
- **Now playing** (`NowPlayingCard`, Home right column, above Habits): Spotify on this PC. Pane title is the state (Now playing / Paused / Last played) with three equalizer bars in the sky accent while playing, "Spotify" or "12 min ago" on the right; 72px cover with 8px corners, like a real sleeve (greyed slightly when it is only the last played), title / artist / album; a 4px progress bar in the cover's colour with times; previous, play/pause (the lit round button), next. The pane is tinted with the cover's mid-tone colour through the glass (34% to 8%), like Next up with the hour's colour. Empty state: a music glyph and one line.
- **Music page** (`pages/Music.tsx`, `components/music/*`): the owner's sketch. Left (3/8, sticky, the window's full height, 16px from the sidebar and from the right column): the turntable alone, a stage sized in container units so it and the sleeve hanging under it fill the window's height (the arm's plinth level with the page title on the right): the sleeve (the cover, tilted -2deg; when the song changes the old sleeve is pulled away to the left and fades, 0.62s ease-in, while the new one slides in from the lower right and settles, 0.85s ease-out, a cover arriving late for the same song just fills in; reduced motion swaps it at once) behind a vinyl record (CSS grooves and song gaps; a still light sheen over the turning record), a smooth dark run-out band, then its label printed in the cover's colour like a real pressing (ink picked by luminance): a thin rim just inside the edge, small Instrument Serif type running round the rim, each line centred on its side of the title (album above, "33 1/3 RPM · Stereo" right, "Pressed by Daylight, Bangkok" below, "Side A" left), a small decorative barcode centred under the artist, the title large on a 50deg diagonal with the artist in spaced capitals under it, and a silver spindle, and an SVG tonearm on a plinth at the top left. Playing: the record comes up to 33 1/3 rpm over about a second and coasts to a stop on pause (driven from script, never a jump between still and spinning), and the arm lowers onto the outer groove, then drifts inward with the song's progress; paused, it lifts off. Needle control (after MD Vinyl): drag the arm onto the record to play from that point, a glass pill under the stylus showing the time it will play from; drag it back to its rest to pause. Right (5/8), split into separate panes so no pane does too much: page header "Spotify" with the "Album colour in the sky" switch (while a song plays, the cover colour becomes `--sky-accent` and the sun everywhere, and on the Music page it is also poured strongly over the left half of the window, `.album-wash`: the cover hue at 72%+ saturation, lightness 32% dark / 60% light, at 85% opacity (92% by day), in front of the rain, 60vw wide at night and 90vw by day (a bright sky drowns it; eased over 45 min around sunrise and sunset), strongest at the far left and easing out smoothly to the right (an ease-out curve sampled at 13 stops, gone by about 56vw; no grain, which reads as pixels); an owner-requested wash); the Listening pane (today and this week/month as type split by a hairline, one series-1 bar per day with hover times) with the controls pane before it in the same row, on the left (from 1024px; above it when narrower), as tall as Listening, its rows spread over that height: a 56px cover with song and artist, a seek line in the cover's colour, shuffle / previous / play / next / repeat (on = sky accent plus a dot), then Spotify's own volume (Windows mixer) as a row of its own with its level in %; Top songs (with covers; each row plays its song: found on Spotify by title and artist and played from its album, a play mark over the cover on hover and a spinner while it starts) and Top artists side by side, a pane each (Top artists: the first place on the left, a rounded-square photo (14px corners, two fifths of the card, up to 180px) from Spotify when connected, else the cover of their most-heard song, with name and time; places 2 to 5 on the right, numbered, in a tight list from the photo's top edge (14px apart), each with a thin series-1 meter measured against the first), all from the local `music_tracks` / `music_plays` history; the search bar as its own pill pane with the Playlists / Up next switch; and the results pane filling the rest (songs as rows; playlists and albums as a grid of cover tiles, 148px minimum: 10px-cornered cover, name, one muted line; hover lifts the tile 2px, zooms the cover 1.03 inside its frame and brings up a round play button on its corner and a pin button top left (pinned playlists come first in Playlists, in pin order, and keep a solid pin badge; Daylight's own pins, kept per PC, since Spotify does not share its pins with apps), while clicking the tile opens the playlist with a 96px cover header; search, queue, playlists through the Web API; before sign-in, one pane with the one-time developer-app connect steps). Record style (the palette button under the arm's plinth, at the stage's left edge, a glass-strong popover; `lib/recordStyle.ts`, kept per PC): vinyl colour (classic black, smoke, cream, red, orange, yellow, green, blue, purple, pink, or the playing album's colour), finish (solid, clear, marble, splatter, liquid, split, chosen from a row of discs the same size as the colour swatches, each showing that finish in the chosen colour, its name in the tooltip; marble is smoky wisps of the opposite ink, splatter is ink flung outward from the label in tapered streaks and specks, liquid is coloured glass, like 3D glasses (a layer under the glass disc, turning with it, blended hard-light after saturate 1.8 / brightness 1.12 / contrast 1.6, so the sleeve and sky show through entirely in the liquid's colour while it stays vivid; a lighter drop shadow than other records) poured through glass-clear vinyl (the sky and sleeve show through, faint grooves, a faint rim and a stronger still sheen) in rounded pools with clear lagoons, bubbles and a glossy edge, the ring round the label sealed clear; the three are seeded SVG textures in `lib/vinylFinishes.ts`, cached per colour; on the turning record the liquid is a live layer (`LiquidPour`, driven from the spin loop) that hangs back as the record comes up to speed and runs on as it coasts (0.6s viscosity), is flung out toward the rim as it spins (a scale on the layer, up to 1.16, with the square of its speed), sloshes after every change of speed (a damped spring, about 0.9 Hz), and has a current flowing through it (an offset and bend on the filter; never animate the noise itself, which redraws it every frame) that runs on for a few seconds after the record stops; still when the record is, and under reduced motion; the rim stays clear; the grooves are shading over `--vinyl-fill`, softer on colour so they never stripe) and label (album colour, album art under a 40% scrim, black with warm grey ink, or white with near-black ink); "Classic" resets; the record itself is the preview. Reduced motion: the record stands still and the arm moves without animating.
- **Rows**: round check, title, meta line, pills on the right (project, due date; overdue tinted red with an icon).
- **Numbers on the sky**: page-level totals (Expenses, Training, Review) are set as type with hairline separators, never boxed in tiles.
- **Charts**: series tokens, hairline grids, glass-strong tooltips; Training's history is a column per week.

## Motion

One language: arrivals decelerate with ease-out-quint (`--ease-out`, `cubic-bezier(0.16, 1, 0.3, 1)`); feedback is 150-280ms, layout changes about 400ms, and only the page entrance takes ~520ms. Keyframes use `backwards` fill and `translate`/`scale` rather than `transform`, so they never fight a drag transform or linger after they end.

- **Page entrance (the one authored moment):** when a page opens, its outermost blocks (header, then each pane in reading order; `[data-settle]` opts other blocks in) come into focus: blur clears, opacity rises, they settle 10px. Stagger 40ms, capped at 8 steps. Content is never hidden by default.
- **Sidebar:** the lit slab behind the active page is one element that glides to the next page (420ms). Full ↔ small slides the rail width (380ms) while every icon and the logo keep their exact position; labels fade and are clipped.
- **Segmented switches** (`Segmented`): one lit slab slides and resizes to the chosen option. Used for Due/Upcoming, Tasks views, Month/Week, chart type and theme.
- **Feedback:** checkbox fills and its tick draws from the short stroke; task titles get a drawn strike line; habit rings grow to their new step and close into the fill with the tick popping in; toasts rise in and slip out; a new sticky note drops onto the board; a switched panel's content fades in.
- **Rain** (test panel toggle, `useWeather`): an overcast veil (`.rain-veil`, grey over the hour's sky so dawn or dusk still tints it), the sun's glow at 30%, stars hidden, and `RainField`: thin streaks in three depths leaning in a light wind, at the screen's refresh rate, batched per depth, fading in and out over 1.5s. `GlassRain` puts the rain on the glass: drops land on every pane larger than 140x90 (`.pane` or `[data-glass]`) with a small splash ring and settle into lens-like beads (bright rim and glint on top, darker edge and contact shadow below), the bigger ones run down with a slight wobble leaving broken trails and swallowing what they meet, and all evaporate after 7-14s (drawn at up to ~72 fps); drawn faint (35% strength, mostly clear beads, the largest about 9px across) on a canvas inside each pane at `z-index: -1`, i.e. between the glass and the pane's content, so text and controls always sit on top of the wet glass and drops scroll with their pane. When the rain stops nothing new lands and the glass dries. Reduced motion keeps only the veil.
- **Scroll edges:** the scroll area runs from the window's top edge (under the title bar) to its bottom edge, so content is never sliced mid-window. At the top, `.scroll-veil` is a progressive blur: a fixed 80px band from the sidebar's edge to the window's right (it fades in across the 12px gap, so blur near the content's left edge spreads instead of being cut; it follows the sidebar width) of four stacked backdrop-blur layers (1.5 / 3 / 6 / 12px, each masked over a shorter stretch from the top), so content going up under the title bar grows softer toward the window edge with no band, tint or edge; over plain sky it shows nothing. Its layers fade in over the first 32px of scroll (a `--veil` variable, never opacity on the parent, which would stop the layers blurring). Never mask the scroll area itself: that breaks the panes' glass.
- **Theme switch:** the whole window cross-fades (View Transitions).
- Dialogs, popovers and menus keep their quick fade-and-zoom.
- **Animations setting** (Settings > Appearance): Follow Windows (default) / On / Off. lib/motion.ts writes `<html data-motion="full|reduce">`; CSS, Tailwind's `motion-reduce:` (redefined in index.css) and script motion all read that, never the media query directly.

## Do's and Don'ts

- Do let the real sky show through every slab; keep text on the fill, not floating on bare sky (titles excepted).
- Do keep done things in place, struck through and dimmed, until the day rolls over.
- Do respect reduced motion: nothing moves or blurs; arrivals become a short fade, the sky stops transitioning and the stars stop twinkling.
- Don't add texture, gradients-as-decoration, coloured side borders, uppercase eyebrows or a second moving accent.
- Don't give a status colour without a second cue.
