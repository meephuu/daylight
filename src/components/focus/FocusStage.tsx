import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { CircleCheck, Maximize2, Minus, PictureInPicture2, Pause, Play, Plus, SkipForward, Square, X } from "lucide-react";
import { Segmented } from "@/components/Segmented";
import { useSaveSettings } from "@/hooks/useSettings";
import { useSetTaskStatus } from "@/hooks/useTasks";
import { bangkokDateTime } from "@/lib/bangkok";
import { openMiniTimer } from "@/lib/miniTimer";
import {
  clockParts,
  FOCUS_SETTING_KEYS,
  formatClock,
  isCelebrating,
  isUnderway,
  LENGTH_PRESETS,
  PHASE_LABELS,
  remainingAt,
  useFocusTimer,
  type FocusPhase,
  type FocusTask,
} from "@/lib/focus";
import { cn } from "@/lib/utils";

const ROUND_BUTTON =
  "grid size-11 shrink-0 place-items-center rounded-full text-foreground/75 outline-none transition-[color,background-color,scale] duration-150 hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 disabled:pointer-events-none disabled:opacity-30";

/** Re-renders a few times a second while `on`, so the clock never shows a stale second. */
export function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!on) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [on]);
  return now;
}

/**
 * The ring that drains as the run goes: the hour's sky accent for focus, the same light at half strength
 * for a break (the label under the time says which, so it is never colour alone). While it runs the stroke
 * moves linearly second by second; when a run ends or is reset it closes back with the app's ease-out.
 */
export function Ring({ progress, running, onBreak }: { progress: number; running: boolean; onBreak: boolean }) {
  // Drawn in real pixels (the box is measured), so the stroke is 8px at any size: the same as the
  // Expenses page's budget meter (h-2).
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState(340);
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const measure = () => setSize(svg.getBoundingClientRect().width || 340);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const stroke = 8;
  const center = size / 2;
  const radius = center - stroke / 2;
  return (
    <svg ref={ref} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
      <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={stroke} className="stroke-foreground/[0.09]" />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1 - progress}
        className={cn(
          "stroke-sky-accent motion-reduce:transition-none",
          onBreak && "opacity-50",
          running
            ? "transition-[stroke-dashoffset] duration-1000 ease-linear"
            : "transition-[stroke-dashoffset,opacity] duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        )}
      />
    </svg>
  );
}

/**
 * A focus run just ran out: two rings of the sky accent swell out of the ring and fade, and a soft light
 * blooms behind the clock, once. Keyed by the moment it ended, so each run gets its own. Used by the page's
 * ring and by focus mode's big ring (whichever was showing). Breaks end quietly.
 */
export function CelebrationRings({ at }: { at: number }) {
  return (
    <div key={at} className="pointer-events-none absolute inset-0" aria-hidden="true">
      <span className="focus-done-glow absolute inset-[-8%] rounded-full" />
      <span className="focus-done-ring absolute inset-0 rounded-full border-4 border-sky-accent" />
      <span className="focus-done-ring absolute inset-0 rounded-full border-[3px] border-sky-accent [animation-delay:260ms]" />
    </div>
  );
}

/** The page's celebration: only when focus mode was not open (it celebrates there), and not replayed later. */
function Celebration() {
  const celebrate = useFocusTimer((state) => state.celebrate);
  const [shownAt] = useState(() => Date.now());
  if (!celebrate || celebrate.inFocusMode || !isCelebrating(celebrate, shownAt)) return null;
  return <CelebrationRings at={celebrate.at} />;
}

/** After a focus session for a task runs out: is the task done? */
function FinishedPrompt({ task }: { task: FocusTask }) {
  const dismiss = useFocusTimer((state) => state.dismissFinished);
  const setTask = useFocusTimer((state) => state.setTask);
  const setStatus = useSetTaskStatus();
  return (
    <div className="fade-in glass-well flex w-full max-w-[460px] flex-wrap items-center gap-x-3 gap-y-2 rounded-[16px] px-4 py-3 shadow-[inset_0_0_0_1px_var(--glass-rim)]">
      <CircleCheck className="size-[18px] shrink-0 text-success" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm">
        Session done. Is <span className="font-medium">{task.title}</span> finished?
      </p>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => {
            setStatus.mutate({ id: task.id, status: "done" });
            setTask(null);
            dismiss();
          }}
          className="h-8 rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] outline-none transition-transform hover:scale-[1.03] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
        >
          Mark done
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="h-8 rounded-full px-3 text-[13px] font-medium text-foreground/75 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Not yet
        </button>
      </div>
    </div>
  );
}

