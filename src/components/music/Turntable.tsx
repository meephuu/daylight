import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Music2 } from "lucide-react";
import { LiquidPour, type LiquidMotion } from "@/components/music/LiquidPour";
import { formatTrackTime, inkOn } from "@/lib/nowPlaying";
import { useRecordStyle, vinylLook, type LabelStyle } from "@/lib/recordStyle";
import { cn } from "@/lib/utils";

interface TurntableProps {
  title: string | null;
  artist: string | null;
  album?: string | null;
  art: string | null;
  /** The cover's colour: the record's label is printed in it. */
  color: string | null;
  playing: boolean;
  /** 0..1 through the song: the stylus moves in from the edge as the song plays. */
  progress: number;
  /** The song's length, for the time shown while the needle is moved. */
  durationMs: number | null;
  /**
   * The needle was put down by hand: a point 0..1 in the song to play from, or null when it was lifted
   * back to its rest (pause). Absent when there is nothing to play.
   */
  onNeedle?: (progress: number | null) => void;
  /** A small control tucked under the arm's plinth (the record style button). */
  accessory?: React.ReactNode;
}

/*
 * Geometry, in % of the stage's width (cqw), shared by the record, the arm (an SVG whose viewBox is the
 * same 0..100 square) and the cover. The record: centre (52, 50), radius 44. The arm pivots at (14, 4);
 * at 0deg its stylus sits on the outer groove, at REST_DEG it is lifted clear of the record, and through
 * a song it swings in by up to SWEEP_DEG, stopping just short of the label.
 */
const PIVOT = { x: 14, y: 4 };
const REST_DEG = -14;
const SWEEP_DEG = 19;
/** The arm is drawn along the x axis and turned this much to point at the outer groove. */
const ARM_BASE_DEG = 12.8;
/** The stylus tip, in the arm's own drawing (the headshell is turned 22deg about (60, 0)). */
const TIP = { x: 60 + 9 * Math.cos((22 * Math.PI) / 180), y: 9 * Math.sin((22 * Math.PI) / 180) };
/** Let go of the arm left of this and it goes back to its rest (pause); right of it, it plays. */
const LIFT_DEG = -5;

/** 33 1/3 rpm, in degrees a second. */
const SPIN_DEG_PER_S = 200;

const isReducedMotion = () => document.documentElement.dataset.motion === "reduce";

/**
 * Turns the record like a real platter: it takes a moment to come up to speed when a song starts and
 * coasts to a stop when it pauses, instead of jumping between still and spinning. Under reduced motion
 * it stands still. A liquid record's colour moves in the same frames (`liquid`), and keeps the loop running
 * until it has settled.
 */
