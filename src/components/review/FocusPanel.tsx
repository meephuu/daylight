import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFocusSessionsBetween } from "@/hooks/useFocus";
import type { FocusSession } from "@/lib/db/focus";
import type { Project } from "@/lib/db/projects";
import { formatFocused } from "@/lib/focus";
import type { WeekRange } from "@/lib/review";

const NO_PROJECT = -1;

interface FocusPanelProps {
  range: WeekRange;
  previous: WeekRange;
  projectsById: Map<number, Project>;
}

const total = (sessions: FocusSession[]) => sessions.reduce((sum, session) => sum + session.focusedSeconds, 0);

/**
 * The week's focus (Focus page sessions): time focused and sessions finished, set as type against last
 * week, and where the time went, by project (each in its own colour, measured against the largest).
 */
export function FocusPanel({ range, previous, projectsById }: FocusPanelProps) {
  const { data: sessions = [] } = useFocusSessionsBetween(range.start, range.end);
  const { data: before = [] } = useFocusSessionsBetween(previous.start, previous.end);

  const seconds = total(sessions);
  const change = seconds - total(before);
  const finished = sessions.filter((session) => session.completed).length;

  const byProject = useMemo(() => {
    const map = new Map<number, number>();
    for (const session of sessions) {
      const key = session.projectId ?? NO_PROJECT;
      map.set(key, (map.get(key) ?? 0) + session.focusedSeconds);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [sessions]);
  const largest = byProject[0]?.[1] ?? 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Focus</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* The week's numbers as type, split by a hairline. */}
        <dl className="grid grid-cols-2 content-start divide-x divide-foreground/10">
          <div className="pr-4">
            <dt className="text-xs text-muted-foreground">Focused</dt>
            <dd className="display-num mt-1 text-[32px]">{formatFocused(seconds)}</dd>
            <dd className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {change > 59 ? (
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              ) : change < -59 ? (
                <ArrowDownRight className="size-3.5" aria-hidden="true" />
              ) : (
                <Minus className="size-3.5" aria-hidden="true" />
              )}
              {Math.abs(change) < 60 ? "Same as last week" : `${formatFocused(Math.abs(change))} ${change > 0 ? "more" : "less"} than last week`}
            </dd>
          </div>
          <div className="pl-4">
            <dt className="text-xs text-muted-foreground">Sessions</dt>
            <dd className="display-num mt-1 text-[32px]">{finished}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">
              {sessions.length - finished > 0 ? `${sessions.length - finished} stopped early` : "None stopped early"}
            </dd>
          </div>
        </dl>

        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">By project</h3>
          {byProject.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">No focus sessions this week.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {byProject.map(([projectId, time]) => {
                const project = projectId === NO_PROJECT ? undefined : projectsById.get(projectId);
                const color = project?.color ?? "var(--series-1)";
                return (
                  <li key={projectId} className="min-w-0">
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{project?.name ?? "No project"}</span>
                      <span className="shrink-0 text-xs text-foreground/75 tabular-nums">{formatFocused(time)}</span>
                    </div>
                    <div className="mt-1 ml-4 h-1 rounded-full bg-foreground/10">
                      <div className="h-full rounded-full" style={{ width: `${(time / largest) * 100}%`, backgroundColor: color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
