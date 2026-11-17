import { useEffect, type RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { inApp } from "@/lib/nowPlaying";

/**
 * The album colour's pulse: Spotify's level from the Windows volume mixer meter (sent by the Rust side
 * ~30 times a second as "spotify-peak") turned into a 0..1 beat value, written straight to the element's
 * --pulse custom property (no React render per frame). Stops reading when inactive or unmounted.
 */
export function useAudioPulse(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const element = ref.current;
    if (!active || !element || !inApp()) return;
    // Daylight's own "keep still" setting (Settings > Animations) wins over the pulse.
    if (document.documentElement.dataset.motion === "reduce") return;

    let ceiling = 0.05;
    let value = 0;
    let target = 0;
    let frame = 0;

    const draw = () => {
      // Snappy on a hit, a softer fall after it, so the colour breathes with the beat instead of flickering.
      value += (target - value) * (target > value ? 0.55 : 0.12);
      element.style.setProperty("--pulse", value.toFixed(3));
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    const unlisten = listen<number>("spotify-peak", ({ payload }) => {
      const peak = Number.isFinite(payload) ? payload : 0;
      // Loudness differs per song and per volume setting: compare each peak with the song's recent loudest
      // (which slowly lets go), so quiet songs still pulse and loud ones do not sit at full.
      ceiling = Math.max(peak, ceiling * 0.996, 0.05);
      const relative = Math.min(1, peak / ceiling);
      // Only the top of the range moves it much, which is where the kicks and snares land.
      target = Math.max(0, (relative - 0.45) / 0.55) ** 1.6;
    });
    void invoke("audio_pulse", { on: true }).catch(() => {});

    return () => {
      cancelAnimationFrame(frame);
      element.style.setProperty("--pulse", "0");
      void unlisten.then((stop) => stop());
      void invoke("audio_pulse", { on: false }).catch(() => {});
    };
  }, [ref, active]);
}
