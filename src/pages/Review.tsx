import { useMemo, useState } from "react";
import { addWeeks, format, isSameDay, parseISO } from "date-fns";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Flame, TriangleAlert } from "lucide-react";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFocusSessions } from "@/hooks/useFocusSessions";
import { useHabitLogs, useHabits } from "@/hooks/useHabits";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { formatDueDate, todayString } from "@/lib/dates";
import type { Task } from "@/lib/db/tasks";
import { formatMinutes } from "@/lib/focusTimer";
import { groupLogsByHabit } from "@/lib/habits";
import {
  completedInWeek,
  focusByProject,
  habitWeek,
  overallConsistency,
  slippedInWeek,
  weekRange,
  type HabitDayStatus,
} from "@/lib/review";
import { cn } from "@/lib/utils";

const LIST_LIMIT = 8;
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function SummaryTile({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold">{value}</p>
        </div>
        <Icon className="size-8 text-muted-foreground/60" />
      </CardContent>
    </Card>
  );
}

function TaskColumn({
  title,
  tasks,
  empty,
  detail,
}: {
  title: string;
  tasks: Task[];
  empty: string;
  detail: (task: Task) => string;
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1 text-sm font-medium text-muted-foreground">
        {title} · {tasks.length}
      </h3>
      {tasks.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">
          {tasks.slice(0, LIST_LIMIT).map((task) => (
            <li key={task.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{detail(task)}</span>
            </li>
          ))}
        </ul>
      )}
      {tasks.length > LIST_LIMIT && (
        <p className="mt-1 text-xs text-muted-foreground">+{tasks.length - LIST_LIMIT} more</p>
      )}
    </div>
  );
}

const DAY_STYLE: Record<HabitDayStatus, string> = {
  met: "opacity-100",
  logged: "opacity-100",
  missed: "bg-muted",
  pending: "bg-muted ring-1 ring-inset ring-foreground/30",
  future: "bg-muted/40",
  before: "bg-transparent",
};

const DAY_LABEL: Record<HabitDayStatus, string> = {
  met: "target met",
  logged: "logged",
  missed: "missed",
  pending: "today, not done yet",
  future: "upcoming",
  before: "before the habit existed",
};

export default function ReviewPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const range = useMemo(() => weekRange(cursor), [cursor]);
  const today = todayString();

  const tasksQuery = useTasks();
  const projectsQuery = useProjects();
  const sessionsQuery = useFocusSessions();
  const habitsQuery = useHabits();
  const logsQuery = useHabitLogs();

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const completed = useMemo(() => completedInWeek(tasks, range), [tasks, range]);
  const slipped = useMemo(() => slippedInWeek(tasks, range, today), [tasks, range, today]);

  const projectNames = useMemo(
    () => new Map((projectsQuery.data ?? []).map((project) => [project.id, project.name])),
    [projectsQuery.data],
  );
  const focus = useMemo(() => focusByProject(sessionsQuery.data ?? [], range), [sessionsQuery.data, range]);
  const focusMinutes = focus.reduce((sum, entry) => sum + entry.minutes, 0);
  const focusSessions = focus.reduce((sum, entry) => sum + entry.sessions, 0);

  const habitWeeks = useMemo(() => {
    const logs = groupLogsByHabit(logsQuery.data ?? []);
    return (habitsQuery.data ?? [])
      .filter((habit) => !habit.archived)
      .map((habit) => habitWeek(habit, logs.get(habit.id) ?? [], range, today));
  }, [habitsQuery.data, logsQuery.data, range, today]);
  const consistency = overallConsistency(habitWeeks);

  const isThisWeek = range.days.includes(today);
  const title = `${format(parseISO(range.start), "MMM d")} – ${format(parseISO(range.end), "MMM d, yyyy")}`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Weekly review</h1>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(addWeeks(cursor, -1))} aria-label="Previous week">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(addWeeks(cursor, 1))} aria-label="Next week">
            <ChevronRight className="size-4" />
          </Button>
          {!isThisWeek && (
            <Button variant="outline" onClick={() => setCursor(new Date())}>
              This week
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Tasks completed" value={String(completed.length)} icon={CheckCircle2} />
        <SummaryTile label="Tasks slipped" value={String(slipped.length)} icon={TriangleAlert} />
        <SummaryTile label="Focus time" value={formatMinutes(focusMinutes)} icon={Clock} />
        <SummaryTile
          label="Habit consistency"
          value={consistency === null ? "–" : `${Math.round(consistency * 100)}%`}
          icon={Flame}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <TaskColumn
            title="Completed"
            tasks={completed}
            empty="Nothing completed this week."
            detail={(task) => (task.completedAt ? format(parseISO(task.completedAt), "EEE") : "")}
          />
          <TaskColumn
            title="Slipped"
            tasks={slipped}
            empty="Nothing slipped. Every due date was met."
            detail={(task) =>
              `${task.dueDate ? formatDueDate(task.dueDate) : ""} · ${task.status === "done" ? "done late" : "still open"}`
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Focus time by project
            {focusSessions > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {focusSessions} session{focusSessions === 1 ? "" : "s"}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HorizontalBarChart
            data={focus.map((entry) => ({
              label: entry.projectId === null ? "No project" : (projectNames.get(entry.projectId) ?? "Deleted project"),
              value: entry.minutes,
            }))}
            formatTip={formatMinutes}
            formatTooltip={(item, share) => `${formatMinutes(item.value)} · ${Math.round(share * 100)}%`}
            tableHeaders={["Project", "Focus time"]}
            tableCaption="Focus time by project this week"
            emptyMessage="No focus sessions this week."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Habit consistency</CardTitle>
        </CardHeader>
        <CardContent>
          {habitWeeks.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No habits to review yet.</p>
          ) : (
            <ul className="divide-y">
              {habitWeeks.map((week) => (
                <li key={week.habit.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: week.habit.color }} />
                    <span className="truncate font-medium">{week.habit.name}</span>
                  </span>
                  <div className="flex gap-1.5">
                    {week.days.map((status, index) => {
                      const date = range.days[index] ?? "";
                      return (
                        <div key={date} className="flex flex-col items-center gap-1">
                          <span
                            title={`${format(parseISO(date), "EEE, MMM d")}: ${DAY_LABEL[status]}`}
                            aria-label={`${format(parseISO(date), "EEEE")}: ${DAY_LABEL[status]}`}
                            className={cn("size-5 rounded-[5px]", DAY_STYLE[status])}
                            style={
                              status === "met" || status === "logged"
                                ? { backgroundColor: week.habit.color }
                                : undefined
                            }
                          />
                          <span
                            className={cn(
                              "text-[10px] text-muted-foreground",
                              isSameDay(parseISO(date), new Date()) && "font-semibold text-foreground",
                            )}
                          >
                            {DAY_LETTERS[index]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <span className="w-28 text-right text-sm tabular-nums text-muted-foreground">
                    {week.habit.frequency === "daily"
                      ? `${week.achieved}/${week.possible} days`
                      : `${week.achieved}/${week.possible} this week`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
