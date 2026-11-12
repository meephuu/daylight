import { useEffect, useRef, useState } from "react";
import { isReducedMotion } from "@/lib/motion";

/**
 * Rain on the glass. While it rains, drops land on every glass pane (a tiny splash ring, then a bead),
 * the bigger ones eventually run down the pane leaving a trail of small beads and swallowing the drops
 * they meet, and everything slowly evaporates. When the rain stops nothing new lands and the glass dries.
 *
 * Each pane gets its own canvas, slotted between the glass and the pane's content: `z-index: -1` inside
 * the pane's stacking context (every pane has one, from its backdrop-filter), so text, buttons and charts
 * sit on top of the wet glass. The canvas lives inside the pane, so drops scroll with it for free. Beads
 * are pre-rendered sprites (a clear lens: light rim and glint on top, a faint darker edge below); one
 * shared loop draws every pane at up to ~72 fps (every frame on a 60 Hz screen) and stops by itself while the window is hidden, and once the
 * glass is dry the canvases are removed. Reduced motion: no drops.
 *
 * This is the one exception to "no texture on glass": it exists only while it rains.
 */

/** Panes smaller than this (toolbar capsules, chips) stay dry. */
const MIN_PANE_W = 140;
const MIN_PANE_H = 90;
/** New drops per second per million square pixels of glass. */
const LANDING_RATE = 45;
// A cap a little under one 60 Hz frame, so a 60 Hz screen draws every frame and a 144 Hz one every other.
const FRAME_MS = 1000 / 72;
const FADE_MS = 1500;
const SPLASH_MS = 260;
/** Hard cap per pane, so a long downpour never piles up. */
const MAX_DROPS_PER_PANE = 165;
/** How strongly drops show at all: low, so the glass reads as wet and stays see-through. */
const DROP_OPACITY = 0.35;
/** The largest a drop gets, even after swallowing others on its way down. */
const MAX_R = 4.6;
const SPRITE_SIZES = [1.4, 2, 2.7, 3.5, 4.6];
const SPRITE_SCALE = 3;

interface Drop {
  /** Position inside the pane, px from its top-left. */
  x: number;
  y: number;
  r: number;
  born: number;
  /** When it starts to evaporate, and how long that takes. */
  dies: number;
  dryMs: number;
  /** Runs down the glass once `slideAt` passes (big drops only). */
  slideAt: number;
  speed: number;
  wobble: number;
  lastBead: number;
  bead: boolean;
}

interface Glass {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  drops: Drop[];
  /** Fractional drops carried between frames, so slow rates still land. */
  owed: number;
  /** The pane's inline `position` before we made it a containing block, restored on cleanup. */
  restorePosition: string | null;
}

/** One lens-like bead sprite per size, for the current theme. Mostly clear: water, not paint. */
function makeSprites(dark: boolean): HTMLCanvasElement[] {
  return SPRITE_SIZES.map((r) => {
    const size = Math.ceil((r * 2 + 3) * SPRITE_SCALE);
    const sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const c = sprite.getContext("2d")!;
    c.scale(SPRITE_SCALE, SPRITE_SCALE);
    const cx = size / SPRITE_SCALE / 2;
    const cy = size / SPRITE_SCALE / 2;
    // A faint contact shadow just below the bead.
    c.fillStyle = dark ? "rgba(0,0,0,0.2)" : "rgba(20,30,60,0.1)";
    c.beginPath();
    c.ellipse(cx, cy + r * 0.35, r * 0.95, r * 0.9, 0, 0, Math.PI * 2);
    c.fill();
    // The body: almost clear, with light gathering at the lower edge.
    const body = c.createRadialGradient(cx, cy + r * 0.35, r * 0.1, cx, cy, r);
    body.addColorStop(0, dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.25)");
    body.addColorStop(0.65, dark ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.05)");
    body.addColorStop(1, dark ? "rgba(255,255,255,0.38)" : "rgba(40,55,90,0.34)");
    c.fillStyle = body;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    // The rim catches light on top.
    c.strokeStyle = dark ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.85)";
    c.lineWidth = Math.max(0.5, r * 0.18);
    c.beginPath();
    c.arc(cx, cy, r * 0.88, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
    // A specular glint, top left.
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.beginPath();
    c.ellipse(cx - r * 0.32, cy - r * 0.38, r * 0.24, r * 0.16, -0.6, 0, Math.PI * 2);
    c.fill();
    return sprite;
  });
}