/** The lengths to choose from before a run starts; a length set with - / + shows as its own option. */
function LengthPicker({ phase, minutes }: { phase: FocusPhase; minutes: number }) {
  const setLength = useFocusTimer((state) => state.setLength);
  const save = useSaveSettings();
  const presets = LENGTH_PRESETS[phase];
  const values = presets.includes(minutes) ? presets : [...presets, minutes].sort((a, b) => a - b);
  return (
    <Segmented
      aria-label={phase === "focus" ? "Focus length" : "Break length"}
      size="sm"
      options={values.map((value) => ({ value: String(value), label: `${value} min` }))}
      value={String(minutes)}
      onChange={(value) => {
        setLength(Number(value));
        // Remembered as the usual length, so the next run starts from it too.
        save.mutate({ [FOCUS_SETTING_KEYS[phase === "focus" ? "focusMin" : "breakMin"]]: value });
      }}
    />
  );
}

/**
 * The clock, set like the Home page's clock (SunDial): the display face's numerals (`display-num`) with
 * tabular figures, so the digits never jump as they change. Sized to the ring around it (container
 * units: the ring's box is an @container). With `rolling`, each digit that changes rolls into place.
 */
export function Clock({ ms, dimmed, rolling = false }: { ms: number; dimmed: boolean; rolling?: boolean }) {
  const { hours, minutes, seconds } = clockParts(ms);
  const text = hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
  return (
    <span
      className={cn(
        "display-num whitespace-nowrap tabular-nums transition-colors duration-300",
        hours > 0 ? "text-[19cqw]" : "text-[27cqw]",
        dimmed && "text-foreground/55",
      )}
      aria-hidden="true"
    >
      {rolling
        ? // Keyed by place and value: a digit that changes is a new element, so it plays its roll-in.
          [...text].map((char, index) => (
            <span key={`${text.length - index}-${char}`} className={char === ":" ? undefined : "digit-in"}>
              {char}
            </span>
          ))
        : text}
    </span>
  );
}

/** "14:35", the Bangkok time a run ends. */
function endTime(endsAt: number): string {
  return bangkokDateTime(new Date(endsAt)).slice(11, 16);
}

/**
 * The timer: the task it is for, the time left inside a ring that drains, the length to choose before
 * it starts (when it ends, once it has), and the controls.
 */
