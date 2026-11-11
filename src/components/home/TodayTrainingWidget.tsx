import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSetWorkoutDone, useWorkoutLogs, useWorkouts } from "@/hooks/useWorkouts";
import { todayString } from "@/lib/dates";
import { weekRange } from "@/lib/review";
import { appliesToWeek, CATEGORY_INFO, dayIndexOf, logKey, logKeys } from "@/lib/training";
import { workoutTimeLabel } from "@/components/training/WorkoutCard";
import { cn } from "@/lib/utils";

export function TodayTrainingWidget() {
  const workoutsQuery = useWorkouts();
  const logsQuery = useWorkoutLogs();
  const setDone = useSetWorkoutDone();

  const today = todayString();
  const weekStart = useMemo(() => weekRange(new Date()).start, []);
  const doneKeys = useMemo(() => logKeys(logsQuery.data ?? []), [logsQuery.data]);

  const all = workoutsQuery.data ?? [];
  const todays = useMemo(
    () => all.filter((workout) => workout.dayOfWeek === dayIndexOf(today) && appliesToWeek(workout, weekStart)),
    [all, today, weekStart],
  );

  const doneToday = todays.filter((workout) => doneKeys.has(logKey(workout.id, weekStart))).length;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline gap-x-2">
          Today's training
          {todays.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {doneToday}/{todays.length} done
            </span>
          )}
        </CardTitle>
        <CardAction>
          <Link to="/training" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Open plan
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {all.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No training plan yet. <Link to="/training" className="underline">Set up your week</Link>.
          </p>
        ) : todays.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Rest day. Recover well.</p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {todays.map((workout) => {
              const done = doneKeys.has(logKey(workout.id, weekStart));
              const time = workoutTimeLabel(workout);
              return (
                <li key={workout.id} className="flex h-9 items-center gap-3 rounded-lg px-2 hover:bg-foreground/[0.05]">
                  <Checkbox
                    checked={done}
                    onCheckedChange={() =>
                      setDone.mutate({ workoutId: workout.id, weekStart, doneDate: today, done: !done })
                    }
                    aria-label={done ? "Mark as not done" : "Mark as done"}
                  />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_INFO[workout.category].color }}
                  />
                  <span className={cn("min-w-0 flex-1 truncate text-sm", done && "text-muted-foreground line-through")}>
                    {workout.title}
                  </span>
                  {time && <span className="shrink-0 text-xs text-muted-foreground">{time}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
