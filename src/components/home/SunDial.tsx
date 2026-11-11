import { useMemo } from "react";
import { useAmbientMinutes } from "@/lib/ambient";
import { formatClock, skyAt, sunTimes } from "@/lib/sky";

const W = 300;
const H = 132;
const CX = W / 2;
const BASE = 112;
const RX = 128;
const RY = 92;

/**
 * Home's signature: the sun's actual path over Bangkok today, from sunrise to sunset, with the sun
 * where it is right now. The travelled part of the arc is lit in the colour of the hour. After dark
 * the arc rests and the next sunrise is named instead.
 */
export function SunDial() {
  const minutes = useAmbientMinutes();
  const sun = useMemo(() => sunTimes(), []);
  const phase = skyAt(minutes, true, sun).phase;

  const raw = (minutes - sun.sunrise) / (sun.sunset - sun.sunrise);
  const up = raw >= 0 && raw <= 1;
  const f = Math.min(1, Math.max(0, raw));
  const angle = Math.PI * f;
  const x = CX - RX * Math.cos(angle);
  const y = BASE - RY * Math.sin(angle);

  const arc = `M ${CX - RX} ${BASE} A ${RX} ${RY} 0 0 1 ${CX + RX} ${BASE}`;
  const travelled = `M ${CX - RX} ${BASE} A ${RX} ${RY} 0 0 1 ${x} ${y}`;

  return (
    <figure className="flex w-full flex-col items-end gap-1" aria-label={`Sun: ${phase}. Sunrise ${formatClock(sun.sunrise)}, sunset ${formatClock(sun.sunset)}.`}>
      <div className="flex items-baseline gap-3">
        <span className="display-num text-[clamp(40px,4.6vw,64px)] tabular-nums">{formatClock(minutes)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="-mt-2 h-auto w-full overflow-visible" aria-hidden="true">
        <path d={arc} fill="none" stroke="currentColor" strokeOpacity={0.28} strokeWidth={1.5} strokeDasharray="2 6" strokeLinecap="round" />
        {up && f > 0.002 && (
          <path d={travelled} fill="none" stroke="var(--sky-accent)" strokeWidth={2.5} strokeLinecap="round" />
        )}
        <line x1={8} x2={W - 8} y1={BASE} y2={BASE} stroke="currentColor" strokeOpacity={0.22} strokeWidth={1} />
        {up ? (
          <>
            <circle cx={x} cy={y} r={20} fill="var(--sky-glow)" opacity={0.35} />
            <circle cx={x} cy={y} r={9} fill="#fff6dc" stroke="var(--sky-accent)" strokeWidth={2} />
          </>
        ) : (
          <circle cx={CX} cy={BASE - RY - 6} r={7} fill="none" stroke="currentColor" strokeOpacity={0.6} strokeWidth={1.5} />
        )}
        <text x={CX - RX} y={BASE + 18} textAnchor="middle" className="fill-current text-[11px] opacity-70">
          {formatClock(sun.sunrise)}
        </text>
        <text x={CX + RX} y={BASE + 18} textAnchor="middle" className="fill-current text-[11px] opacity-70">
          {formatClock(sun.sunset)}
        </text>
      </svg>
      <figcaption className="text-sm font-medium text-foreground/80">{phase}</figcaption>
    </figure>
  );
}
