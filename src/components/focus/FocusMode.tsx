import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloudRain, Pause, PictureInPicture2, Play, SkipForward, Square, X } from "lucide-react";
import { CelebrationRings, Clock, Ring, useNow } from "@/components/focus/FocusStage";
import { useWeather } from "@/lib/ambient";
import { formatClock, isCelebrating, PHASE_LABELS, remainingAt, useFocusTimer } from "@/lib/focus";
import { openMiniTimer } from "@/lib/miniTimer";
import { startRain, stopRain } from "@/lib/rainSound";
import { cn } from "@/lib/utils";

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";

const reducedMotion = () => document.documentElement.dataset.motion === "reduce";

const TOP_BUTTON =
  "grid size-10 place-items-center rounded-full text-foreground/70 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

const RAIN_KEY = "focusRain";
function readRainPref(): boolean {
  try {
    return localStorage.getItem(RAIN_KEY) === "on";
  } catch {
    return false;
  }
}

/** The transform that puts `to` exactly over `from` (same centre and width). */
function delta(from: DOMRect, to: DOMRect): string {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${from.width / to.width})`;
}

/**
 * Focus mode: while a run is under way the whole window steps back (darker, softly blurred) and the
 * timer alone fills it: the ring, the time and play / pause. Stop and skip only come up while paused.
 * The ring grows out of its place on the page as focus mode opens and shrinks back into it when the run
 * ends or is stopped; each changing digit rolls into place and a slow glow breathes behind the ring
 * while it runs. Always dark ink on the darkened sky (the `dark` class), whatever the theme.
 */
export function FocusMode({ active, onClosed }: { active: boolean; onClosed: () => void }) {
  const timer = useFocusTimer();
  const setFocusMode = useFocusTimer((state) => state.setFocusMode);
  const running = timer.status === "running";
  const paused = timer.status === "paused";
  const now = useNow(running);
  // A focus run just ran out with focus mode open: it stays a moment at 00:00 to celebrate, then closes
  // (the timer store closes it), the clock rolling on to the break as the ring flies back.
  const celebrating = active && timer.celebrate?.inFocusMode === true && isCelebrating(timer.celebrate, Date.now());
  const left = celebrating ? 0 : remainingAt(timer, now);
  const progress = celebrating ? 0 : timer.durationMs > 0 ? left / timer.durationMs : 0;

  const veilRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLDivElement>(null);

  // Rain: a sound made in the app plus the rain on the glass, while focus mode is open (remembered per PC).
  const [rainOn, setRainOnState] = useState(readRainPref);
  const setRainOn = (on: boolean) => {
    setRainOnState(on);
    try {
      localStorage.setItem(RAIN_KEY, on ? "on" : "off");
    } catch {
      // Still applies for now without storage.
    }
  };
  const raining = rainOn && active;
  useEffect(() => {
    if (!raining) return;
    const weather = useWeather.getState();
    const before = weather.rain;
    startRain();
    weather.setRain(true);
    return () => {
      stopRain();
      useWeather.getState().setRain(before);
    };
  }, [raining]);

  // The timer sits over the page's own area (beside the sidebar, which stays usable above the darkening).
  const [area, setArea] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const main = document.getElementById("app-main");
    if (!main) return;
    const measure = () => {
      const rect = main.getBoundingClientRect();
      setArea({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    window.addEventListener("resize", measure);
    document.documentElement.dataset.focusMode = "on";
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      delete document.documentElement.dataset.focusMode;
    };
  }, []);

  // Opening: the veil darkens in, the ring flies from the page to the middle, then the controls rise.
  // The flying ring is a scaled copy, so its stroke is thinner than the page's 8px ring at the start:
  // the two cross-fade over the first moments instead of one popping into the other.
  useLayoutEffect(() => {
    const veil = veilRef.current;
    const stage = stageRef.current;
    const controls = controlsRef.current;
    if (!veil || !stage || !controls) return;
    const reduce = reducedMotion();
    const inline = document.getElementById("focus-ring-inline");
    const from = inline?.getBoundingClientRect();
    const animations = [
      veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduce ? 160 : 700, easing: EASE_OUT }),
      ...(closeRef.current
        ? [closeRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: reduce ? 0 : 600, fill: "backwards" })]
        : []),
      controls.animate([{ opacity: 0, translate: reduce ? "0 0" : "0 14px" }, { opacity: 1, translate: "0 0" }], {
        duration: reduce ? 160 : 520,
        delay: reduce ? 0 : 420,
        easing: EASE_OUT,
        fill: "backwards",
      }),
    ];
    if (!reduce && inline && from && from.width > 0) {
      animations.push(
        stage.animate([{ transform: delta(from, stage.getBoundingClientRect()) }, { transform: "none" }], { duration: 900, easing: EASE_OUT }),
        stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "linear" }),
      );
      // The page's ring is hidden by its class from now on; it stays on screen just long enough to fade out.
      inline.style.visibility = "visible";
      const out = inline.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "linear", fill: "forwards" });
      out.finished.then(
        () => {
          inline.style.visibility = "";
          out.cancel();
        },
        () => {},
      );
      animations.push(out);
    } else {
      animations.push(stage.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 }));
    }
    return () => {
      animations.forEach((animation) => animation.cancel());
      if (inline) inline.style.visibility = "";
    };
  }, []);

  // Closing (the run ended, was stopped, or X): the reverse. The ring flies back into its place on the
  // page and, over its last stretch, hands over to the page's own ring (a cross-fade, so the thinner
  // scaled stroke never snaps to 8px); then the layer goes.
  useEffect(() => {
    if (active) return;
    const veil = veilRef.current;
    const stage = stageRef.current;
    const controls = controlsRef.current;
    if (!veil || !stage || !controls) return onClosed();
    const reduce = reducedMotion();
    const inline = document.getElementById("focus-ring-inline");
    const to = inline?.getBoundingClientRect();
    const FLIGHT = 760;
    const HANDOVER = 240;
    const animations = [
      controls.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: EASE_IN, fill: "forwards" }),
      ...(closeRef.current ? [closeRef.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" })] : []),
      veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduce ? 160 : 700, easing: EASE_OUT, fill: "forwards" }),
    ];
    if (!reduce && inline && to && to.width > 0) {
      animations.push(
        stage.animate([{ transform: "none" }, { transform: delta(to, stage.getBoundingClientRect()) }], {
          duration: FLIGHT,
          easing: EASE_OUT,
          fill: "forwards",
        }),
        stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: HANDOVER, delay: FLIGHT - HANDOVER, easing: "linear", fill: "forwards" }),
      );
      // Shown ahead of React taking its `invisible` class off (when the layer goes), fading in under the copy.
      inline.style.visibility = "visible";
      animations.push(
        inline.animate([{ opacity: 0 }, { opacity: 1 }], { duration: HANDOVER, delay: FLIGHT - HANDOVER, easing: "linear", fill: "backwards" }),
      );
    } else {
      animations.push(stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" }));
    }
    let done = false;
    Promise.all(animations.map((animation) => animation.finished)).then(
      () => {
        done = true;
        onClosed();
      },
      () => {},
    );
    // Started again before it finished closing: undo the closing.
    return () => {
      if (!done) {
        animations.forEach((animation) => animation.cancel());
        if (inline) inline.style.visibility = "";
      }
    };
  }, [active, onClosed]);

  return createPortal(
    // The darkening covers the window under the title bar (z-40) and under the sidebar (raised to 39 while
    // focus mode is on), so both stay usable; the timer sits over the page's own area.
    <div className="dark fixed inset-0 z-[38] text-foreground" role="region" aria-label="Focus mode">
      {/* Only a tint: the cards are gone, so there is nothing to blur, and fading a full-window blur is costly. */}
      <div ref={veilRef} className="absolute inset-0 bg-[rgb(3_5_20/0.55)]" />

      <div
        className="fixed flex items-center justify-center"
        style={area ?? { inset: 0 }}
      >
        {/* Top right: rain, the mini timer, and the way out (the timer keeps going). */}
        <div ref={closeRef} className="absolute top-[52px] right-4 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRainOn(!rainOn)}
            aria-pressed={rainOn}
            aria-label={rainOn ? "Stop the rain" : "Rain"}
            title={rainOn ? "Stop the rain" : "Rain (sound, and rain on the glass)"}
            className={cn(TOP_BUTTON, "relative", rainOn && "text-sky-accent hover:text-sky-accent")}
          >
            <CloudRain className="size-5" />
            {/* On: a dot under it as well as the colour. */}
            <span
              aria-hidden="true"
              className={cn("absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-sky-accent transition-opacity", rainOn ? "opacity-100" : "opacity-0")}
            />
          </button>
          <button type="button" onClick={() => openMiniTimer()} aria-label="Mini timer" title="Mini timer (stays on top of other apps)" className={TOP_BUTTON}>
            <PictureInPicture2 className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setFocusMode(false)}
            aria-label="Leave focus mode (the timer keeps going)"
            title="Leave focus mode (the timer keeps going)"
            className={TOP_BUTTON}
          >
            <X className="size-5" />
          </button>
        </div>

      <div className="relative flex flex-col items-center gap-[min(5vh,44px)]">
        <div ref={stageRef} className="@container relative grid aspect-square place-items-center" style={{ width: area ? Math.min(area.height * 0.58, area.width * 0.7, 600) : "min(60vh, 56vw, 600px)" }}>
          {/* The hour's light, breathing slowly behind the ring while it runs. */}
          <div
            aria-hidden="true"
            className={cn("absolute inset-[4%] rounded-full transition-opacity duration-700", running ? "focus-breathe" : "opacity-0")}
            style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--sky-accent) 30%, transparent) 0%, transparent 68%)" }}
          />
          {celebrating && timer.celebrate && <CelebrationRings at={timer.celebrate.at} />}
          <Ring progress={progress} running={running} onBreak={!celebrating && timer.phase === "break"} />
          <div className="relative flex flex-col items-center" role="timer" aria-label={celebrating ? "Time is up" : `${formatClock(left)} left`}>
            <Clock ms={left} dimmed={paused} rolling />
            <span className="mt-[3cqw] flex items-center gap-1.5 text-[max(14px,3.2cqw)] text-muted-foreground">
              {celebrating ? "Time's up" : PHASE_LABELS[timer.phase]}
              {paused && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-foreground/85">Paused</span>
                </>
              )}
            </span>
          </div>
        </div>

        <div ref={controlsRef} className={cn("flex h-20 items-center gap-4 transition-opacity duration-300", celebrating && "pointer-events-none opacity-0")}>
          {paused && (
            <button
              type="button"
              onClick={timer.stop}
              aria-label="Stop and reset"
              title="Stop and reset"
              className="fade-in grid size-12 place-items-center rounded-full text-foreground/75 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Square className="size-4" fill="currentColor" />
            </button>
          )}
          <button
            type="button"
            onClick={timer.toggle}
            aria-label={running ? "Pause" : "Resume"}
            title={running ? "Pause" : "Resume"}
            className="grid size-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_10px_28px_-10px_rgb(0_0_0/0.6)] outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
          >
            {running ? <Pause className="size-7" fill="currentColor" /> : <Play className="ml-1 size-7" fill="currentColor" />}
          </button>
          {paused && (
            <button
              type="button"
              onClick={timer.skip}
              aria-label={timer.phase === "break" ? "Skip the break" : "Skip to the break"}
              title={timer.phase === "break" ? "Skip the break" : "Skip to the break"}
              className="fade-in grid size-12 place-items-center rounded-full text-foreground/75 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <SkipForward className="size-[18px]" fill="currentColor" />
            </button>
          )}
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}
