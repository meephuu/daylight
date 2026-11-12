import { useEffect, useMemo, useState } from "react";
import { StarField } from "@/components/ambient/StarField";
import { useAmbientMinutes, useAmbientPrefs } from "@/lib/ambient";
import { skyAt, sunTimes, type SkyColors } from "@/lib/sky";
import { classicGlowAt, classicStarsAt } from "@/lib/classicGlow";
import { useTheme } from "@/lib/theme";

/**
 * The Black theme's sky: Daylight 1.0's plain black window, with one fixed accent. Its time of day comes
 * from the original app's blurry glow and star timings (lib/classicGlow.ts), drawn below.
 */
const BLACK_SKY: SkyColors & { stars: number } = {
  top: "#0a0a0a",
  mid: "#0a0a0a",
  bottom: "#0a0a0a",
  glow: "#000000",
  glowX: 50,
  glowY: 50,
  glowOpacity: 0,
  accent: "#7aa2ff",
  stars: 0,
};

/** True while the dark theme is applied (lib/theme.ts toggles the class on <html>). */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/** Today's sun times, recomputed when the date changes. */
function useSunTimes() {
  const [day, setDay] = useState(() => new Date().toDateString());
  useEffect(() => {
    const id = window.setInterval(() => setDay(new Date().toDateString()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  // `day` is the dependency on purpose: the sun times only change when the date does.
  return useMemo(() => sunTimes(new Date(day)), [day]);
}

/**
 * The window's sky: a full-bleed gradient and a soft sun that follow the real time of day, with the
 * night stars on top after dark. It also publishes the hour's colours as CSS custom properties
 * (--sky-top, --sky-mid, --sky-bottom, --sky-glow, --sky-accent) so the glass and small lit details
 * across the app pick up the same light.
 */
export function SkyBackground() {
  const minutes = useAmbientMinutes();
  const dark = useIsDark();
  const sun = useSunTimes();
  const black = useTheme((state) => state.theme === "black");
  const sky = black ? BLACK_SKY : skyAt(minutes, dark, sun);
  const nightStars = useAmbientPrefs((state) => state.nightStars);

  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty("--sky-top", sky.top);
    style.setProperty("--sky-mid", sky.mid);
    style.setProperty("--sky-bottom", sky.bottom);
    style.setProperty("--sky-glow", sky.glow);
    style.setProperty("--sky-accent", sky.accent);
  }, [sky.top, sky.mid, sky.bottom, sky.glow, sky.accent]);

  return (
    <div aria-hidden="true" className="sky pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {black ? (
        <ClassicGlow minutes={minutes} />
      ) : (
        <div
          className="sky-sun absolute rounded-full"
          style={{
            left: `${sky.glowX}%`,
            top: `${sky.glowY}%`,
            opacity: sky.glowOpacity,
          }}
        />
      )}
      <StarField visibility={nightStars ? (black ? classicStarsAt(minutes) : sky.stars) : 0} />
    </div>
  );
}

/** Daylight 1.0's glow, exactly as it was: one very blurry shape that moves and recolours through the day. */
function ClassicGlow({ minutes }: { minutes: number }) {
  const glow = classicGlowAt(minutes);
  return (
    <div
      className="absolute rounded-full motion-reduce:transition-none"
      style={{
        left: `${glow.x}%`,
        top: `${glow.y}%`,
        width: `${glow.width}vw`,
        height: `${glow.height}vw`,
        transform: "translate(-50%, -50%)",
        backgroundColor: glow.color,
        opacity: glow.opacity,
        filter: "blur(clamp(70px, 8vw, 150px))",
        // Smooths the small steps of the real clock and the time tester.
        transition:
          "left 500ms linear, top 500ms linear, width 500ms linear, height 500ms linear, background-color 500ms linear, opacity 500ms linear",
      }}
    />
  );
}
