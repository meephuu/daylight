import { useEffect, useRef } from "react";
import { useAmbientTime } from "@/lib/ambient";
import { isReducedMotion } from "@/lib/motion";

/**
 * The night sky, drawn on a canvas.
 *
 * - Hundreds of stars with a realistic spread of brightness (most barely there, a few bright) and
 *   colour by temperature (blue-white to orange).
 * - A faint Milky Way: a soft, patchy band with extra faint stars packed along it.
 * - The whole field turns slowly around the north celestial pole at the real rate (15° an hour). Seen
 *   from Bangkok the pole sits low over the northern horizon, so the pivot is near the bottom of the
 *   window and stars arc counter-clockwise around it.
 * - Stars fade toward the horizon (thicker air, city glow).
 * - Only the bright stars scintillate, with an irregular flicker rather than a pulse.
 * - Now and then, a shooting star.
 *
 * Static parts are cached on an offscreen canvas and redrawn every few seconds as the sky turns; each
 * frame only paints that cache plus the bright stars and any meteor. Reduced motion draws a still sky.
 */

/** The pole's position, as fractions of the window's width and height. */
const POLE_X = 0.5;
const POLE_Y = 0.8;
/** The star field is a disc around the pole this many window-heights wide (covers any window shape). */
const FIELD_RADIUS = 2.1;
/** Real sidereal rotation: 360° in a (near enough) day. */
const RADIANS_PER_MINUTE = (0.25 * Math.PI) / 180;

const FIELD_STARS = 2600;
const BAND_STARS = 2400;
const BAND_CLOUDS = 70;
/** Milky Way: its direction in the field and how far it passes from the pole (window-heights). */
const BAND_ANGLE = (32 * Math.PI) / 180;
const BAND_OFFSET = 0.62;

const FRAME_MS = 1000 / 20;
const BASE_REDRAW_MS = 4000;

type Rgb = [number, number, number];

/** Star colours by temperature, with how common each is. */
const STAR_COLORS: { rgb: Rgb; weight: number }[] = [
  { rgb: [200, 215, 255], weight: 0.2 },
  { rgb: [244, 246, 255], weight: 0.45 },
  { rgb: [255, 244, 224], weight: 0.2 },
  { rgb: [255, 226, 178], weight: 0.1 },
  { rgb: [255, 197, 143], weight: 0.05 },
];

interface Star {
  /** Polar position around the pole: distance in window-heights, angle in radians. */
  r: number;
  theta: number;
  radius: number;
  alpha: number;
  rgb: Rgb;
  /** Bright stars are drawn every frame with a glow and a flicker. */
  bright: boolean;
  speedA: number;
  speedB: number;
  phase: number;
}

interface Cloud {
  r: number;
  theta: number;
  size: number;
  alpha: number;
  rgb: Rgb;
}

