import { useEffect, useRef, useState } from "react";
import { isReducedMotion } from "@/lib/motion";

/**
 * Rain over the sky, drawn on a canvas.
 *
 * Thin streaks in three depths: far drops are short, slow and faint; near ones long, fast and brighter.
 * All lean the same way in a light wind. Seen through the glass panes they blur into soft lines, like
 * rain behind frosted glass. Each depth is one batched path per frame (cheap even at ~400 drops), so the
 * loop runs at the screen's own refresh rate for smooth falling, and stops by itself while the window is hidden.
 *
 * Fades in and out over the same time as the overcast veil in SkyBackground. With reduced motion no
 * drops fall; the overcast sky alone says it is raining.
 */

interface Layer {
  /** Drops per million square pixels. */
  density: number;
  length: [number, number];
  /** Fall speed, px per second. */
  speed: [number, number];
  alpha: number;
  width: number;
}

const LAYERS: Layer[] = [
  { density: 230, length: [9, 15], speed: [700, 950], alpha: 0.16, width: 1 },
  { density: 120, length: [17, 26], speed: [1050, 1350], alpha: 0.24, width: 1.1 },
  { density: 45, length: [30, 46], speed: [1500, 1900], alpha: 0.32, width: 1.4 },
];

/** Sideways drift per unit of fall: a light wind from the left. */
const WIND = 0.16;
const FADE_MS = 1500;

interface Drop {
  x: number;
  y: number;
  length: number;
  speed: number;
}

export function RainField({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Stays mounted through the fade-out, then unmounts so nothing runs on a dry day.
  const [mounted, setMounted] = useState(active);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (!mounted || isReducedMotion()) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let layers: Drop[][] = [];
    const between = ([min, max]: [number, number]) => min + Math.random() * (max - min);

    // A drop anywhere across the window, including the strip to the left the wind carries in from.
    const spawn = (layer: Layer, anywhere: boolean): Drop => ({
      x: Math.random() * (width + height * WIND) - height * WIND,
      y: anywhere ? Math.random() * height : -Math.random() * height * 0.25 - 50,
      length: between(layer.length),
      speed: between(layer.speed),
    });

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      const area = (width * height) / 1_000_000;
      layers = LAYERS.map((layer) => Array.from({ length: Math.round(layer.density * area) }, () => spawn(layer, true)));
    }

    let last = performance.now();
    let frame = 0;

    function draw(time: number) {
      frame = requestAnimationFrame(draw);
      // Every frame the screen draws. Cap the step, so a long pause (a hidden window) does not jump every
      // drop at once.
      const dt = Math.min(0.1, Math.max(0, time - last) / 1000);
      last = time;

      // Pale drops on a dark sky; slate-blue ones on a light sky, where white would vanish.
      const dark = document.documentElement.classList.contains("dark");
      const ink = dark ? "205, 218, 240" : "60, 80, 120";

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      ctx!.lineCap = "round";
      LAYERS.forEach((layer, index) => {
        const drops = layers[index] ?? [];
        ctx!.strokeStyle = `rgba(${ink}, ${dark ? layer.alpha : layer.alpha * 1.3})`;
        ctx!.lineWidth = layer.width;
        ctx!.beginPath();
        for (let i = 0; i < drops.length; i += 1) {
          const drop = drops[i]!;
          drop.y += drop.speed * dt;
          drop.x += drop.speed * dt * WIND;
          if (drop.y - drop.length > height) {
            drops[i] = spawn(layer, false);
            continue;
          }
          ctx!.moveTo(drop.x, drop.y);
          ctx!.lineTo(drop.x - drop.length * WIND, drop.y - drop.length);
        }
        ctx!.stroke();
      });
    }

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 transition-opacity ease-out motion-reduce:hidden"
      style={{ opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
    />
  );
}
