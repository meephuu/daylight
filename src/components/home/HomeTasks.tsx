import { useEffect, useLayoutEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Segmented } from "@/components/Segmented";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDueDateTime, isOverdue } from "@/lib/dates";
import type { Project } from "@/lib/db/projects";
import type { Task } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";

/** Where the card is not stretched by its neighbours (narrow windows), it shows this many. */
const LIMIT = 7;
/** From this width Home lines its columns up (Home.tsx) and the card fills its height with tasks. */
const FILL_QUERY = "(min-width: 1280px)";

function useMatches(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/**
 * How many of a list's rows fit its box whole. The list sits in a box that takes the card's leftover
 * height (and adds none of its own), so rows past the bottom are counted out instead of cut in half.
 */
function useRowsThatFit(list: HTMLUListElement | null, rows: number): number {
  const [fit, setFit] = useState(rows);
  useLayoutEffect(() => {
    if (!list) return;
    const measure = () => {
      const limit = list.clientHeight;
      let count = 0;
      for (const item of Array.from(list.children) as HTMLElement[]) {
        if (item.offsetTop + item.offsetHeight > limit + 1) break;
        count += 1;
      }
      setFit(count);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [list, rows]);
  return fit;
}

interface HomeTasksProps {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  upcomingDays: number;
  projectsById: Map<number, Project>;
  onComplete: (task: Task) => void;
}

function TaskRow({
  task,
  project,
  onComplete,
  hidden = false,
}: {
  task: Task;
  project: Project | undefined;
  onComplete: (task: Task) => void;
  /** Past the bottom of the card: kept for measuring, but out of sight and out of reach. */
  hidden?: boolean;
}) {
  const late = isOverdue(task.dueDate);
  return (
    // Hidden rows use visibility: hidden, which also takes them out of the tab order and screen readers.
    <li
      className={cn("flex min-h-10 shrink-0 items-center gap-3 rounded-2xl px-2.5 py-1.5 transition-colors hover:bg-foreground/[0.05]", hidden && "invisible")}
    >
      <Checkbox checked={false} onCheckedChange={() => onComplete(task)} aria-label={`Mark ${task.title} as done`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {task.dueDate && (
            <span className={cn("flex items-center gap-1 tabular-nums", late && "font-medium text-destructive")}>
              {late && <AlertTriangle className="size-3" aria-label="Overdue" />}
              {formatDueDateTime(task.dueDate, task.dueTime)}
            </span>
          )}
          {project && (
            <span className="flex min-w-0 items-center gap-1">
              <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
              <span className="truncate">{project.name}</span>
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

/** Tasks on Home: what is due now (late first) or what is coming, one pane with a two-way switch. */
export function HomeTasks({ overdue, today, upcoming, upcomingDays, projectsById, onComplete }: HomeTasksProps) {
  const due = [...overdue, ...today];
  const [view, setView] = useState<"due" | "upcoming">(due.length > 0 ? "due" : "upcoming");
  const list = view === "due" ? due : upcoming;
  // Wide windows: as many as fit the card. Otherwise a fixed handful.
  const fill = useMatches(FILL_QUERY);
  const [listEl, setListEl] = useState<HTMLUListElement | null>(null);
  const fit = useRowsThatFit(fill ? listEl : null, list.length);
  const shownCount = fill ? Math.min(fit, list.length) : Math.min(LIMIT, list.length);
  const hidden = list.length - shownCount;

  const options = [
    { value: "due" as const, label: "Due", count: due.length },
    { value: "upcoming" as const, label: "Upcoming", count: upcoming.length },
  ];

  return (
    <section className="pane flex flex-col gap-3 p-5" aria-labelledby="home-tasks-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-tasks-title" className="font-display text-[19px] leading-tight font-semibold tracking-[-0.02em]">
          Tasks
        </h2>
        <Segmented
          aria-label="Which tasks"
          semantics="tabs"
          size="sm"
          value={view}
          onChange={setView}
          options={options.map((option) => ({ value: option.value, label: option.label, meta: option.count }))}
        />
      </div>

      {view === "due" && overdue.length > 0 && (
        <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-destructive">
          <AlertTriangle className="size-3.5" aria-hidden="true" />
          {overdue.length} overdue
        </p>
      )}

      {list.length === 0 ? (
        <p key={view} className="fade-in py-6 text-center text-sm text-muted-foreground">
          {view === "due" ? "Nothing due today." : `Nothing due in the next ${upcomingDays} days.`}
        </p>
      ) : (
        <ul
          key={view}
          ref={setListEl}
          // When filling, the list takes the card's leftover height and contributes none, so the other
          // columns decide the card's height and the rows fill it; rows that do not fit are hidden whole.
          className={cn("fade-in -mx-1 flex flex-col", fill && "min-h-0 flex-1 overflow-hidden")}
        >
          {(fill ? list : list.slice(0, LIMIT)).map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              project={task.projectId === null ? undefined : projectsById.get(task.projectId)}
              onComplete={onComplete}
              hidden={index >= shownCount}
            />
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <Link to="/tasks" className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          {hidden} more on Tasks
        </Link>
      )}
    </section>
  );
}
