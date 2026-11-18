import { forwardRef, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { Link } from "react-router-dom";
import { ChevronDown, Search, Timer } from "lucide-react";
import { useFocusDays } from "@/hooks/useFocus";
import { bangkokToday } from "@/lib/bangkok";
import { formatDueDate, toDateString } from "@/lib/dates";
import type { FocusSession } from "@/lib/db/focus";
import type { Task } from "@/lib/db/tasks";
import { formatFocused, useFocusTimer } from "@/lib/focus";
import { cn } from "@/lib/utils";

/**
 * A pane at the side of the timer. While a run is going the side recedes: the content fades back (the
 * glass itself stays, since opacity on a pane would stop its blur) and comes forward again on hover.
 */
const SidePane = forwardRef<
  HTMLElement,
  { title: string; aside?: ReactNode; dim: boolean; children: ReactNode; id?: string; awayIndex?: number }
>(
  function SidePane({ title, aside, dim, children, id, awayIndex = 0 }, ref) {
    return (
      <section
        ref={ref}
        id={id}
        className="pane group/side p-5"
        aria-label={title}
        tabIndex={-1}
        // Its place in focus mode's leaving / returning sequence (index.css, .focus-away).
        data-away=""
        style={{ "--i": awayIndex } as CSSProperties}
      >
        <div
          className={cn(
            "transition-opacity duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
            dim && "opacity-45 group-hover/side:opacity-100 group-focus-within/side:opacity-100",
          )}
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[19px] leading-tight font-semibold tracking-[-0.02em]">{title}</h2>
            {aside && <span className="text-xs text-muted-foreground tabular-nums">{aside}</span>}
          </div>
          {children}
        </div>
      </section>
    );
  },
);

const minutesOf = (dateTime: string) => Number(dateTime.slice(11, 13)) * 60 + Number(dateTime.slice(14, 16));
const timeOf = (dateTime: string) => dateTime.slice(11, 16);

/* --- Today ------------------------------------------------------------------------------------------ */

/**
 * Today's focus: the time against the daily goal, then the sessions along the day's hours, each in its
 * task's project colour (stopped early: hollow, dashed), and the latest few as a list.
 */
export function TodayPane({
  sessions,
  goalMin,
  projectColors,
  dim,
  awayIndex,
}: {
  awayIndex?: number;
  sessions: FocusSession[];
  goalMin: number;
  projectColors: Map<number, string>;
  dim: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const focused = sessions.reduce((sum, session) => sum + session.focusedSeconds, 0);
  const goalShare = Math.min(1, focused / (goalMin * 60));

  // The strip spans 08:00 to 22:00, widened to fit sessions outside those hours.
  const startHour = Math.min(8, ...sessions.map((session) => Math.floor(minutesOf(session.startedAt) / 60)));
  const endHour = Math.max(22, ...sessions.map((session) => Math.ceil(minutesOf(session.endedAt) / 60)));
  const span = (endHour - startHour) * 60;
  const ticks: number[] = [];
  for (let hour = startHour; hour <= endHour; hour += 2) ticks.push(hour);
  const hovered = hover !== null ? sessions.find((session) => session.id === hover) : undefined;
  const colorOf = (session: FocusSession) =>
    (session.projectId !== null ? projectColors.get(session.projectId) : undefined) ?? "var(--series-1)";

  return (
    <SidePane title="Today" aside={`goal ${formatFocused(goalMin * 60)}`} dim={dim} awayIndex={awayIndex}>
      {/* The day's numbers as type, split by a hairline. */}
      <dl className="grid grid-cols-3 divide-x divide-foreground/10">
        <div className="pr-3">
          <dt className="text-[11px] text-muted-foreground">Focused</dt>
          <dd className="display-num mt-0.5 text-[26px] leading-none font-semibold">{formatFocused(focused)}</dd>
        </div>
        <div className="px-3">
          <dt className="text-[11px] text-muted-foreground">Sessions</dt>
          <dd className="display-num mt-0.5 text-[26px] leading-none font-semibold">{sessions.filter((session) => session.completed).length}</dd>
        </div>
        <div className="pl-3">
          <dt className="text-[11px] text-muted-foreground">Of goal</dt>
          <dd className="display-num mt-0.5 text-[26px] leading-none font-semibold">{Math.round(goalShare * 100)}%</dd>
        </div>
      </dl>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/10"
        role="meter"
        aria-label="Daily goal"
        aria-valuemin={0}
        aria-valuemax={goalMin}
        aria-valuenow={Math.round(focused / 60)}
      >
        <div
          className="h-full rounded-full bg-[var(--series-1)] transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          style={{ width: `${goalShare * 100}%` }}
        />
      </div>

      {/* The sessions along the day. */}
      <figure className="relative mt-5" aria-label="Today's sessions by time">
        <div className="relative h-7 rounded-[8px] bg-foreground/[0.05]" onMouseLeave={() => setHover(null)}>
          {ticks.slice(1, -1).map((hour) => (
            <span
              key={hour}
              className="absolute top-1 bottom-1 w-px bg-foreground/[0.08]"
              style={{ left: `${((hour - startHour) * 60 * 100) / span}%` }}
              aria-hidden="true"
            />
          ))}
          {sessions.map((session) => {
            const start = minutesOf(session.startedAt) - startHour * 60;
            const length = Math.max(4, minutesOf(session.endedAt) - minutesOf(session.startedAt));
            const color = colorOf(session);
            return (
              <span
                key={session.id}
                onMouseEnter={() => setHover(session.id)}
                className={cn(
                  "absolute top-1 bottom-1 rounded-[4px] transition-opacity duration-150",
                  hover !== null && hover !== session.id && "opacity-50",
                )}
                style={{
                  left: `${(start * 100) / span}%`,
                  width: `max(${(length * 100) / span}%, 4px)`,
                  ...(session.completed
                    ? { backgroundColor: color }
                    : { border: `1.5px dashed ${color}`, backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }),
                }}
                role="img"
                aria-label={`${timeOf(session.startedAt)} to ${timeOf(session.endedAt)}, ${session.taskTitle ?? "no task"}, ${formatFocused(session.focusedSeconds)}${session.completed ? "" : ", stopped early"}`}
              />
            );
          })}
        </div>
        <div className="relative mt-1.5 h-3.5 text-[11px] text-muted-foreground tabular-nums">
          {ticks.map((hour, index) => (
            <span
              key={hour}
              className={cn("absolute", index === 0 ? "" : index === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2")}
              style={{ left: `${((hour - startHour) * 60 * 100) / span}%` }}
            >
              {String(hour % 24).padStart(2, "0")}
            </span>
          ))}
        </div>
        {hovered && (
          <div
            className="glass-strong pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-[12px] px-2.5 py-1.5 text-xs whitespace-nowrap"
            style={{
              left: `clamp(80px, ${((minutesOf(hovered.startedAt) - startHour * 60) * 100) / span}%, calc(100% - 80px))`,
            }}
          >
            <span className="font-medium">{hovered.taskTitle ?? "No task"}</span>{" "}
            <span className="text-muted-foreground tabular-nums">
              {timeOf(hovered.startedAt)}–{timeOf(hovered.endedAt)} · {formatFocused(hovered.focusedSeconds)}
              {!hovered.completed && " · stopped early"}
            </span>
          </div>
        )}
      </figure>

      {sessions.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No focus yet today. Pick a task and press play.</p>
      ) : (
        <ol className="mt-4 flex flex-col">
          {sessions
            .slice(-4)
            .reverse()
            .map((session) => (
              <li key={session.id} className="flex min-h-8 items-center gap-2.5 text-sm">
                <span className="w-11 shrink-0 text-xs text-muted-foreground tabular-nums">{timeOf(session.startedAt)}</span>
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={
                    session.completed
                      ? { backgroundColor: colorOf(session) }
                      : { boxShadow: `inset 0 0 0 1.5px ${colorOf(session)}` }
                  }
                  aria-hidden="true"
                />
                <span className={cn("min-w-0 flex-1 truncate", !session.taskTitle && "text-muted-foreground")}>
                  {session.taskTitle ?? "No task"}
                </span>
                {!session.completed && <span className="shrink-0 text-[11px] text-muted-foreground">stopped early</span>}
                <span className="shrink-0 text-xs text-foreground/75 tabular-nums">{formatFocused(session.focusedSeconds)}</span>
              </li>
            ))}
        </ol>
      )}
    </SidePane>
  );
}

/* --- Tasks to focus on --------------------------------------------------------------------------- */

/** Up next shows this many tasks until "View all" is opened. */
const PREVIEW_COUNT = 5;

type TaskGroup ="Overdue" | "Today" | "In progress" | "Upcoming" | "No date" | "Done today";
const GROUP_ORDER: TaskGroup[] = ["Overdue", "Today", "In progress", "Upcoming", "No date", "Done today"];

/**
 * Every open task, grouped the way you would pick one: overdue, today, in progress, coming up (soonest
 * first), then the ones without a date. Tasks finished today stay at the end, struck through.
 */
function groupTasks(tasks: Task[], today: string, query: string): { group: TaskGroup; tasks: Task[] }[] {
  const needle = query.trim().toLowerCase();
  const groups = new Map<TaskGroup, Task[]>(GROUP_ORDER.map((group) => [group, []]));
  for (const task of tasks) {
    if (needle && !task.title.toLowerCase().includes(needle)) continue;
    let group: TaskGroup | null;
    if (task.status === "done") {
      group = task.completedAt !== null && bangkokToday(new Date(task.completedAt)) === today ? "Done today" : null;
    } else if (task.dueDate !== null && task.dueDate < today) group = "Overdue";
    else if (task.dueDate === today) group = "Today";
    else if (task.status === "doing") group = "In progress";
    else if (task.dueDate !== null) group = "Upcoming";
    else group = "No date";
    if (group) groups.get(group)!.push(task);
  }
  const byDate = (a: Task, b: Task) =>
    (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
    (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99") ||
    a.title.localeCompare(b.title);
  return GROUP_ORDER.map((group) => ({ group, tasks: groups.get(group)!.sort(byDate) })).filter((entry) => entry.tasks.length > 0);
}

export const TasksPane = forwardRef<
  HTMLElement,
  { tasks: Task[]; projectColors: Map<number, string>; focusedByTask: Map<number, number>; dim: boolean; awayIndex?: number }
>(function TasksPane({ tasks, projectColors, focusedByTask, dim, awayIndex }, ref) {
  const today = bangkokToday();
  const selected = useFocusTimer((state) => state.task);
  const setTask = useFocusTimer((state) => state.setTask);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const allGroups = useMemo(() => groupTasks(tasks, today, query), [tasks, today, query]);
  const total = allGroups.reduce((sum, entry) => sum + entry.tasks.length, 0);
  const openCount = tasks.filter((task) => task.status !== "done").length;
  // Folded: the first few in order (the groups keep their headings and full counts); "View all" opens
  // the whole list with its search.
  const groups = useMemo(() => {
    if (expanded) return allGroups;
    let room = PREVIEW_COUNT;
    const shown: typeof allGroups = [];
    for (const entry of allGroups) {
      if (room <= 0) break;
      shown.push({ ...entry, tasks: entry.tasks.slice(0, room) });
      room -= entry.tasks.length;
    }
    return shown;
  }, [allGroups, expanded]);

  return (
    <SidePane ref={ref} id="focus-tasks" title="Up next" aside={`${openCount} open`} dim={dim} awayIndex={awayIndex}>
      {openCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing on your list. <Link to="/tasks" className="underline underline-offset-3 hover:text-foreground">Add a task</Link>, or just focus without one.
        </p>
      ) : (
        <>
          {expanded && (
            <label className="fade-in glass-well mb-2 flex h-9 items-center gap-2 rounded-full px-3.5 shadow-[inset_0_0_0_1px_var(--glass-rim)] focus-within:ring-3 focus-within:ring-ring/50">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a task"
                aria-label="Find a task"
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
          )}
          {groups.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">No task matches &ldquo;{query}&rdquo;.</p>
          ) : (
            // Scrolls inside the pane, so a long list never pushes the week off the page.
            <div className="-mx-2 max-h-[min(420px,48vh)] overflow-y-auto px-0.5">
              {groups.map(({ group, tasks: inGroup }) => (
                <section key={group} aria-label={group} className="pb-1.5">
                  <h3 className="flex items-baseline gap-1.5 px-2.5 pt-2 pb-1 text-[12px] font-medium text-muted-foreground">
                    <span className={cn(group === "Overdue" && "text-destructive")}>{group}</span>
                    <span className="tabular-nums opacity-70">{inGroup.length}</span>
                  </h3>
                  <ul className="flex flex-col">
                    {inGroup.map((task) => {
                      const active = selected?.id === task.id;
                      const done = task.status === "done";
                      const color = task.projectId !== null ? projectColors.get(task.projectId) : undefined;
                      const spent = focusedByTask.get(task.id);
                      return (
                        <li key={task.id}>
                          <button
                            type="button"
                            disabled={done}
                            aria-pressed={active}
                            onClick={() => setTask(active ? null : { id: task.id, title: task.title, projectId: task.projectId })}
                            title={active ? "Click to stop focusing on this task" : "Focus on this task"}
                            className={cn(
                              "flex min-h-10 w-full items-center gap-2.5 rounded-[14px] px-2.5 text-left text-sm outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
                              active
                                ? "bg-white/80 shadow-[inset_0_1px_0_var(--glass-edge),inset_0_0_0_1px_color-mix(in_srgb,var(--sky-accent)_45%,transparent)] dark:bg-white/[0.13]"
                                : "hover:bg-foreground/[0.06]",
                              done && "cursor-default",
                            )}
                          >
                            <span
                              className={cn("size-2 shrink-0 rounded-full", !color && "bg-foreground/25")}
                              style={color ? { backgroundColor: color } : undefined}
                              aria-hidden="true"
                            />
                            <span className={cn("min-w-0 flex-1 truncate", done && "strike strike-on text-muted-foreground")}>{task.title}</span>
                            {active ? (
                              <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-foreground/80">
                                <Timer className="size-3 text-sky-accent" aria-hidden="true" />
                                Focusing
                              </span>
                            ) : (
                              <>
                                {spent !== undefined && spent >= 60 && (
                                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{formatFocused(spent)}</span>
                                )}
                                {!done && task.dueDate !== null && task.dueDate !== today && (
                                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{formatDueDate(task.dueDate)}</span>
                                )}
                                {!done && task.dueDate === today && task.dueTime && (
                                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{task.dueTime}</span>
                                )}
                              </>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {(total > PREVIEW_COUNT || expanded) && (
            <button
              type="button"
              onClick={() => {
                setExpanded(!expanded);
                setQuery("");
              }}
              aria-expanded={expanded}
              className="mt-1.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-medium text-foreground/75 outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {expanded ? "Show less" : `View all tasks (${total})`}
              <ChevronDown className={cn("size-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]", expanded && "rotate-180")} aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </SidePane>
  );
});

/* --- This week ------------------------------------------------------------------------------------- */

/** Focused time per day this week (Sunday first): one bar a day, today's label marked, hover for the time. */
export function WeekPane({ dim, awayIndex }: { dim: boolean; awayIndex?: number }) {
  const today = bangkokToday();
  const days = useMemo(() => {
    const sunday = startOfWeek(parseISO(today), { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, index) => toDateString(addDays(sunday, index)));
  }, [today]);
  const { data } = useFocusDays(days[0]!);
  const totals = useMemo(() => new Map((data ?? []).map((row) => [row.day, row.seconds])), [data]);
  const weekTotal = (data ?? []).reduce((sum, row) => sum + row.seconds, 0);
  const max = Math.max(...days.map((day) => totals.get(day) ?? 0), 1);
  const [hover, setHover] = useState<number | null>(null);
  const hovered = hover !== null ? days[hover] : undefined;

  return (
    <SidePane title="This week" aside={formatFocused(weekTotal)} dim={dim} awayIndex={awayIndex}>
      <figure className="relative" aria-label="Time focused per day this week">
        <div className="flex h-[72px] items-end gap-1.5" onMouseLeave={() => setHover(null)}>
          {days.map((day, index) => {
            const seconds = totals.get(day) ?? 0;
            return (
              <div
                key={day}
                className="flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(index)}
                role="img"
                aria-label={`${format(parseISO(day), "EEE d MMM")}: ${formatFocused(seconds)}`}
              >
                <div
                  className={cn(
                    "w-full rounded-t-[4px] transition-[height,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
                    seconds > 0 ? "bg-[var(--series-1)]" : "bg-foreground/12",
                    hover !== null && hover !== index && "opacity-55",
                  )}
                  style={{ height: seconds > 0 ? `max(${(seconds / max) * 100}%, 3px)` : day > today ? "0px" : "2px" }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1.5 text-[11px] text-muted-foreground">
          {days.map((day) => (
            <span key={day} className={cn("flex-1 text-center", day === today && "font-semibold text-foreground")}>
              {format(parseISO(day), "EEEEE")}
            </span>
          ))}
        </div>
        {hovered && hover !== null && (
          <div
            className="glass-strong pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-[12px] px-2.5 py-1.5 text-xs whitespace-nowrap"
            style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}
          >
            <span className="text-muted-foreground">{format(parseISO(hovered), "EEE d MMM")}</span>{" "}
            <span className="font-semibold tabular-nums">{formatFocused(totals.get(hovered) ?? 0)}</span>
          </div>
        )}
      </figure>
    </SidePane>
  );
}