function useSpin(playing: boolean, liquid: React.RefObject<LiquidMotion | null>) {
  const discRef = useRef<HTMLDivElement>(null);
  const state = useRef({ angle: 0, speed: 0, frame: 0, last: 0, playing });
  state.current.playing = playing;

  useEffect(() => {
    const s = state.current;
    if (s.frame) return;
    const step = (time: number) => {
      const dt = s.last ? Math.min(0.05, (time - s.last) / 1000) : 0;
      s.last = time;
      const target = s.playing && !isReducedMotion() ? SPIN_DEG_PER_S : 0;
      // Up to speed in about a second; a slower coast down.
      const tau = target > s.speed ? 0.32 : 0.55;
      s.speed += (target - s.speed) * (1 - Math.exp(-dt / tau));
      if (target === 0 && s.speed < 1) s.speed = 0;
      s.angle = (s.angle + s.speed * dt) % 360;
      if (discRef.current) discRef.current.style.rotate = `${s.angle}deg`;
      const flowing = liquid.current?.(s.speed, dt, s.angle) ?? false;
      if (s.speed === 0 && !s.playing && !flowing) {
        s.frame = 0;
        s.last = 0;
        return;
      }
      s.frame = requestAnimationFrame(step);
    };
    s.frame = requestAnimationFrame(step);
  }, [playing, liquid]);

  // Stopping marks the loop as stopped, so it starts again on the next mount (React runs effects twice in
  // development; without the reset the record would never turn after that).
  useEffect(() => {
    const s = state.current;
    return () => {
      cancelAnimationFrame(s.frame);
      s.frame = 0;
      s.last = 0;
    };
  }, []);
  return [discRef, state] as const;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface Sleeve {
  id: number;
  art: string | null;
  color: string | null;
  /** "in" while sliding in, "out" while sliding away, "still" once settled. */
  phase: "in" | "out" | "still";
}

let nextSleeveId = 1;

/**
 * The sleeves on the stage: normally one; for a moment after the song changes, the old one leaving and
 * the new one arriving. Only a new song (title and artist) swaps sleeves; a cover or colour that arrives
 * a moment later for the same song just fills in the sleeve already there.
 */
function useSleeves(title: string | null, artist: string | null, art: string | null, color: string | null) {
  const song = `${title ?? ""}\u0000${artist ?? ""}`;
  const [sleeves, setSleeves] = useState<Sleeve[]>(() => [{ id: 0, art, color, phase: "still" }]);
  const shownSong = useRef(song);

  useEffect(() => {
    if (shownSong.current === song) {
      setSleeves((list) => list.map((item) => (item.phase === "out" ? item : { ...item, art, color })));
      return;
    }
    shownSong.current = song;
    setSleeves((list) => [
      // Anything already on its way out keeps going; the one on the stage starts leaving.
      ...list.map((item) => ({ ...item, phase: "out" as const })),
      { id: nextSleeveId++, art, color, phase: "in" },
    ]);
  }, [song, art, color]);

  return [sleeves, setSleeves] as const;
}

/** Bar widths for the little barcode on the label (decoration, not a real code). */
const BARS = [0.9, 0.35, 0.35, 1.2, 0.35, 0.8, 0.35, 0.35, 1.2, 0.6, 0.35, 0.9, 0.35, 0.35, 1, 0.35];

/**
 * The record's label, printed in the cover's colour like a real pressing: a thin rim just inside its
 * edge, small type running round the rim (album, speed, where it was pressed), a little barcode, the
 * song set large on a diagonal with the artist in spaced capitals under it, and a silver spindle in the
 * middle. Ink is dark or light, whichever reads on the colour.
 */
function RecordLabel({
  title,
  artist,
  album,
  color,
  art,
  labelStyle,
}: {
  title: string | null;
  artist: string | null;
  album: string | null;
  color: string | null;
  art: string | null;
  labelStyle: LabelStyle;
}) {
  // The paper: the cover's colour, the cover itself (darkened a little so the type reads), plain black or
  // plain white.
  const style = labelStyle === "art" && !art ? "cover" : labelStyle;
  const paper = style === "black" ? "#16171b" : style === "white" ? "#f2efe8" : (color ?? "var(--muted)");
  const ink =
    style === "black"
      ? "#e6e2da"
      : style === "white"
        ? "#1a1b20"
        : style === "art"
          ? "#f6f7fb"
          : inkOn(color) === "dark"
            ? "#14161f"
            : "#f6f7fb";
  const id = useId().replace(/:/g, "");
  const ring = `label-ring-${id}`;
  const ringFromBottom = `label-ring-b-${id}`;
  const spindle = `label-spindle-${id}`;
  // Round the rim, clockwise. Each line is centred on its side: on the ring that starts at the far left,
  // 25% is the top, 50% the right and 75% the bottom; the left side is 25% of the ring that starts at the
  // bottom (centring a line on a ring's starting point would split it in two).
  const arc = (text: string, offset: string, path = ring) => (
    <text fontSize={3.5} letterSpacing={0.25} fill="currentColor" fillOpacity={0.62} fontFamily="'Instrument Serif', serif">
      <textPath href={`#${path}`} startOffset={offset} textAnchor="middle">
        {text}
      </textPath>
    </text>
  );
  let x = 0;

  return (
    <div
      className="absolute inset-[28.5%] overflow-hidden rounded-full shadow-[inset_0_0_0_0.4cqw_rgb(0_0_0/0.14)] transition-[background-color] duration-700"
      style={{ backgroundColor: paper, color: ink }}
    >
      {style === "art" && art && (
        <>
          <img src={art} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
          <span className="absolute inset-0 bg-black/40" aria-hidden="true" />
        </>
      )}
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <path id={ring} d="M 9.5 50 A 40.5 40.5 0 1 1 90.5 50 A 40.5 40.5 0 1 1 9.5 50" fill="none" />
          <path id={ringFromBottom} d="M 50 90.5 A 40.5 40.5 0 1 1 50 9.5 A 40.5 40.5 0 1 1 50 90.5" fill="none" />
          <radialGradient id={spindle} cx="0.38" cy="0.35" r="0.75">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#c9ccd4" />
            <stop offset="1" stopColor="#7d818c" />
          </radialGradient>
        </defs>
        {/* The rim. */}
        <circle cx={50} cy={50} r={46.5} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeWidth={0.7} />
        {/* Turned with the title (50deg), so "above" the title is the album, and so on round. */}
        <g transform="rotate(50 50 50)">
          {arc(album || "Daylight", "25%")}
          {arc("33 1/3 RPM · Stereo", "50%")}
          {arc("Pressed by Daylight, Bangkok", "75%")}
          {arc("Side A", "25%", ringFromBottom)}
        </g>
        {/* A small barcode, centred under the artist (turned with the title), clear of the rim text. */}
        <g transform="rotate(50 50 50) translate(41.2 70)" fill="currentColor" fillOpacity={0.6}>
          {BARS.map((width, index) => {
            const bar = <rect key={index} x={x} y={0} width={width} height={5.5} />;
            x += width + 0.45;
            return bar;
          })}
          <text x={0} y={-1.4} fontSize={2.4} letterSpacing={0.5} fontWeight={600}>
            DAYLIGHT
          </text>
        </g>
        {/* The spindle, with the faint ring the platter's centre leaves on the paper. */}
        <circle cx={50} cy={50} r={8} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={0.5} />
        <circle cx={50} cy={50} r={2.6} fill={`url(#${spindle})`} stroke="rgb(0 0 0 / 0.45)" strokeWidth={0.35} />
      </svg>

      {/* The song on a diagonal: the title above the spindle, the artist below it. */}
      <div className="absolute inset-[17%] flex rotate-[50deg] flex-col items-center text-center">
        <div className="flex flex-1 items-end justify-center pb-[9%]">
          <p
            className="line-clamp-2 font-display text-[clamp(12px,3.6cqw,26px)] leading-[1.05] font-semibold tracking-[-0.01em]"
            title={title ?? undefined}
          >
            {title ?? "Nothing playing"}
          </p>
        </div>
        <div className="flex flex-1 items-start justify-center pt-[9%]">
          <p className="line-clamp-2 text-[clamp(8px,1.9cqw,14px)] leading-tight font-medium tracking-[0.14em] uppercase opacity-85">
            {artist ?? "Spotify"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function Turntable({
  title,
  artist,
  album = null,
  art,
  color,
  playing,
  progress,
  durationMs,
  onNeedle,
  accessory,
}: TurntableProps) {
  const liquidMotion = useRef<LiquidMotion | null>(null);
  const [discRef, spin] = useSpin(playing, liquidMotion);
  const discAngle = useCallback(() => spin.current.angle, [spin]);
  const svgRef = useRef<SVGSVGElement>(null);
  // Where the arm is while it is being moved by hand.
  const [dragDeg, setDragDeg] = useState<number | null>(null);
  const [sleeves, setSleeves] = useSleeves(title, artist, art, color);
  const recordStyle = useRecordStyle();
  const look = vinylLook(recordStyle, color);

  // Paused or stopped, the arm rests off the record; playing, it sits on the groove for this point in the song.
  const armDeg = dragDeg ?? (playing ? clamp(progress, 0, 1) * SWEEP_DEG : REST_DEG);
  const lifted = dragDeg !== null || !playing;

  const degAt = (event: React.PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 100;
    const y = ((event.clientY - box.top) / box.width) * 100;
    const deg = (Math.atan2(y - PIVOT.y, x - PIVOT.x) * 180) / Math.PI - ARM_BASE_DEG;
    return clamp(deg, REST_DEG - 4, SWEEP_DEG + 1);
  };

  // While the needle is over the record, the time it would play from.
  const overRecord = dragDeg !== null && dragDeg > LIFT_DEG;
  const dragProgress = dragDeg !== null ? clamp(dragDeg / SWEEP_DEG, 0, 0.98) : 0;
  const tip = (() => {
    const turn = ((armDeg + ARM_BASE_DEG) * Math.PI) / 180;
    return {
      x: PIVOT.x + TIP.x * Math.cos(turn) - TIP.y * Math.sin(turn),
      y: PIVOT.y + TIP.x * Math.sin(turn) + TIP.y * Math.cos(turn),
    };
  })();

  return (
    // The width keeps the stage and the sleeve hanging under it (to 150cqw) inside the window's height. The stage
    // starts level with the page title on the right (the arm's plinth is the top of the drawing).
    <div className="mx-auto w-[min(100%,calc((100vh-90px)/1.52),620px)] [container-type:inline-size]">
      <div className="relative mt-[calc(14px+1.4cqw)] h-[116cqw]">
        {/*
          The sleeve, tilted a little, behind the record. When the song changes, the old sleeve slides away to
          the left and the new one comes in from the lower right and settles under the record.
        */}
        {sleeves.map((sleeve) => (
          <div
            key={sleeve.id}
            className={cn(
              "absolute top-[68cqw] left-[3cqw] size-[82cqw] -rotate-2 overflow-hidden rounded-[6px] bg-foreground/10 shadow-[0_30px_60px_-24px_rgb(0_0_0/0.7),0_8px_20px_-10px_rgb(0_0_0/0.45)]",
              sleeve.phase === "out" && "sleeve-out",
              sleeve.phase === "in" && "sleeve-in",
            )}
            onAnimationEnd={(event) => {
              if (event.target !== event.currentTarget) return;
              setSleeves((list) =>
                sleeve.phase === "out"
                  ? list.filter((item) => item.id !== sleeve.id)
                  : list.map((item) => (item.id === sleeve.id ? { ...item, phase: "still" } : item)),
              );
            }}
          >
            {sleeve.art ? (
              <img src={sleeve.art} alt="" className="size-full object-cover" draggable={false} />
            ) : (
              <div className="grid size-full place-items-center" style={{ backgroundColor: sleeve.color ?? undefined }}>
                <Music2 className="size-[14cqw] text-foreground/35" aria-hidden="true" />
              </div>
            )}
          </div>
        ))}

        {/* The record. It turns with the platter (see useSpin); the light on it stays still. */}
        <div className={cn("vinyl-shadow absolute top-[6cqw] left-[8cqw] size-[88cqw]", look.liquid && "vinyl-shadow-glass")}>
          {/* A liquid record's colour: a live layer under the glass disc, turning with it (see LiquidPour). */}
          {look.liquid && <LiquidPour color={look.liquid.color} motion={liquidMotion} discAngle={discAngle} />}
          <div
            ref={discRef}
            className="vinyl absolute inset-0"
            style={
              {
                // A liquid record is glass, with its colour under it.
                "--vinyl-fill": look.liquid ? look.liquid.glass : look.fill,
                "--vinyl-rim": look.rim,
                "--groove-dark": look.grooveDark,
                "--groove-light": look.grooveLight,
              } as React.CSSProperties
            }
          >
            {/* The run-out: a smooth band of lacquer between the last groove and the label. */}
            <div
              className="absolute inset-[25.5%] rounded-full shadow-[inset_0_0_0_0.25cqw_rgb(255_255_255/0.05),0_0_0_0.3cqw_rgb(0_0_0/0.35)] transition-[background-color] duration-500"
              style={{ backgroundColor: look.runout }}
            />
            <RecordLabel title={title} artist={artist} album={album} color={color} art={art} labelStyle={recordStyle.label} />
          </div>
          <div
            className="vinyl-sheen pointer-events-none absolute inset-0"
            style={{ "--sheen": look.sheen } as React.CSSProperties}
            aria-hidden="true"
          />
        </div>

        {/*
          The tonearm: lifted off the record at rest, lowered onto it and drifting inward while a song plays.
          It can be moved by hand: put the needle on the record to play from that point, take it back to its
          rest to pause. (The play controls below do the same from the keyboard.)
        */}
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          className="pointer-events-none absolute top-0 left-0 size-[100cqw] overflow-visible transition-[filter] duration-[1200ms]"
          // The shadow tightens as the arm is lowered onto the record.
          style={{ filter: lifted ? "drop-shadow(0 10px 7px rgb(0 0 0 / 0.4))" : "drop-shadow(0 4px 3px rgb(0 0 0 / 0.5))" }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="arm-tube" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fbfcff" />
              <stop offset="1" stopColor="#9ea3b0" />
            </linearGradient>
            <radialGradient id="arm-base" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#3a3c46" />
              <stop offset="1" stopColor="#121318" />
            </radialGradient>
          </defs>
          {/* The plinth under the pivot does not move. */}
          <circle cx={PIVOT.x} cy={PIVOT.y} r={5.4} fill="url(#arm-base)" stroke="rgb(255 255 255 / 0.12)" strokeWidth={0.3} />
          <g
            className={
              dragDeg === null
                ? "transition-transform duration-[1200ms] ease-[cubic-bezier(0.45,0,0.2,1)] motion-reduce:transition-none"
                : undefined
            }
            style={{
              transform: `rotate(${armDeg}deg)`,
              transformOrigin: `${PIVOT.x}px ${PIVOT.y}px`,
              transformBox: "view-box",
            }}
          >
            {/* Drawn along the x axis from the pivot, then turned to point at the record's outer groove. */}
            <g transform={`translate(${PIVOT.x} ${PIVOT.y}) rotate(${ARM_BASE_DEG})`}>
              <rect
                x={-12}
                y={-3}
                width={7.5}
                height={6}
                rx={1.2}
                fill="#17181e"
                stroke="rgb(255 255 255 / 0.14)"
                strokeWidth={0.3}
              />
              <rect x={-4.5} y={-0.85} width={65} height={1.7} rx={0.85} fill="url(#arm-tube)" />
              <g transform="rotate(22 60 0)">
                <rect
                  x={59}
                  y={-2.3}
                  width={10}
                  height={4.6}
                  rx={0.9}
                  fill="#17181e"
                  stroke="rgb(255 255 255 / 0.14)"
                  strokeWidth={0.3}
                />
                {/* Finger lift. */}
                <line x1={63} y1={-2.3} x2={65} y2={-5} stroke="#c8ccd6" strokeWidth={0.7} strokeLinecap="round" />
              </g>
              <circle cx={0} cy={0} r={2.6} fill="#d9dce4" stroke="rgb(0 0 0 / 0.35)" strokeWidth={0.3} />
              {/* What you grab: the whole arm, a little wider than it looks. */}
              {onNeedle && (
                <rect
                  x={4}
                  y={-4}
                  width={68}
                  height={10}
                  fill="transparent"
                  style={{ pointerEvents: "all", cursor: dragDeg === null ? "grab" : "grabbing", touchAction: "none" }}
                  onPointerDown={(event) => {
                    try {
                      event.currentTarget.setPointerCapture(event.pointerId);
                    } catch {
                      // Without capture the drag still works while the pointer stays on the arm.
                    }
                    setDragDeg(degAt(event));
                  }}
                  onPointerMove={(event) => {
                    if (dragDeg !== null) setDragDeg(degAt(event));
                  }}
                  onPointerUp={(event) => {
                    if (dragDeg === null) return;
                    const deg = degAt(event);
                    setDragDeg(null);
                    // Never quite the end: dropping on the label would otherwise skip straight to the next song.
                    onNeedle(deg <= LIFT_DEG ? null : clamp(deg / SWEEP_DEG, 0, 0.98));
                  }}
                  onPointerCancel={() => setDragDeg(null)}
                >
                  <title>Move the needle: onto the record to play from there, back to its rest to pause</title>
                </rect>
              )}
            </g>
          </g>
        </svg>

        {/* Under the arm's plinth, at the stage's left edge, clear of the arm wherever it swings. */}
        {accessory && <div className="absolute top-[calc(13cqw-18px)] left-0 z-20">{accessory}</div>}

        {/* While the needle is moved over the record: the point in the song it will play from. */}
        {overRecord && durationMs && (
          <span
            className="glass-strong pointer-events-none absolute z-10 -translate-x-1/2 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums"
            style={{ left: `${tip.x}cqw`, top: `calc(${tip.y}cqw + 14px)` }}
          >
            {formatTrackTime(dragProgress * durationMs)}
          </span>
        )}
      </div>
    </div>
  );
}
