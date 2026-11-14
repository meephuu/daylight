import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { accentFromCover, isBlackCover, useNowPlayingStore } from "@/lib/nowPlaying";
import { RainField } from "@/components/ambient/RainField";
import { StarField } from "@/components/ambient/StarField";
import { useAmbientMinutes, useAmbientPrefs, useWeather } from "@/lib/ambient";
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
  const rain = useWeather((state) => state.rain);
  // Music page option: while a song plays, its cover's colour becomes the sky's accent and sun.
  const cover = useNowPlayingStore((state) => (state.skyTint && state.track?.playing ? state.coverColor : null));
  const accent = cover ? accentFromCover(cover, dark) : sky.accent;
  // A black cover darkens the sun too (no grey glow).
  const glow = cover ? (isBlackCover(cover) ? cover : accentFromCover(cover, dark)) : sky.glow;
  // On the Music page the colour is poured strongly over the left half of the window, behind the
  // turntable, and dissolves into the hour's sky (see .album-wash).
  const onMusic = useLocation().pathname.startsWith("/music");
  const wash = cover && isBlackCover(cover) ? cover : cover ? accentFromCover(cover, dark, { lightness: dark ? 32 : 60, minSaturation: 72 }) : null;
  // A bright daytime sky drowns the colour, so by day it spreads further across the window and a little
  // stronger: 0 at night, 1 from 45 min after sunrise to 45 min before sunset, easing in between.
  const daylight = Math.max(0, Math.min(1, Math.min(minutes - sun.sunrise, sun.sunset - minutes) / 45));

  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty("--sky-top", sky.top);
    style.setProperty("--sky-mid", sky.mid);
    style.setProperty("--sky-bottom", sky.bottom);
    style.setProperty("--sky-glow", glow);
    style.setProperty("--sky-accent", accent);
  }, [sky.top, sky.mid, sky.bottom, glow, accent]);

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
            // Behind rain clouds the sun is only a faint brightening.
            opacity: rain ? sky.glowOpacity * 0.3 : sky.glowOpacity,
          }}
        />
      )}
      {/* Clouds hide the stars; they come back when the rain clears. */}
      <StarField visibility={nightStars && !rain ? (black ? classicStarsAt(minutes) : sky.stars) : 0} />
      {/* The overcast: a grey veil over whatever hour it is, so the time of day still shows through. */}
      <div className="rain-veil absolute inset-0" style={{ opacity: rain ? 1 : 0 }} />
      <RainField active={rain} />
      {/* The album's colour (Music page), in front of the rain so the colour stays clean. */}
      <div
        className="album-wash absolute inset-y-0 left-0"
        style={
          {
            // A black cover is a lighter veil, or the whole left side goes heavy.
            opacity: onMusic && wash ? (isBlackCover(cover) ? 0.65 : 0.85 + 0.07 * daylight) : 0,
            "--wash-width": `${60 + 30 * daylight}vw`,
            ...(wash ? { "--wash": wash } : {}),
          } as React.CSSProperties
        }
      />
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
