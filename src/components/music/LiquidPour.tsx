import { useEffect, useId, useMemo, useRef } from "react";
import { liquidMarkup } from "@/lib/vinylFinishes";

/**
 * One frame of the liquid's motion, given the record's speed (degrees a second), the frame's length in
 * seconds and the record's angle. Returns true while the liquid is still moving on its own, so the turntable
 * keeps animating until it settles.
 */
export type LiquidMotion = (speed: number, dt: number, angle: number) => boolean;

/** The record's full speed, 33 1/3 rpm in degrees a second. */
const FULL_SPEED = 200;
/** How long the colour takes to catch up with the record's turning, in seconds: its thickness. */
const VISCOSITY = 0.6;
/** How far the current that bends the pools wanders, in the texture's units (the record is 200 across). */
const CURRENT_REACH = 28;
/** How long the current keeps flowing after the record stops, in seconds: the liquid's momentum. */
const MOMENTUM = 2.4;
/**
 * How often the flowing shape is redrawn, a second. It is an SVG filter, costly to redraw, and changes slowly,
 * so it does not need every frame; the turning, slosh and spread are transforms and do run every frame.
 */
const FLOW_FPS = 30;
/** The slosh: a wobble that swings about once a second and dies away over a few swings. */
const SLOSH_STIFFNESS = (2 * Math.PI * 0.9) ** 2;
const SLOSH_DAMPING = 2 * 0.22 * Math.sqrt(SLOSH_STIFFNESS);
/** How hard a change of speed (degrees a second, each second) sets off the slosh. */
const SLOSH_KICK = 0.06;

/**
 * The colour inside a liquid record, drawn live on the turning disc so it moves like the real thing:
 * - it hangs back as the record comes up to speed and runs on as it coasts to a stop (it turns with the
 *   record, but late);
 * - it is flung out toward the rim as the record spins, and drifts back in when it stops;
 * - a change of speed sets it sloshing, a wobble that dies away over a few swings;
 * - while the record turns a current flows through it, so the pools keep moving and changing shape, and the
 *   current runs on for a few seconds after the record stops before the liquid settles.
 * The turntable drives it from its own frame loop through `motion`, so the record and its liquid move in
 * step. When the record stands still (or under reduced motion) the liquid rests.
 *
 * It is coloured glass, like 3D glasses: it sits under the record (not inside it, so it can see what is
 * behind the record) and is blended "hard-light" onto the sleeve and sky, which keeps their detail and turns
 * them the liquid's colour, strongly, rather than laying a faint film over them. Its colour is made richer
 * and pushed apart first (saturate, brighten, contrast), so a red liquid lets through only red, like a
 * filter, and stays red even over a blue sky. It turns with the record
 * by being given the record's angle each frame (`discAngle` places it before the first one).
 */
export function LiquidPour({
  color,
  motion,
  discAngle,
}: {
  color: string;
  motion: React.MutableRefObject<LiquidMotion | null>;
  discAngle: () => number;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  const id = `liquid-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const markup = useMemo(() => liquidMarkup(color, id), [color, id]);

  useEffect(() => {
    const layer = layerRef.current;
    const flow = layer?.querySelector(`#${id}-flow`);
    const warp = layer?.querySelector(`#${id}-warp`);
    const pool = poolRef.current;
    if (!layer || !flow || !warp || !pool) return;
    const state = { own: 0, slip: 0, current: 0, churn: 0, slosh: 0, sloshSpeed: 0, sinceFlow: 0 };
    const shown = { dx: "", dy: "", warp: "" };
    layer.style.rotate = `${discAngle().toFixed(2)}deg`;

    motion.current = (speed, dt, angle) => {
      layer.style.rotate = `${(angle - state.slip).toFixed(2)}deg`;
      if (dt <= 0) return true;
      // The colour's own turning follows the record's, late.
      const before = state.own;
      state.own += (speed - state.own) * (1 - Math.exp(-dt / VISCOSITY));
      if (Math.abs(speed - state.own) < 0.3) state.own = speed;
      state.slip = (state.slip + (speed - state.own) * dt) % 360;

      // Slosh: a damped spring, kicked by the liquid speeding up or slowing down.
      const change = (state.own - before) / dt;
      state.sloshSpeed += (-SLOSH_STIFFNESS * state.slosh - SLOSH_DAMPING * state.sloshSpeed - SLOSH_KICK * change) * dt;
      state.slosh += state.sloshSpeed * dt;

      // The current follows the record's speed but runs on after it stops; one loop about every four and a
      // half seconds at full speed, on an uneven path so it never visibly repeats.
      state.current += (speed - state.current) * (1 - Math.exp(-dt / MOMENTUM));
      if (speed === 0 && state.current < 1) state.current = 0;
      const pace = state.current / FULL_SPEED;
      state.churn += dt * 0.22 * pace;

      // Flung outward with the square of its speed, as a spinning liquid is.
      const spin = (state.own / FULL_SPEED) ** 2;

      // The flowing shape: at most FLOW_FPS times a second, and only when it has visibly changed.
      state.sinceFlow += dt;
      if (state.sinceFlow >= 1 / FLOW_FPS) {
        state.sinceFlow = 0;
        const turn = state.churn * Math.PI * 2;
        const dx = (Math.cos(turn) * CURRENT_REACH + state.slosh * 10).toFixed(1);
        const dy = (Math.sin(turn * 1.37) * CURRENT_REACH - state.slosh * 6).toFixed(1);
        const scale = (14 + 10 * pace + 12 * Math.min(1, Math.abs(state.slosh))).toFixed(1);
        if (dx !== shown.dx || dy !== shown.dy) {
          flow.setAttribute("dx", dx);
          flow.setAttribute("dy", dy);
          shown.dx = dx;
          shown.dy = dy;
        }
        if (scale !== shown.warp) {
          warp.setAttribute("scale", scale);
          shown.warp = scale;
        }
      }
      // Flung out: the pools spread from the centre, up to a sixth further out at full speed (a scale on the
      // layer, so it costs nothing to draw).
      pool.style.scale = (1 + 0.16 * spin + 0.03 * state.slosh).toFixed(4);

      const settling = Math.abs(state.slosh) > 0.005 || Math.abs(state.sloshSpeed) > 0.005;
      if (!settling && speed === state.own) {
        state.slosh = 0;
        state.sloshSpeed = 0;
      }
      return speed !== state.own || state.current > 0 || settling;
    };
    return () => {
      motion.current = null;
    };
  }, [id, motion, markup, discAngle]);

  return (
    // Only the grooved ring is filled: the centre round the label and the rim at the edge are sealed clear, as
    // on a real pressing. Its own layer (will-change), so redrawing the moving liquid each frame leaves the
    // record over it alone.
    <div
      ref={layerRef}
      className="absolute inset-0 overflow-hidden rounded-full mix-blend-hard-light will-change-transform [filter:saturate(1.8)_brightness(1.12)_contrast(1.6)] [mask:radial-gradient(circle_closest-side,transparent_0_50.5%,black_51.5%_96%,transparent_96.5%)]"
      aria-hidden="true"
    >
      <div ref={poolRef} className="size-full">
        <svg viewBox="0 0 200 200" className="size-full" dangerouslySetInnerHTML={{ __html: markup }} />
      </div>
    </div>
  );
}
