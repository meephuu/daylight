---
version: 1
slug: "src-components-layout-tsx"
primary_target: "src/components/Layout.tsx"
related_targets: ["src/pages/Home.tsx","src/index.css"]
---

# Daylight 2.0 app shell and pages

Scope: the whole app UI (shell, Home, Tasks, Calendar, Notes, Habits, Training, Expenses, Weekly review, Settings, dialogs). Mode: Operate.
Audience/job: the owner, daily, desktop; know today at a glance and act in one or two clicks. Constraints: UI only, no data or schema change; dark first, light must work; reduced motion respected.
Owner steer on the chosen card: no texture on the glass; the background is the sky through the day driven by the real time; lighter card shadows.

## Direction contract

THESIS: Every panel is a slab of thick clear acrylic and the real sky of this hour shows through it. Refuses the grey sidebar-and-cards dashboard with one indigo accent.

OWN-WORLD: Full-window sky gradient keyed to the clock (dawn apricot and rose, noon cerulean, dusk coral to violet, night indigo with stars). Slabs: clean blurred acrylic, bright top edge, faint inner edge, light shadow, no texture. Data colours suspended in the glass: aqua, lime, coral-pink, amber, violet; every project, habit and category keeps its own colour everywhere. Active nav is a lit slab with a sky-coloured edge.

STORY: The owner opens Daylight, sees what hour it is by the light, reads today's schedule as a proportional strip, the next thing coming, what is left, and acts.

FIRST VIEWPORT: Glass nav rail left; Home hero slab spans 9/12 with greeting, date and today's time strip (length equals duration, now-line); Next-up slab 3/12 tinted with the hour; below, Today tasks, Habits heatmap, Training ring, Money with trend. Title bar carries the live sky readout.

FORM: Tunnel Glass, position 6 of 7 on the grounded list, seed:56b7f5fb73222b46. Raises: length is duration; nothing disappears, it cancels; state never colour alone; every number paired with proof; next thing always one glance away.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