function spriteFor(sprites: HTMLCanvasElement[], r: number): { sprite: HTMLCanvasElement; base: number } {
  let index = SPRITE_SIZES.findIndex((size) => size >= r);
  if (index === -1) index = SPRITE_SIZES.length - 1;
  return { sprite: sprites[index]!, base: SPRITE_SIZES[index]! };
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function land(drops: Drop[], w: number, h: number, now: number) {
  // Mostly small drops; a few big enough to run.
  const big = Math.random() < 0.12;
  const r = big ? rand(3, 4) : Math.random() < 0.6 ? rand(1.1, 1.9) : rand(1.9, 2.8);
  drops.push({
    x: rand(r, w - r),
    y: rand(r, h - r),
    r,
    born: now,
    dies: now + rand(7000, 14000),
    dryMs: rand(1200, 2400),
    slideAt: big ? now + rand(600, 4000) : Infinity,
    speed: rand(28, 70),
    wobble: rand(0, Math.PI * 2),
    lastBead: 0,
    bead: false,
  });
}

function step(drops: Drop[], h: number, dt: number, now: number) {
  for (let i = drops.length - 1; i >= 0; i -= 1) {
    const drop = drops[i];
    if (!drop) continue;
    if (now >= drop.dies + drop.dryMs) {
      drops.splice(i, 1);
      continue;
    }
    if (now < drop.slideAt) continue;
    // Running down: gravity, a little sideways wander, and now and then a bead left behind.
    const before = drop.y;
    drop.y += drop.speed * dt;
    drop.x += Math.sin(now / 260 + drop.wobble) * 6 * dt;
    drop.lastBead += drop.y - before;
    if (drop.lastBead > rand(12, 26)) {
      drop.lastBead = 0;
      drop.r = Math.max(2.4, drop.r - 0.05);
      drops.push({
        x: drop.x + rand(-0.6, 0.6),
        y: drop.y - drop.r * 1.1,
        r: rand(0.8, 1.4),
        born: now,
        dies: now + rand(1500, 3200),
        dryMs: 900,
        slideAt: Infinity,
        speed: 0,
        wobble: 0,
        lastBead: 0,
        bead: true,
      });
    }
    // Swallows the drops it runs into, growing a little.
    for (let j = drops.length - 1; j >= 0; j -= 1) {
      const other = drops[j];
      if (!other || other === drop || other.bead || now >= other.slideAt) continue;
      if (Math.hypot(other.x - drop.x, other.y - drop.y) < drop.r + other.r * 0.6) {
        drop.r = Math.min(MAX_R, Math.sqrt(drop.r * drop.r + other.r * other.r * 0.6));
        drop.speed = Math.min(110, drop.speed + 6);
        drops.splice(j, 1);
        if (j < i) i -= 1;
      }
    }
    if (drop.y - drop.r > h) {
      const index = drops.indexOf(drop);
      if (index !== -1) drops.splice(index, 1);
    }
  }
}

export function GlassRain({ active }: { active: boolean }) {
  const raining = useRef(active);
  raining.current = active;
  const running = useRef(false);
  /** Each rain spell is one run of the loop; it keeps going after the rain stops, until the glass is dry. */
  const [spell, setSpell] = useState(0);

  useEffect(() => {
    if (active && !running.current) setSpell((value) => value + 1);
  }, [active]);

  useEffect(() => {
    if (spell === 0 || isReducedMotion()) return;
    running.current = true;
    let finishTimer: number | undefined;

    const glasses = new Map<HTMLElement, Glass>();
    let dark = document.documentElement.classList.contains("dark");
    let sprites = makeSprites(dark);
    let lastScan = -Infinity;
    let lastFrame = 0;
    let last = performance.now();
    let frame = 0;
    let dryingSince: number | null = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function attach(pane: HTMLElement): Glass | null {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      canvas.setAttribute("aria-hidden", "true");
      canvas.dataset.glassRain = "";
      // Between the glass and the content: below every in-flow child, above the pane's own background.
      Object.assign(canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        zIndex: "-1",
        pointerEvents: "none",
        borderRadius: "inherit",
        opacity: "0",
        transition: `opacity ${FADE_MS}ms ease-out`,
      });
      let restorePosition: string | null = null;
      if (getComputedStyle(pane).position === "static") {
        restorePosition = pane.style.position;
        pane.style.position = "relative";
      }
      pane.appendChild(canvas);
      requestAnimationFrame(() => (canvas.style.opacity = "1"));
      return { canvas, ctx, drops: [], owed: 0, restorePosition };
    }

    function detach(pane: HTMLElement, glass: Glass) {
      glass.canvas.remove();
      if (glass.restorePosition !== null) pane.style.position = glass.restorePosition;
      glasses.delete(pane);
    }

    // Which panes exist changes with the page; checking twice a second is plenty.
    function scan() {
      for (const [pane, glass] of glasses) if (!pane.isConnected || !glass.canvas.isConnected) detach(pane, glass);
      if (!raining.current) return;
      for (const pane of document.querySelectorAll<HTMLElement>(".pane, [data-glass]")) {
        if (glasses.has(pane)) continue;
        if (pane.offsetWidth < MIN_PANE_W || pane.offsetHeight < MIN_PANE_H) continue;
        const glass = attach(pane);
        if (glass) glasses.set(pane, glass);
      }
    }

    function finish() {
      cancelAnimationFrame(frame);
      for (const glass of glasses.values()) glass.canvas.style.opacity = "0";
      finishTimer = window.setTimeout(() => {
        for (const [pane, glass] of glasses) detach(pane, glass);
        running.current = false;
        // If the rain came back while the glass was drying, a new spell starts.
        if (raining.current) setSpell((value) => value + 1);
      }, FADE_MS);
    }

    function draw(time: number) {
      frame = requestAnimationFrame(draw);
      if (time - lastFrame < FRAME_MS) return;
      const dt = Math.min(0.1, (time - last) / 1000);
      last = time;
      lastFrame = time;
      const now = Date.now();

      const nowDark = document.documentElement.classList.contains("dark");
      if (nowDark !== dark) {
        dark = nowDark;
        sprites = makeSprites(dark);
      }
      if (time - lastScan > 500) {
        scan();
        lastScan = time;
      }

      let anyDrops = false;
      for (const [pane, glass] of glasses) {
        const w = pane.clientWidth;
        const h = pane.clientHeight;
        const { canvas, ctx, drops } = glass;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        if (raining.current && drops.length < MAX_DROPS_PER_PANE) {
          glass.owed += ((w * h) / 1_000_000) * LANDING_RATE * dt;
          while (glass.owed >= 1) {
            land(drops, w, h, now);
            glass.owed -= 1;
          }
        }
        step(drops, h, dt, now);
        if (drops.length > 0) anyDrops = true;

        // Panes scrolled out of view keep their drops but are not drawn.
        const rect = pane.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        for (const drop of drops) {
          const age = now - drop.born;
          const drying = now > drop.dies ? 1 - (now - drop.dies) / drop.dryMs : 1;
          if (age < SPLASH_MS && !drop.bead) {
            // The impact: a faint ring spreading out as the bead settles.
            const t = age / SPLASH_MS;
            ctx.globalAlpha = 1;
            ctx.strokeStyle = dark
              ? `rgba(255,255,255,${(0.35 * DROP_OPACITY * (1 - t)).toFixed(3)})`
              : `rgba(40,55,90,${(0.25 * DROP_OPACITY * (1 - t)).toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(drop.x, drop.y, drop.r * (1 + t * 2.2), 0, Math.PI * 2);
            ctx.stroke();
          }
          const grow = age < SPLASH_MS ? 0.6 + 0.4 * (age / SPLASH_MS) : 1;
          const r = drop.r * grow * (0.55 + 0.45 * drying);
          // A running drop stretches a little along its path.
          const stretch = now >= drop.slideAt ? 1.25 : 1;
          const { sprite, base } = spriteFor(sprites, drop.r);
          const k = r / base;
          const sw = (sprite.width / SPRITE_SCALE) * k;
          const sh = (sprite.height / SPRITE_SCALE) * k * stretch;
          ctx.globalAlpha = Math.max(0, drying) * DROP_OPACITY;
          ctx.drawImage(sprite, drop.x - sw / 2, drop.y - sh / 2, sw, sh);
        }
        ctx.globalAlpha = 1;
      }

      // After the rain, keep going until the glass is dry (at most 20 s), then remove everything.
      if (!raining.current) {
        dryingSince ??= time;
        if (!anyDrops || time - dryingSince > 20_000) finish();
      } else {
        dryingSince = null;
      }
    }

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(finishTimer);
      for (const [pane, glass] of glasses) detach(pane, glass);
      running.current = false;
    };
  }, [spell]);

  return null;
}
