import { useMemo } from "react";
import { format } from "date-fns";
import { CountdownPanel } from "@/components/home/CountdownPanel";
import { HabitToggles } from "@/components/home/HabitToggles";
import { HomeTasks } from "@/components/home/HomeTasks";
import { NextUpCard } from "@/components/home/NextUpCard";
import { ProjectProgressWidget } from "@/components/home/ProjectProgressWidget";
import { NowPlayingCard } from "@/components/home/NowPlayingCard";
import { SpentThisMonthWidget } from "@/components/home/SpentThisMonthWidget";
import { SunDial } from "@/components/home/SunDial";
import { TodayAgenda } from "@/components/home/TodayAgenda";
import { TodayTrainingWidget } from "@/components/home/TodayTrainingWidget";
import { useDayEntries } from "@/hooks/useDay";
import { useExpenses } from "@/hooks/useExpenses";
import { useProjects } from "@/hooks/useProjects";
import { useSetTaskStatus, useTasks } from "@/hooks/useTasks";
import { bangkokToday } from "@/lib/bangkok";
import { todayString } from "@/lib/dates";
import type { Task } from "@/lib/db/tasks";
import { confirmedOnly, sumSatang } from "@/lib/expenses";
import { useGreeting } from "@/lib/greetings";
import { formatTHB } from "@/lib/money";
import { dueTodayTasks, overdueTasks, upcomingWithin } from "@/lib/taskViews";

const UPCOMING_DAYS = 30;

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export default function HomePage() {
  const tasksQuery = useTasks();
  const projectsQuery = useProjects();
  const expensesQuery = useExpenses();
  const setStatus = useSetTaskStatus();
  const greeting = useGreeting();
  const { entries: todayEntries } = useDayEntries(todayString());

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const overdue = useMemo(() => overdueTasks(tasks), [tasks]);
  const dueToday = useMemo(() => dueTodayTasks(tasks), [tasks]);
  const upcoming = useMemo(() => upcomingWithin(tasks, UPCOMING_DAYS), [tasks]);
  const spentToday = useMemo(() => {
    const today = bangkokToday();
    return sumSatang(confirmedOnly(expensesQuery.data ?? []).filter((expense) => expense.date === today));
  }, [expensesQuery.data]);

  // The day in one sentence, in its own numbers.
  const open = todayEntries.filter((entry) => !entry.done).length;
  const summary = [
    todayEntries.length === 0 ? "Nothing planned today" : `${plural(open, "thing")} still open today`,
    overdue.length > 0 ? `${overdue.length} overdue` : null,
    spentToday > 0 ? `${formatTHB(spentToday)} spent` : "nothing spent yet",
  ]
    .filter(Boolean)
    .join(", ");

  function complete(task: Task) {
    setStatus.mutate({ id: task.id, status: "done" });
  }

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3">
      {/* Hero: set straight on the sky, no pane. */}
      <header className="grid grid-cols-[minmax(0,1fr)_minmax(180px,300px)] items-end gap-x-8 px-1 pt-4 pb-3">
        <div className="min-w-0 pb-2">
          <p className="text-sm font-medium text-foreground/75">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1 className="mt-1 font-display text-[clamp(40px,4.4vw,60px)] leading-[0.95] font-semibold tracking-[-0.04em] text-balance">
            {greeting.title}.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[15px] text-foreground/85 xl:text-[16px]">
            {summary}. <span className="text-foreground/65">{greeting.message}</span>
          </p>
        </div>
        <SunDial />
      </header>

      {(tasksQuery.isError || projectsQuery.isError) && (
        <p className="pane px-5 py-3 text-sm text-destructive">
          Could not load data: {String(tasksQuery.error ?? projectsQuery.error)}
        </p>
      )}

      {/*
        Two rows that line up across the columns. Wide windows: the day spans both rows on the left; Next up
        and Now playing share row 1 (so they are the same height); Tasks and the habits/training/money stack
        share row 2 (Tasks and the last card stretch, so every column ends on the same line). The day only
        fills the height the others set, scrolling inside, so its long list never stretches the page.
        Medium windows: the day beside Next up and Tasks, then Now playing beside the stack.
      */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:relative lg:col-span-6 lg:row-span-2 lg:min-h-[480px] xl:col-span-5">
          <div className="lg:absolute lg:inset-0">
            <TodayAgenda />
          </div>
        </div>
        <div className="flex flex-col lg:col-span-6 xl:col-span-4 xl:col-start-6 xl:row-start-1 [&>*]:grow">
          <NextUpCard nextDeadline={upcoming[0]} />
        </div>
        <div className="flex flex-col lg:col-span-6 xl:col-span-4 xl:col-start-6 xl:row-start-2 [&>*]:grow">
          <HomeTasks
            overdue={overdue}
            today={dueToday}
            upcoming={upcoming}
            upcomingDays={UPCOMING_DAYS}
            projectsById={projectsById}
            onComplete={complete}
          />
        </div>
        {/* Matches Next up's height on wide windows only; beside the stack on medium windows it keeps its own. */}
        <div className="flex flex-col self-start lg:col-span-6 xl:col-span-3 xl:col-start-10 xl:row-start-1 xl:self-stretch xl:[&>*]:grow">
          <NowPlayingCard />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-6 xl:col-span-3 xl:col-start-10 xl:row-start-2 [&>*]:h-auto [&>*]:shrink-0 [&>*:last-child]:grow">
          {/* Cards keep their full height (never squeezed); only the last one grows to fill the column. */}
          <HabitToggles />
          <TodayTrainingWidget />
          <SpentThisMonthWidget />
        </div>
      </div>

      <CountdownPanel tasks={tasks} projectsById={projectsById} />
      <ProjectProgressWidget projects={projects} />
    </div>
  );
}