export function FocusStage({
  projectColors,
  onPickTask,
  hideRing = false,
  onEnterFocusMode,
}: {
  projectColors: Map<number, string>;
  onPickTask: () => void;
  hideRing?: boolean;
  onEnterFocusMode: () => void;
}) {
  const timer = useFocusTimer();
  const running = timer.status === "running";
  const now = useNow(running);
  const left = remainingAt(timer, now);
  const progress = timer.durationMs > 0 ? left / timer.durationMs : 0;
  const onBreak = timer.phase === "break";
  const underway = isUnderway(timer);
  const taskColor = timer.task?.projectId != null ? projectColors.get(timer.task.projectId) : undefined;

  return (
    <section
      className="pane relative flex min-h-[560px] flex-col items-center justify-between gap-6 px-6 pt-6 pb-7"
      aria-label="Focus timer"
      data-away="fade"
      style={{ "--i": 1 } as CSSProperties}
    >
      {/* The mini timer: a small window on top of other apps. */}
      <button
        type="button"
        onClick={() => openMiniTimer()}
        aria-label="Mini timer"
        title="Mini timer (stays on top of other apps)"
        className="absolute top-5 left-5 grid size-9 place-items-center rounded-full text-foreground/70 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PictureInPicture2 className="size-4" />
      </button>
      {/* Back into focus mode, after leaving it with its X while the run goes on. */}
      {underway && !hideRing && (
        <button
          type="button"
          onClick={onEnterFocusMode}
          aria-label="Focus mode"
          title="Focus mode"
          className="fade-in absolute top-5 right-5 grid size-9 place-items-center rounded-full text-foreground/70 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Maximize2 className="size-4" />
        </button>
      )}
      {/* What this run is for. */}
      <div className="flex max-w-full items-center gap-1">
        <button
          type="button"
          onClick={onPickTask}
          className="glass-well flex h-9 max-w-[420px] min-w-0 items-center gap-2.5 rounded-full px-4 text-sm shadow-[inset_0_0_0_1px_var(--glass-rim)] outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          title={timer.task ? timer.task.title : "Pick a task from the list"}
        >
          <span
            className={cn("size-2 shrink-0 rounded-full", !taskColor && "bg-foreground/30")}
            style={taskColor ? { backgroundColor: taskColor } : undefined}
            aria-hidden="true"
          />
          {timer.task ? (
            <span className="truncate font-medium">{timer.task.title}</span>
          ) : (
            <span className="text-muted-foreground">{onBreak ? "Resting" : "No task picked"}</span>
          )}
        </button>
        {timer.task && (
          <button
            type="button"
            onClick={() => timer.setTask(null)}
            className="grid size-8 place-items-center rounded-full text-foreground/55 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Clear the task"
            title="Clear the task"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* The clock in its ring. Hidden while focus mode shows it full screen (it grows out of this spot). */}
      <div
        id="focus-ring-inline"
        className={cn("@container relative grid aspect-square w-full max-w-[340px] place-items-center", hideRing && "invisible")}
      >
        <Celebration />
        <Ring progress={progress} running={running} onBreak={onBreak} />
        <div className="flex flex-col items-center" role="timer" aria-label={`${formatClock(left)} left`}>
          <Clock ms={left} dimmed={timer.status === "paused"} />
          <span className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
            {PHASE_LABELS[timer.phase]}
            {timer.status === "paused" && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-foreground/80">Paused</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Before it starts: how long. Once it runs: when it ends. */}
      <div className="flex h-9 items-center">
        {!underway ? (
          <LengthPicker phase={timer.phase} minutes={Math.round(timer.durationMs / 60_000)} />
        ) : (
          <p className="text-sm text-muted-foreground tabular-nums">
            {running && timer.endsAt !== null ? `Ends at ${endTime(timer.endsAt)}` : "Paused. Press play to carry on."}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <button type="button" className={ROUND_BUTTON} onClick={timer.stop} disabled={!underway} aria-label="Stop and reset" title="Stop and reset">
            <Square className="size-[15px]" fill="currentColor" />
          </button>
          <button type="button" className={ROUND_BUTTON} onClick={() => timer.adjust(-5 * 60_000)} aria-label="5 minutes less" title="5 minutes less">
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            onClick={timer.toggle}
            aria-label={running ? "Pause" : underway ? "Resume" : "Start"}
            title={running ? "Pause" : underway ? "Resume" : "Start"}
            className="mx-2 grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_22px_-10px_rgb(0_0_0/0.55)] outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
          >
            {running ? <Pause className="size-6" fill="currentColor" /> : <Play className="ml-1 size-6" fill="currentColor" />}
          </button>
          <button type="button" className={ROUND_BUTTON} onClick={() => timer.adjust(5 * 60_000)} aria-label="5 minutes more" title="5 minutes more">
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            className={ROUND_BUTTON}
            onClick={timer.skip}
            aria-label={onBreak ? "Skip the break" : "Skip to the break"}
            title={onBreak ? "Skip the break" : "Skip to the break"}
          >
            <SkipForward className="size-[17px]" fill="currentColor" />
          </button>
        </div>
        {timer.finished && <FinishedPrompt task={timer.finished} />}
      </div>
    </section>
  );
}

