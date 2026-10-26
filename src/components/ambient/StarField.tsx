import type { CSSProperties } from "react";

interface Star {
  id: number;
  /** Position as a percentage of the window. */
  x: number;
  y: number;
  size: number;
  color: string;
  /** Four-pointed "glitter" star instead of a round dot. */
  sparkle: boolean;
  twinkleSeconds: number;
  wanderSeconds: number;
  /** Lowest opacity of the twinkle. */
  minOpacity: number;
  /** Three waypoints (px offsets) the star wanders through before returning to where it started. */
  path: [number, number][];
}

/** Stars only fill the top of the window, as a share of its height. */
const SKY_HEIGHT_PERCENT = 40;
const DOT_COUNT = 34;
const SPARKLE_COUNT = 6;
/**
 * Stars keep to the edges so they frame the content instead of sitting in the middle of the page:
 * the left side (sidebar and gutter), the right gutter, and a strip along the top. The block in
 * between is kept clear (stars at its edges can still overlap the content a little).
 */
const CLEAR_LEFT_PERCENT = 26;
const CLEAR_RIGHT_PERCENT = 91;
const CLEAR_TOP_PERCENT = 10;

function inClearZone(x: number, y: number): boolean {
  return x > CLEAR_LEFT_PERCENT && x < CLEAR_RIGHT_PERCENT && y > CLEAR_TOP_PERCENT;
}
/** How far (px) a star may stray from its home position. */
const WANDER_PX = 14;
const COLORS = ["#ffffff", "#ffffff", "#dbe8ff", "#ffeccc"];

/** Small seeded generator, so the stars sit in the same places every time the app opens. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeStars(): Star[] {
  const random = mulberry32(2024);
  const between = (min: number, max: number) => min + random() * (max - min);
  return Array.from({ length: DOT_COUNT + SPARKLE_COUNT }, (_, id) => {
    const sparkle = id >= DOT_COUNT;
    // Redraw until the spot is outside the clear middle block (the seeded generator keeps this stable).
    let x = between(1, 99);
    let y = between(1, SKY_HEIGHT_PERCENT);
    while (inClearZone(x, y)) {
      x = between(1, 99);
      y = between(1, SKY_HEIGHT_PERCENT);
    }
    return {
      id,
      x,
      y,
      size: sparkle ? between(8, 13) : between(2, 4),
      color: COLORS[Math.floor(random() * COLORS.length)] ?? "#ffffff",
      sparkle,
      twinkleSeconds: between(2.4, 6.5),
      wanderSeconds: between(18, 42),
      minOpacity: between(0.2, 0.55),
      path: Array.from({ length: 3 }, (): [number, number] => [between(-WANDER_PX, WANDER_PX), between(-WANDER_PX, WANDER_PX)]),
    };
  });
}

const STARS = makeStars();

// A four-pointed star outline for the larger sparkles.
const SPARKLE_SHAPE = "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)";

interface StarFieldProps {
  /** 0-1, from starsAt(); nothing is rendered (and nothing animates) while it is 0. */
  visibility: number;
}

/** Twinkling night stars that each wander a little along their own path. Dark theme only; the glow layer fades them in and out. */
export function StarField({ visibility }: StarFieldProps) {
  if (visibility <= 0.001) return null;

  return (
    <div
      className="absolute inset-0 hidden dark:block"
      style={{ opacity: visibility, transition: "opacity 500ms linear" }}
    >
      {STARS.map((star) => {
        const style = {
          left: `${star.x}%`,
          top: `${star.y}%`,
          width: star.size,
          height: star.size,
          "--star-min": star.minOpacity,
          "--x1": `${star.path[0]?.[0] ?? 0}px`,
          "--y1": `${star.path[0]?.[1] ?? 0}px`,
          "--x2": `${star.path[1]?.[0] ?? 0}px`,
          "--y2": `${star.path[1]?.[1] ?? 0}px`,
          "--x3": `${star.path[2]?.[0] ?? 0}px`,
          "--y3": `${star.path[2]?.[1] ?? 0}px`,
          // Negative delays start every star part-way through its cycle so they never move or pulse in unison.
          animation: `star-twinkle ${star.twinkleSeconds}s ease-in-out ${-star.id * 0.37}s infinite, star-wander ${star.wanderSeconds}s ease-in-out ${-star.id * 1.3}s infinite`,
        } as CSSProperties;

        return star.sparkle ? (
          <div
            key={star.id}
            className="star absolute"
            style={{ ...style, filter: `drop-shadow(0 0 4px ${star.color})` }}
          >
            <div className="size-full" style={{ backgroundColor: star.color, clipPath: SPARKLE_SHAPE }} />
          </div>
        ) : (
          <div
            key={star.id}
            className="star absolute rounded-full"
            style={{ ...style, backgroundColor: star.color, boxShadow: `0 0 ${star.size * 2.5}px ${star.color}` }}
          />
        );
      })}
    </div>
  );
}