/** Small seeded generator, so the sky is the same every time the app opens. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSky() {
  const random = mulberry32(2024);
  const between = (min: number, max: number) => min + random() * (max - min);
  const gaussian = () => {
    const u = Math.max(random(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
  };
  const pickColor = (): Rgb => {
    let roll = random();
    for (const { rgb, weight } of STAR_COLORS) {
      if ((roll -= weight) <= 0) return rgb;
    }
    return STAR_COLORS[1]!.rgb;
  };

  const makeStar = (r: number, theta: number, faintOnly: boolean): Star => {
    const tier = faintOnly ? 0 : random();
    // 82% faint, 15% medium, 3% bright: the sky's usual steep brightness curve.
    const bright = tier > 0.97;
    const medium = !bright && tier > 0.82;
    return {
      r,
      theta,
      radius: bright ? between(1.1, 1.7) : medium ? between(0.7, 1) : between(0.35, 0.65),
      alpha: bright ? between(0.85, 1) : medium ? between(0.5, 0.8) : between(faintOnly ? 0.12 : 0.18, faintOnly ? 0.35 : 0.5),
      rgb: pickColor(),
      bright,
      speedA: between(2.5, 6),
      speedB: between(7, 13),
      phase: between(0, Math.PI * 2),
    };
  };

  const stars: Star[] = [];
  for (let i = 0; i < FIELD_STARS; i += 1) {
    stars.push(makeStar(FIELD_RADIUS * Math.sqrt(random()), between(0, Math.PI * 2), false));
  }

  // A point on the Milky Way band (along it by t, across it by g), as polar coordinates around the pole.
  const bandPoint = (t: number, g: number) => {
    const nx = -Math.sin(BAND_ANGLE);
    const ny = Math.cos(BAND_ANGLE);
    const x = Math.cos(BAND_ANGLE) * t + nx * (BAND_OFFSET + g);
    const y = Math.sin(BAND_ANGLE) * t + ny * (BAND_OFFSET + g);
    return { r: Math.hypot(x, y), theta: Math.atan2(y, x) };
  };

  for (let i = 0; i < BAND_STARS; i += 1) {
    // A dense core with a wider, thinner halo.
    const g = gaussian() * (random() < 0.7 ? 0.06 : 0.14);
    const { r, theta } = bandPoint(between(-FIELD_RADIUS, FIELD_RADIUS), g);
    if (r < FIELD_RADIUS) stars.push(makeStar(r, theta, true));
  }

  const clouds: Cloud[] = [];
  for (let i = 0; i < BAND_CLOUDS; i += 1) {
    const { r, theta } = bandPoint(between(-FIELD_RADIUS, FIELD_RADIUS), gaussian() * 0.05);
    clouds.push({
      r,
      theta,
      size: between(0.08, 0.24),
      alpha: between(0.012, 0.035),
      rgb: random() < 0.6 ? [190, 200, 255] : [255, 228, 200],
    });
  }

  return { faint: stars.filter((star) => !star.bright), bright: stars.filter((star) => star.bright), clouds };
}

const SKY = buildSky();

/** Thicker air and city glow near the horizon: full brightness up top, mostly gone at the bottom. */
function horizonFade(y: number, height: number): number {
  const t = Math.min(1, Math.max(0, (y / height - 0.45) / 0.55));
  return 1 - 0.88 * t * t * (3 - 2 * t);
}

