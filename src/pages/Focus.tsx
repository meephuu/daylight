import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FocusMode } from "@/components/focus/FocusMode";
import { FocusSettingsMenu } from "@/components/focus/FocusSettingsMenu";
import { DayPane, TasksPane, WeekPane } from "@/components/focus/FocusSide";
import { FocusStage } from "@/components/focus/FocusStage";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { useFocusSessionsOn, useFocusSettings } from "@/hooks/useFocus";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { bangkokToday } from "@/lib/bangkok";
import { formatFocused, PHASE_LABELS, useFocusTimer, type FocusPhase } from "@/lib/focus";
import { cn } from "@/lib/utils";

const PHASES: FocusPhase[] = ["focus", "break"];

/**
 * Focus: a Pomodoro timer. The timer on the left (what it is for, the time left in a ring that drains, the
 * cycle and the controls); on the right a day's focus against the goal (today, or an earlier day stepped
 * back to), the tasks to point it at, and that day's week. The timer itself lives in lib/focus.ts, so it
 * keeps running on other pages and in the tray.
 */
export default function FocusPage() {
  const today = bangkokToday();
  const settings = useFocusSettings();
  const phase = useFocusTimer((state) => state.phase);
  const status = useFocusTimer((state) => state.status);
  const setPhase = useFocusTimer((state) => state.setPhase);
  const { data: sessions = [] } = useFocusSessionsOn(today);
  // The day the side panes show: null is today (so it follows the date over midnight).
  const [picked, setPicked] = useState<string | null>(null);
  const shownDay = picked !== null && picked < today ? picked : today;
  const pickDay = useCallback((day: string) => setPicked(day >= today ? null : day), [today]);
  const { data: shownSessions = [] } = useFocusSessionsOn(shownDay);
  const { data: tasks = [] } = useTasks();
  const { data: projects = [] } = useProjects();
  const tasksRef = useRef<HTMLElement>(null);

  // Focus mode: on when a run starts, off when it ends or on its X (the timer keeps going). The layer
  // stays mounted while it animates closed; the page's blocks leave and come back with it.
  const focusMode = useFocusTimer((state) => state.focusMode);
  const setFocusMode = useFocusTimer((state) => state.setFocusMode);
  const [layer, setLayer] = useState(focusMode);
  useEffect(() => {
    if (focusMode) setLayer(true);
  }, [focusMode]);
  const closeLayer = useCallback(() => setLayer(false), []);

  const projectColors = useMemo(() => new Map(projects.map((project) => [project.id, project.color])), [projects]);
  const focusedByTask = useMemo(() => {
    const map = new Map<number, number>();
    for (const session of sessions) {
      if (session.taskId !== null) map.set(session.taskId, (map.get(session.taskId) ?? 0) + session.focusedSeconds);
    }
    return map;
  }, [sessions]);
  const focusedToday = sessions.reduce((sum, session) => sum + session.focusedSeconds, 0);
  const completedToday = sessions.filter((session) => session.completed).length;

  const summary =
    sessions.length === 0
      ? `Nothing focused yet today · goal ${formatFocused(settings.goalMin * 60)}`
      : `${formatFocused(focusedToday)} focused today · ${completedToday} ${completedToday === 1 ? "session" : "sessions"} · goal ${formatFocused(settings.goalMin * 60)}`;
  const dim = status === "running";

  // The page's blocks leave as focus mode opens and come back as it closes (index.css, .focus-away): the
  // header's parts first, then the timer pane (1) and the side panes (2-4).
  return (
    <div className={cn("focus-page mx-auto flex max-w-[1320px] flex-col gap-3", focusMode && "focus-away")}>
      <PageHeader
        title="Focus"
        summary={summary}
        actions={
          <>
            <Segmented
              aria-label="Timer"
              track={false}
              options={PHASES.map((value) => ({ value, label: PHASE_LABELS[value] }))}
              value={phase}
              onChange={setPhase}
            />
            <FocusSettingsMenu />
          </>
        }
      />
      <div className="grid items-start gap-3 lg:grid-cols-12">
        <div className="lg:sticky lg:top-12 lg:col-span-7">
          <FocusStage
            hideRing={layer}
            onEnterFocusMode={() => setFocusMode(true)}
            projectColors={projectColors}
            onPickTask={() => {
              tasksRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              tasksRef.current?.focus({ preventScroll: true });
            }}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-5">
          <DayPane
            day={shownDay}
            today={today}
            onDayChange={pickDay}
            sessions={shownDay === today ? sessions : shownSessions}
            tasks={tasks}
            goalMin={settings.goalMin}
            projectColors={projectColors}
            dim={dim}
            awayIndex={2}
          />
          <TasksPane ref={tasksRef} tasks={tasks} projectColors={projectColors} focusedByTask={focusedByTask} dim={dim} awayIndex={3} />
          <WeekPane day={shownDay} today={today} onDayChange={pickDay} dim={dim} awayIndex={4} />
        </div>
      </div>
      {layer && <FocusMode active={focusMode} onClosed={closeLayer} />}
    </div>
  );
}
