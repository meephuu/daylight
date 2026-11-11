import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatTHB } from "@/lib/money";
import { change, headlineFor, type Headline, type WeekReport } from "@/lib/weekReport";
import { cn } from "@/lib/utils";

const TONE_COLOR: Record<Headline["tone"], string> = {
  great: "#34d399",
  good: "#60a5fa",
  ok: "#fab219",
  low: "#f87171",
  none: "#9ca3af",
};

interface DeltaProps {
  value: number | null;
  /** Formats the size of the change, e.g. "3" or "THB 400.00". */
  format: (magnitude: number) => string;
  /** Whether going up is good, bad or just information. */
  better: "up" | "down" | "neutral";
}

function Delta({ value, format, better }: DeltaProps) {
  if (value === null) return <span className="text-xs text-muted-foreground">no data last week</span>;
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3" /> same as last week
      </span>
    );
  }
  const up = value > 0;
  const good = better === "neutral" ? null : (better === "up") === up;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        good === null ? "text-muted-foreground" : good ? "text-success" : "text-destructive",
      )}
    >
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {format(Math.abs(value))} vs last week
    </span>
  );
}

/** One of the week's four numbers, set as type on the sky. */
function StatChip({ label, value, children }: { label: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-l border-foreground/15 pl-5">
      <p className="text-sm text-foreground/75">{label}</p>
      <p className="truncate font-display text-[30px] leading-none font-semibold tracking-[-0.03em]">{value}</p>
      {children}
    </div>
  );
}

interface ReviewHeroProps {
  report: WeekReport;
  previous: WeekReport;
  isFutureWeek: boolean;
}

export function ReviewHero({ report, previous, isFutureWeek }: ReviewHeroProps) {
  const headline = headlineFor(report.score, isFutureWeek);
  const color = TONE_COLOR[headline.tone];
  const previousScore = previous.score;
  const scoreChange = change(report.score, previousScore);

  const tasksDone = report.completed.length;
  const training = report.training;
  const habitPercent = report.consistency === null ? null : Math.round(report.consistency * 100);
  const previousHabitPercent = previous.consistency === null ? null : Math.round(previous.consistency * 100);

  const recap = [
    `${tasksDone} task${tasksDone === 1 ? "" : "s"} done`,
    training.planned > 0 ? `${training.done} of ${training.planned} workouts` : null,
    habitPercent === null ? null : `${habitPercent}% habits`,
    `${formatTHB(report.money.spentSatang)} spent`,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return (
    // The week's verdict, set on the sky: the score as the biggest number on the page, its headline beside it.
    <section className="flex flex-col gap-7 px-1 pb-2" aria-label="Week score">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="flex flex-col">
          <span className="display-num text-[120px]" aria-label={report.score === null ? "No score" : `Score ${report.score} of 100`}>
            {report.score ?? "–"}
          </span>
          {/* The score on its 0-100 track, in the verdict's colour. */}
          <span className="mt-3 h-1.5 w-full min-w-40 overflow-hidden rounded-full bg-foreground/15" aria-hidden="true">
            <span className="block h-full rounded-full" style={{ width: `${report.score ?? 0}%`, backgroundColor: color }} />
          </span>
        </div>

        <div className="min-w-0 flex-1 pb-4">
          <h2 className="flex items-center gap-3 font-display text-[40px] leading-[1.05] font-semibold tracking-[-0.03em]">
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            {headline.title}
          </h2>
          {!isFutureWeek && <p className="mt-2 text-[15px] text-foreground/80">{recap}</p>}
          {report.score !== null && (
            <div className="mt-1.5">
              <Delta value={scoreChange} format={(points) => `${points} point${points === 1 ? "" : "s"}`} better="up" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          <StatChip label="Tasks done" value={tasksDone}>
            <Delta value={change(tasksDone, previous.completed.length)} format={String} better="up" />
          </StatChip>
          <StatChip label="Workouts" value={training.planned > 0 ? `${training.done}/${training.planned}` : "–"}>
            <Delta value={training.planned > 0 ? change(training.done, previous.training.done) : null} format={String} better="up" />
          </StatChip>
          <StatChip label="Habits" value={habitPercent === null ? "–" : `${habitPercent}%`}>
            <Delta value={change(habitPercent, previousHabitPercent)} format={(points) => `${points} pts`} better="up" />
          </StatChip>
          <StatChip label="Spent" value={formatTHB(report.money.spentSatang)}>
            <Delta
              value={change(report.money.spentSatang, previous.money.spentSatang)}
              format={(satang) => formatTHB(satang)}
              better="down"
            />
          </StatChip>
      </div>
    </section>
  );
}
