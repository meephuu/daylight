import { useEffect, useMemo, useState } from "react";
import { StarField } from "@/components/ambient/StarField";
import { useAmbientMinutes, useAmbientPrefs } from "@/lib/ambient";
import { skyAt, sunTimes } from "@/lib/sky";

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
  const sky = skyAt(minutes, dark, sun);
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
      <div
        className="sky-sun absolute rounded-full"
        style={{
          left: `${sky.glowX}%`,
          top: `${sky.glowY}%`,
          opacity: sky.glowOpacity,
        }}
      />
      <StarField visibility={nightStars ? sky.stars : 0} />
    </div>
  );
}
