import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { FocusTargetPicker } from "@/components/focus/FocusTargetPicker";
import { TimerControls } from "@/components/focus/TimerControls";
import { TimerDisplay } from "@/components/focus/TimerDisplay";
import { TimerSettings } from "@/components/focus/TimerSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFocusSessions } from "@/hooks/useFocusSessions";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { toDateString, todayString } from "@/lib/dates";
import { formatMinutes, useFocusTimer } from "@/lib/focusTimer";
import { cn } from "@/lib/utils";

const RECENT_LIMIT = 8;

/** One dot per session in the current cycle, filled as sessions are completed. */
function CycleDots() {
  const completedFocus = useFocusTimer((state) => state.completedFocus);
  const total = useFocusTimer((state) => state.config.sessionsUntilLongBreak);
  const filled = completedFocus % total;
  return (
    <div className="flex items-center justify-center gap-1.5" aria-label={`${filled} of ${total} sessions before long break`}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn("size-2.5 rounded-full", index < filled ? "bg-[var(--viz-bar)]" : "bg-muted")}
        />
      ))}
    </div>
  );
}

export default function FocusPage() {
  const sessionsQuery = useFocusSessions();
  const tasksQuery = useTasks();
  const projectsQuery = useProjects();

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const taskTitles = useMemo(
    () => new Map((tasksQuery.data ?? []).map((task) => [task.id, task.title])),
    [tasksQuery.data],
  );
  const projectNames = useMemo(
    () => new Map((projectsQuery.data ?? []).map((project) => [project.id, project.name])),
    [projectsQuery.data],
  );

  const today = todayString();
  const todaySessions = useMemo(
    () => sessions.filter((session) => toDateString(parseISO(session.startedAt)) === today),
    [sessions, today],
  );
  const todayMinutes = todaySessions.reduce((sum, session) => sum + session.durationMinutes, 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Focus</h1>

      <Card>
        <CardContent className="flex flex-col gap-6 py-4">
          <TimerDisplay />
          <CycleDots />
          <TimerControls />
          <FocusTargetPicker />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Focused today</p>
            <p className="mt-1 text-3xl font-semibold">{formatMinutes(todayMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Sessions today</p>
            <p className="mt-1 text-3xl font-semibold">{todaySessions.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No sessions yet. Start the timer to log your first one.
            </p>
          ) : (
            <ul className="divide-y">
              {sessions.slice(0, RECENT_LIMIT).map((session) => {
                const task = session.taskId === null ? undefined : taskTitles.get(session.taskId);
                const project = session.projectId === null ? undefined : projectNames.get(session.projectId);
                return (
                  <li key={session.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{task ?? "No task"}</span>
                    {project && <span className="truncate text-xs text-muted-foreground">{project}</span>}
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {format(parseISO(session.startedAt), "MMM d, HH:mm")}
                    </span>
                    <span className="w-14 shrink-0 text-right tabular-nums">{formatMinutes(session.durationMinutes)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timer lengths</CardTitle>
        </CardHeader>
        <CardContent>
          <TimerSettings />
        </CardContent>
      </Card>
    </div>
  );
}
