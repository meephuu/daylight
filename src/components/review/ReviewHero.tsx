import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { ProgressRing } from "@/components/review/ProgressRing";
import { Card } from "@/components/ui/card";
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
        good === null ? "text-muted-foreground" : good ? "text-emerald-400" : "text-rose-400",
      )}
    >
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {format(Math.abs(value))} vs last week
    </span>
  );
}

function StatChip({ label, value, children }: { label: string; value: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border bg-background/40 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-xl font-semibold tabular-nums">{value}</p>
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
    <Card
      className="overflow-hidden"
      style={{ backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${color} 16%, transparent), transparent 65%)` }}
    >
      <div className="flex flex-col gap-5 px-5 py-1 sm:px-6">
        <div className="flex flex-wrap items-center gap-5">
          <ProgressRing value={(report.score ?? 0) / 100} size={112} stroke={10} color={color} label="Week score">
            {report.score === null ? (
              <span className="text-2xl font-semibold text-muted-foreground">–</span>
            ) : (
              <>
                <span className="text-3xl leading-none font-semibold tabular-nums">{report.score}</span>
                <span className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">score</span>
              </>
            )}
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <h2 className="text-2xl leading-tight font-semibold sm:text-3xl">{headline.title}</h2>
            {!isFutureWeek && <p className="mt-1 text-sm text-muted-foreground">{recap}</p>}
            {report.score !== null && (
              <div className="mt-1.5">
                <Delta value={scoreChange} format={(points) => `${points} point${points === 1 ? "" : "s"}`} better="up" />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
      </div>
    </Card>
  );
}
