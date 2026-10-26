import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Dumbbell, Flame, Star, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Category } from "@/lib/db/categories";
import type { Expense } from "@/lib/db/expenses";
import type { Workout } from "@/lib/db/workouts";
import { formatCompactBaht, formatTHB } from "@/lib/money";
import { workoutDate, logKeys, logKey } from "@/lib/training";
import type { WorkoutLog } from "@/lib/db/workouts";
import type { WeekReport } from "@/lib/weekReport";
import { cn } from "@/lib/utils";

interface WeekStripProps {
  report: WeekReport;
  today: string;
  workouts: Workout[];
  workoutLogs: WorkoutLog[];
  /** Confirmed expenses of the week. */
  expenses: Expense[];
  categoriesById: Map<number, Category>;
}

function Metric({ icon: Icon, active, children, label }: { icon: typeof Flame; active: boolean; children: string; label: string }) {
  return (
    <span className={cn("flex items-center gap-1 text-xs tabular-nums", active ? "text-foreground" : "text-muted-foreground/50")} aria-label={label}>
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Seven day cards with the week at a glance. Pick one for its details. */
export function WeekStrip({ report, today, workouts, workoutLogs, expenses, categoriesById }: WeekStripProps) {
  const initial = report.range.days.includes(today) ? today : (report.bestDay ?? null);
  const [selected, setSelected] = useState<string | null>(initial);

  const doneKeys = useMemo(() => logKeys(workoutLogs.filter((log) => log.weekStart === report.range.start)), [workoutLogs, report.range.start]);
  const selectedIndex = selected === null ? -1 : report.range.days.indexOf(selected);
  const day = selectedIndex === -1 ? null : report.days[selectedIndex];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div role="group" aria-label="Days of the week" className="grid grid-cols-7 gap-2">
          {report.days.map((entry) => {
            const isToday = entry.date === today;
            const isBest = entry.date === report.bestDay;
            const isFuture = entry.date > today;
            const isSelected = entry.date === selected;
            const parsed = parseISO(entry.date);
            return (
              <button
                key={entry.date}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${format(parsed, "EEEE, MMM d")}${isBest ? ", best day" : ""}`}
                onClick={() => setSelected(isSelected ? null : entry.date)}
                className={cn(
                  "relative flex min-w-0 flex-col gap-1.5 rounded-xl border px-2 py-2.5 text-left outline-none transition-colors",
                  "hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSelected && "border-primary bg-primary/10",
                  isBest && !isSelected && "border-[var(--viz-warning)]/60 bg-[var(--viz-warning)]/8",
                  isFuture && "opacity-60",
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{format(parsed, "EEE")}</span>
                  {isBest && <Star className="size-3.5 fill-[var(--viz-warning)] text-[var(--viz-warning)]" aria-hidden="true" />}
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(parsed, "d")}
                </span>
                <span className="flex flex-col gap-0.5">
                  <Metric icon={CheckCircle2} active={entry.tasksDone > 0} label={`${entry.tasksDone} tasks done`}>
                    {String(entry.tasksDone)}
                  </Metric>
                  <Metric icon={Flame} active={entry.habitsMet > 0} label={`${entry.habitsMet} of ${entry.habitsJudged} habits`}>
                    {entry.habitsJudged === 0 ? "–" : `${entry.habitsMet}/${entry.habitsJudged}`}
                  </Metric>
                  <Metric icon={Dumbbell} active={entry.workoutsDone > 0} label={`${entry.workoutsDone} of ${entry.workoutsPlanned} workouts`}>
                    {entry.workoutsPlanned === 0 ? "–" : `${entry.workoutsDone}/${entry.workoutsPlanned}`}
                  </Metric>
                  <Metric icon={Wallet} active={entry.spentSatang > 0} label={`${formatTHB(entry.spentSatang)} spent`}>
                    {entry.spentSatang > 0 ? formatCompactBaht(entry.spentSatang) : "–"}
                  </Metric>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {report.bestDay !== null ? (
            <p className="flex items-center gap-1.5">
              <Star className="size-3.5 fill-[var(--viz-warning)] text-[var(--viz-warning)]" aria-hidden="true" />
              Best day: {format(parseISO(report.bestDay), "EEEE")}, the most tasks, habits and workouts done.
            </p>
          ) : (
            <span />
          )}
          <p className="flex items-center gap-3" aria-hidden="true">
            <span className="flex items-center gap-1"><CheckCircle2 className="size-3" /> tasks</span>
            <span className="flex items-center gap-1"><Flame className="size-3" /> habits</span>
            <span className="flex items-center gap-1"><Dumbbell className="size-3" /> workouts</span>
            <span className="flex items-center gap-1"><Wallet className="size-3" /> spent</span>
          </p>
        </div>

        {day && selected && (
          <DayDetails
            date={selected}
            report={report}
            index={selectedIndex}
            workouts={workouts.filter((workout) => workoutDate(report.range.start, workout.dayOfWeek) === selected)}
            doneKeys={doneKeys}
            expenses={expenses.filter((expense) => expense.date === selected)}
            today={today}
            categoriesById={categoriesById}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface DayDetailsProps {
  date: string;
  report: WeekReport;
  index: number;
  workouts: Workout[];
  doneKeys: Set<string>;
  expenses: Expense[];
  today: string;
  categoriesById: Map<number, Category>;
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="min-w-0">
      <h4 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h4>
      {children.length === 0 ? <p className="text-sm text-muted-foreground/70">{empty}</p> : <ul className="flex flex-col gap-1 text-sm">{children}</ul>}
    </div>
  );
}

function DayDetails({ date, report, index, workouts, doneKeys, expenses, today, categoriesById }: DayDetailsProps) {
  const tasks = report.completed.filter((task) => task.completedAt !== null && format(parseISO(task.completedAt), "yyyy-MM-dd") === date);
  const habits = report.habitWeeks.filter((week) => week.days[index] === "met" || week.days[index] === "logged");

  return (
    <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
      <h3 className="sr-only">Details for {format(parseISO(date), "EEEE, MMMM d")}</h3>
      <Section title="Tasks done" empty="None completed.">
        {tasks.map((task) => (
          <li key={task.id} className="truncate">
            {task.title}
          </li>
        ))}
      </Section>
      <Section title="Habits" empty="None met.">
        {habits.map((week) => (
          <li key={week.habit.id} className="flex items-center gap-2 truncate">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: week.habit.color }} aria-hidden="true" />
            {week.habit.name}
          </li>
        ))}
      </Section>
      <Section title="Training" empty="No workout planned.">
        {workouts.map((workout) => {
          const done = doneKeys.has(logKey(workout.id, report.range.start));
          return (
            <li key={workout.id} className="flex items-center gap-2 truncate">
              <span className={cn("size-2 shrink-0 rounded-full", done ? "bg-emerald-400" : "border border-muted-foreground/60")} aria-hidden="true" />
              {workout.title}
              <span className="text-xs text-muted-foreground">{done ? "done" : date < today ? "missed" : "planned"}</span>
            </li>
          );
        })}
      </Section>
      <Section title="Spending" empty="Nothing spent.">
        {expenses.map((expense) => (
          <li key={expense.id} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: categoriesById.get(expense.categoryId)?.color ?? "#9CA3AF" }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{expense.note || categoriesById.get(expense.categoryId)?.name || "Expense"}</span>
            <span className="tabular-nums text-muted-foreground">{formatTHB(expense.amountSatang)}</span>
          </li>
        ))}
      </Section>
    </div>
  );
}