function rgba([r, g, b]: Rgb, alpha: number): string {
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

/** Minutes after midnight, with seconds: the time tester's value if set, otherwise the real clock. */
function skyMinutes(): number {
  const override = useAmbientTime.getState().override;
  if (override !== null) return override;
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000;
}

interface Meteor {
  x: number;
  y: number;
  dx: number;
  dy: number;
  length: number;
  start: number;
  duration: number;
}

interface StarFieldProps {
  /** 0-1, from the sky phase; nothing is rendered (and nothing animates) while it is 0. */
  visibility: number;
}

export function StarField({ visibility }: StarFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shown = visibility > 0.001;

  useEffect(() => {
    if (!shown) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const base = document.createElement("canvas");
    const baseCtx = base.getContext("2d");
    if (!baseCtx) return;

    const reducedMotion = isReducedMotion();
    let width = 0;
    let height = 0;
    let dpr = 1;
    let baseDrawnAt = -Infinity;
    let lastFrame = 0;
    let frame = 0;
    let meteor: Meteor | null = null;
    let nextMeteorAt = performance.now() + 30_000 + Math.random() * 90_000;

    const project = (r: number, theta: number, angle: number) => ({
      x: POLE_X * width + r * height * Math.cos(theta + angle),
      y: POLE_Y * height + r * height * Math.sin(theta + angle),
    });

    // Counter-clockwise on screen as time passes, as the northern sky turns around the pole.
    const currentAngle = () => -skyMinutes() * RADIANS_PER_MINUTE;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      for (const target of [canvas!, base]) {
        target.width = Math.round(width * dpr);
        target.height = Math.round(height * dpr);
      }
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      baseDrawnAt = -Infinity;
    }

    function drawBase(angle: number) {
      const c = baseCtx!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, width, height);

      for (const cloud of SKY.clouds) {
        const { x, y } = project(cloud.r, cloud.theta, angle);
        const size = cloud.size * height;
        if (x < -size || x > width + size || y < -size || y > height + size) continue;
        const fade = horizonFade(y, height);
        const gradient = c.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, rgba(cloud.rgb, cloud.alpha * fade));
        gradient.addColorStop(1, rgba(cloud.rgb, 0));
        c.fillStyle = gradient;
        c.fillRect(x - size, y - size, size * 2, size * 2);
      }

      for (const star of SKY.faint) {
        const { x, y } = project(star.r, star.theta, angle);
        if (x < -2 || x > width + 2 || y < -2 || y > height + 2) continue;
        c.fillStyle = rgba(star.rgb, star.alpha * horizonFade(y, height));
        c.beginPath();
        c.arc(x, y, star.radius, 0, Math.PI * 2);
        c.fill();
      }
    }

    function drawBright(angle: number, time: number) {
      for (const star of SKY.bright) {
        const { x, y } = project(star.r, star.theta, angle);
        if (x < -12 || x > width + 12 || y < -12 || y > height + 12) continue;
        // Scintillation: two unrelated waves multiplied, so the flicker never settles into a rhythm.
        const flicker = reducedMotion
          ? 1
          : 0.72 + 0.28 * Math.sin(time / 1000 * star.speedA + star.phase) * Math.sin(time / 1000 * star.speedB + star.phase * 1.7);
        const alpha = star.alpha * flicker * horizonFade(y, height);
        const glow = star.radius * 5;
        const gradient = ctx!.createRadialGradient(x, y, 0, x, y, glow);
        gradient.addColorStop(0, rgba(star.rgb, alpha * 0.55));
        gradient.addColorStop(0.25, rgba(star.rgb, alpha * 0.12));
        gradient.addColorStop(1, rgba(star.rgb, 0));
        ctx!.fillStyle = gradient;
        ctx!.fillRect(x - glow, y - glow, glow * 2, glow * 2);
        ctx!.fillStyle = rgba(star.rgb, alpha);
        ctx!.beginPath();
        ctx!.arc(x, y, star.radius, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function spawnMeteor(time: number) {
      const leftward = Math.random() < 0.5;
      const angle = (leftward ? 150 : 30) * (Math.PI / 180) + (Math.random() - 0.5) * 0.5;
      meteor = {
        x: width * (0.15 + Math.random() * 0.7),
        y: height * (0.04 + Math.random() * 0.3),
        dx: Math.cos(angle),
        dy: Math.sin(angle),
        length: 140 + Math.random() * 120,
        start: time,
        duration: 650 + Math.random() * 450,
      };
      nextMeteorAt = time + 90_000 + Math.random() * 210_000;
    }

    function drawMeteor(time: number) {
      if (!meteor) return;
      const t = (time - meteor.start) / meteor.duration;
      if (t >= 1) {
        meteor = null;
        return;
      }
      const travel = meteor.length * 1.6 * t;
      const headX = meteor.x + meteor.dx * travel;
      const headY = meteor.y + meteor.dy * travel;
      const tail = meteor.length * Math.min(1, t * 3);
      const tailX = headX - meteor.dx * tail;
      const tailY = headY - meteor.dy * tail;
      // Flares up quickly, then burns out.
      const alpha = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.9;
      const gradient = ctx!.createLinearGradient(headX, headY, tailX, tailY);
      gradient.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(3)})`);
      gradient.addColorStop(1, "rgba(200,215,255,0)");
      ctx!.strokeStyle = gradient;
      ctx!.lineWidth = 1.3;
      ctx!.lineCap = "round";
      ctx!.beginPath();
      ctx!.moveTo(headX, headY);
      ctx!.lineTo(tailX, tailY);
      ctx!.stroke();
    }

    function render(time: number) {
      const angle = currentAngle();
      if (time - baseDrawnAt >= BASE_REDRAW_MS) {
        drawBase(angle);
        baseDrawnAt = time;
      }
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.drawImage(base, 0, 0);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBright(angle, time);
      if (!reducedMotion) {
        if (!meteor && time >= nextMeteorAt) spawnMeteor(time);
        drawMeteor(time);
      }
    }

    function loop(time: number) {
      frame = requestAnimationFrame(loop);
      if (time - lastFrame < FRAME_MS) return;
      lastFrame = time;
      render(time);
    }

    resize();
    window.addEventListener("resize", resize);
    let interval = 0;
    if (reducedMotion) {
      // A still sky, redrawn once a minute as it turns.
      const still = () => {
        baseDrawnAt = -Infinity;
        render(performance.now());
      };
      still();
      interval = window.setInterval(still, 60_000);
    } else {
      frame = requestAnimationFrame(loop);
    }

    // The time tester can jump the clock: redraw the turned sky straight away.
    const unsubscribe = useAmbientTime.subscribe(() => {
      baseDrawnAt = -Infinity;
      if (reducedMotion) render(performance.now());
    });

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("resize", resize);
      unsubscribe();
    };
  }, [shown]);

  if (!shown) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 hidden dark:block"
      style={{ opacity: visibility, transition: "opacity 500ms linear" }}
    />
  );
}
