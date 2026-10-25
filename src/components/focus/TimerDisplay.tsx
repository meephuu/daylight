import { useRemainingMs } from "@/hooks/useTimerDisplay";
import { formatClock, PHASE_LABELS, useFocusTimer, type TimerPhase } from "@/lib/focusTimer";

const RADIUS = 110;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Focus uses the chart blue; breaks use the palette's aqua so the phase reads at a glance. */
const PHASE_COLOR: Record<TimerPhase, string> = {
  focus: "var(--viz-bar)",
  shortBreak: "#1baf7a",
  longBreak: "#1baf7a",
};

export function TimerDisplay() {
  const phase = useFocusTimer((state) => state.phase);
  const status = useFocusTimer((state) => state.status);
  const totalMs = useFocusTimer((state) => state.totalMs);
  const remainingMs = useRemainingMs();

  const progress = totalMs === 0 ? 0 : 1 - remainingMs / totalMs;

  return (
    <div className="relative mx-auto size-72">
      <svg viewBox="0 0 256 256" className="size-full -rotate-90" aria-hidden="true">
        <circle
          cx="128"
          cy="128"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          stroke="color-mix(in srgb, var(--foreground) 10%, transparent)"
        />
        <circle
          cx="128"
          cy="128"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke={PHASE_COLOR[phase]}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-medium text-muted-foreground">{PHASE_LABELS[phase]}</span>
        <span
          className="text-6xl font-semibold tabular-nums"
          role="timer"
          aria-label={`${PHASE_LABELS[phase]}, ${formatClock(remainingMs)} remaining`}
        >
          {formatClock(remainingMs)}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">
          {status === "running" ? "Running" : status === "paused" ? "Paused" : "Ready"}
        </span>
      </div>
    </div>
  );
}
