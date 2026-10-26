import { Flame, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeStreak } from "@/lib/habits";
import type { HabitLog } from "@/lib/db/habits";
import type { HabitDayStatus } from "@/lib/review";
import type { WeekReport } from "@/lib/weekReport";
import { cn } from "@/lib/utils";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const STATUS_LABEL: Record<HabitDayStatus, string> = {
  met: "met",
  logged: "logged",
  missed: "missed",
  pending: "not done yet today",
  future: "upcoming",
  before: "before the habit started",
};

function Cell({ status, color, label }: { status: HabitDayStatus; color: string; label: string }) {
  const style =
    status === "met"
      ? { backgroundColor: color }
      : status === "logged"
        ? { backgroundColor: `color-mix(in srgb, ${color} 55%, transparent)` }
        : status === "pending"
          ? { border: `1.5px dashed ${color}` }
          : undefined;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "block size-7 rounded-md",
        status === "missed" && "bg-rose-500/20 ring-1 ring-rose-500/30 ring-inset",
        (status === "future" || status === "before") && "bg-muted/40",
      )}
      style={style}
    />
  );
}

interface HabitHeatmapProps {
  report: WeekReport;
  today: string;
  logsByHabit: Map<number, HabitLog[]>;
}

/** Habits as rows, the seven days as columns; each cell is coloured by how that day went. */
export function HabitHeatmap({ report, today, logsByHabit }: HabitHeatmapProps) {
  const rows = report.habitWeeks.map((week) => ({
    week,
    streak: computeStreak(week.habit, logsByHabit.get(week.habit.id) ?? [], today),
  }));
  const longest = rows.reduce<(typeof rows)[number] | null>((best, row) => (row.streak.current > (best?.streak.current ?? 0) ? row : best), null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Habits</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No habits to review yet.</p>
        ) : (
          <>
            {longest && longest.streak.current >= 2 && (
              <p className="flex items-center gap-2 rounded-lg bg-[var(--viz-warning)]/10 px-3 py-2 text-sm">
                <Trophy className="size-4 text-[var(--viz-warning)]" aria-hidden="true" />
                Longest streak right now: <strong className="font-medium">{longest.week.habit.name}</strong>,{" "}
                {longest.streak.current} {longest.week.habit.frequency === "daily" ? "days" : "weeks"} in a row.
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] border-separate border-spacing-y-1.5">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left font-normal">
                      <span className="sr-only">Habit</span>
                    </th>
                    {report.range.days.map((date, index) => (
                      <th key={date} className={cn("w-9 text-center font-medium", date === today && "text-foreground")}>
                        <span aria-hidden="true">{DAY_LETTERS[index]}</span>
                        <span className="sr-only">{date}</span>
                        {date === today && <span className="mx-auto mt-0.5 block size-1 rounded-full bg-primary" aria-hidden="true" />}
                      </th>
                    ))}
                    <th className="w-14 text-right font-normal">Score</th>
                    <th className="w-20 text-right font-normal">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ week, streak }) => (
                    <tr key={week.habit.id}>
                      <td className="pr-3">
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: week.habit.color }} aria-hidden="true" />
                          <span className="truncate font-medium">{week.habit.name}</span>
                        </span>
                        <span className="block pl-[18px] text-xs text-muted-foreground">
                          {week.habit.frequency === "daily"
                            ? `${week.habit.targetPerPeriod}× a day`
                            : `${week.habit.targetPerPeriod}× a week · ${week.achieved} so far`}
                        </span>
                      </td>
                      {week.days.map((status, index) => (
                        <td key={report.range.days[index]} className="text-center">
                          <span className="inline-block">
                            <Cell status={status} color={week.habit.color} label={`${week.habit.name}, ${report.range.days[index]}: ${STATUS_LABEL[status]}`} />
                          </span>
                        </td>
                      ))}
                      <td className="text-right text-sm tabular-nums">{week.ratio === null ? "–" : `${Math.round(week.ratio * 100)}%`}</td>
                      <td className="text-right">
                        <span className="inline-flex items-center justify-end gap-1 text-sm tabular-nums" title={`Best streak: ${streak.best}`}>
                          <Flame className={cn("size-4", streak.current > 0 ? "text-orange-400" : "text-muted-foreground/40")} aria-hidden="true" />
                          {streak.current}
                          <span className="text-xs text-muted-foreground">/ best {streak.best}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
              <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-foreground/80" /> met</li>
              <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-foreground/40" /> logged</li>
              <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-rose-500/20 ring-1 ring-rose-500/30 ring-inset" /> missed</li>
              <li className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-dashed border-foreground/60" /> today, still open</li>
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
