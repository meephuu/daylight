import { useMemo } from "react";
import { Check, Flame, Minus } from "lucide-react";
import { Link } from "react-router-dom";
import { useHabitLogs, useHabits, useSetHabitLogCount } from "@/hooks/useHabits";
import { todayString } from "@/lib/dates";
import type { Habit } from "@/lib/db/habits";
import { computeStreak, dailyCap, groupLogsByHabit, logCountsByDate, type StreakInfo } from "@/lib/habits";
import { cn } from "@/lib/utils";

const SIZE = 56;
const STROKE = 4;

function HabitToggle({ habit, streak, todayCount }: { habit: Habit; streak: StreakInfo; todayCount: number }) {
  const setLog = useSetHabitLogCount();
  const today = todayString();
  const single = habit.frequency === "daily" && habit.targetPerPeriod === 1;
  // Daily habits fill against today's target; weekly ones against the week's.
  const progress = habit.frequency === "daily" ? todayCount : streak.currentTotal;
  const target = Math.max(habit.targetPerPeriod, 1);
  const fraction = Math.min(1, progress / target);
  const met = fraction >= 1;
  const cap = habit.frequency === "daily" ? dailyCap(habit) : Number.POSITIVE_INFINITY;

  function press() {
    if (single) setLog.mutate({ habitId: habit.id, date: today, count: todayCount > 0 ? 0 : 1 });
    else if (todayCount < cap) setLog.mutate({ habitId: habit.id, date: today, count: todayCount + 1 });
  }

  const r = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const unit = habit.frequency === "daily" ? "today" : "this week";

  return (
    <li className="group/habit relative flex min-w-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={press}
        disabled={setLog.isPending}
        aria-pressed={single ? todayCount > 0 : undefined}
        aria-label={single ? `${habit.name}: ${todayCount > 0 ? "done, press to undo" : "press to check off"}` : `${habit.name}: ${progress} of ${target} ${unit}, press to add one`}
        className="relative grid place-items-center rounded-full outline-none transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
        style={{ width: SIZE, height: SIZE }}
      >
        <svg width={SIZE} height={SIZE} className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill={met ? habit.color : "transparent"} stroke={`color-mix(in srgb, ${habit.color} 28%, transparent)`} strokeWidth={STROKE} />
          {!met && fraction > 0 && (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              fill="none"
              stroke={habit.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${circumference * fraction} ${circumference}`}
            />
          )}
        </svg>
        <span className={cn("relative text-sm font-semibold tabular-nums", met ? "text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.3)]" : "text-foreground/85")}>
          {met ? <Check className="size-6" strokeWidth={3} /> : single ? "" : `${progress}/${target}`}
        </span>
      </button>
      {!single && todayCount > 0 && (
        <button
          type="button"
          onClick={() => setLog.mutate({ habitId: habit.id, date: today, count: todayCount - 1 })}
          aria-label={`Remove one from ${habit.name}`}
          className="glass-strong absolute top-0 right-[calc(50%-34px)] grid size-5 place-items-center rounded-full opacity-0 transition-opacity group-hover/habit:opacity-100 focus-visible:opacity-100"
        >
          <Minus className="size-3" />
        </button>
      )}
      <span className="w-full truncate text-center text-xs font-medium" title={habit.name}>
        {habit.name}
      </span>
      <span className={cn("-mt-1 flex items-center gap-0.5 text-[11px] tabular-nums", streak.current > 0 ? "text-foreground/80" : "text-muted-foreground")}>
        <Flame className={cn("size-3", streak.current > 0 && "text-[#ff9a4d]")} aria-hidden="true" />
        {streak.current}
        <span className="sr-only"> {habit.frequency === "daily" ? "day" : "week"} streak</span>
      </span>
    </li>
  );
}

/** Today's habits as a grid of round toggles: one tap checks a habit off, the ring fills toward its target. */
export function HabitToggles({ title = "Habits", showLink = true }: { title?: string; showLink?: boolean }) {
  const habitsQuery = useHabits();
  const logsQuery = useHabitLogs();
  const habits = useMemo(() => (habitsQuery.data ?? []).filter((habit) => !habit.archived), [habitsQuery.data]);
  const logsByHabit = useMemo(() => groupLogsByHabit(logsQuery.data ?? []), [logsQuery.data]);
  const today = todayString();

  const rows = habits.map((habit) => {
    const logs = logsByHabit.get(habit.id) ?? [];
    return { habit, streak: computeStreak(habit, logs, today), todayCount: logCountsByDate(logs).get(today) ?? 0 };
  });
  const metCount = rows.filter((row) => row.streak.currentMet).length;

  return (
    <section className="pane flex flex-col gap-4 p-5" aria-labelledby="habits-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="habits-title" className="font-display text-[19px] leading-tight font-semibold tracking-[-0.02em]">
          {title}
        </h2>
        {showLink ? (
          <Link to="/habits" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            {habits.length > 0 ? `${metCount} of ${habits.length} met` : "Open"}
          </Link>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">{metCount} of {habits.length} met</span>
        )}
      </div>
      {habits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No habits yet. Add some on the Habits page.</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-x-2 gap-y-4">
          {rows.map((row) => (
            <HabitToggle key={row.habit.id} {...row} />
          ))}
        </ul>
      )}
    </section>
  );
}
