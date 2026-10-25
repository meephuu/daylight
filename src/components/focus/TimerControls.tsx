import { Pause, Play, RotateCcw, SkipForward, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRemainingMs } from "@/hooks/useTimerDisplay";
import { useFocusTimer } from "@/lib/focusTimer";

export function TimerControls() {
  const phase = useFocusTimer((state) => state.phase);
  const status = useFocusTimer((state) => state.status);
  const totalMs = useFocusTimer((state) => state.totalMs);
  const { start, pause, resume, reset, finishEarly, skipBreak } = useFocusTimer.getState();
  const remainingMs = useRemainingMs();

  const elapsedMs = totalMs - remainingMs;
  const canSave = phase === "focus" && status !== "idle" && elapsedMs >= 60_000;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {status === "idle" && (
        <Button size="lg" onClick={start}>
          <Play className="size-4" />
          {phase === "focus" ? "Start focus" : "Start break"}
        </Button>
      )}
      {status === "running" && (
        <Button size="lg" variant="outline" onClick={pause}>
          <Pause className="size-4" />
          Pause
        </Button>
      )}
      {status === "paused" && (
        <Button size="lg" onClick={resume}>
          <Play className="size-4" />
          Resume
        </Button>
      )}

      {phase === "focus" && status !== "idle" && (
        <Button
          variant="outline"
          onClick={finishEarly}
          disabled={!canSave}
          title={canSave ? "Stop now and save the time so far" : "Sessions under one minute are not saved"}
        >
          <Square className="size-4" />
          Finish &amp; save
        </Button>
      )}
      {status !== "idle" && (
        <Button variant="ghost" onClick={reset}>
          <RotateCcw className="size-4" />
          Discard
        </Button>
      )}
      {phase !== "focus" && (
        <Button variant="ghost" onClick={skipBreak}>
          <SkipForward className="size-4" />
          Skip break
        </Button>
      )}
    </div>
  );
}
