import { useEffect, useRef, useState } from "react";
import { Clock, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMinutes, periodName, useAmbientMinutes, useAmbientTime } from "@/lib/ambient";
import { cn } from "@/lib/utils";

/** TEMPORARY testing aid: slide the time of day to preview the background. Remove when done. */

const PRESETS = [
  { label: "Morning", minutes: 8 * 60 },
  { label: "Afternoon", minutes: 13 * 60 },
  { label: "Evening", minutes: 18 * 60 + 30 },
  { label: "Night", minutes: 23 * 60 },
];

/** While playing, the clock advances this many minutes every tick (a full day in about 12 seconds). */
const PLAY_STEP_MINUTES = 10;
const PLAY_TICK_MS = 80;

export function TimeOfDayDebugPanel() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const override = useAmbientTime((state) => state.override);
  const setOverride = useAmbientTime((state) => state.setOverride);
  const minutes = useAmbientMinutes();

  const minutesRef = useRef(minutes);
  minutesRef.current = minutes;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setOverride((minutesRef.current + PLAY_STEP_MINUTES) % (24 * 60));
    }, PLAY_TICK_MS);
    return () => window.clearInterval(id);
  }, [playing, setOverride]);

  function choose(value: number | null) {
    setPlaying(false);
    setOverride(value);
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
      <div
        className={cn(
          "w-80 rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl transition-all duration-300",
          open ? "translate-y-0 opacity-100" : "invisible translate-y-4 opacity-0",
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Time of day (testing)</p>
            <p className="text-xs text-muted-foreground">
              {override === null ? "Following the real clock" : "Manual time"}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close time tester">
            <X className="size-4" />
          </Button>
        </div>

        <p className="mt-3 text-3xl font-semibold tabular-nums">
          {formatMinutes(minutes)}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{periodName(minutes)}</span>
        </p>

        <input
          type="range"
          min={0}
          max={24 * 60 - 1}
          step={5}
          value={Math.round(minutes) % (24 * 60)}
          onChange={(event) => choose(Number(event.target.value))}
          aria-label="Time of day"
          className="mt-3 w-full cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Button key={preset.label} variant="outline" size="sm" onClick={() => choose(preset.minutes)}>
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            variant={playing ? "default" : "outline"}
            size="sm"
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? "Pause" : "Play the day"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => choose(null)} disabled={override === null && !playing}>
            Use real time
          </Button>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Clock className="size-4" />
        <span className="tabular-nums">{formatMinutes(minutes)}</span>
        {override !== null && <span className="text-xs text-muted-foreground">test</span>}
      </Button>
    </div>
  );
}
