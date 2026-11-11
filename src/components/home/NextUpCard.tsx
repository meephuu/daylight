import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Moon } from "lucide-react";
import { useDayEntries, useNowMinutes } from "@/hooks/useDay";
import { timeToMinutes } from "@/lib/calendarItems";
import { formatDueDateTime, todayString } from "@/lib/dates";
import type { Task } from "@/lib/db/tasks";
import { ENTRY_KIND_LABELS, type ScheduleEntry } from "@/lib/schedule";

function untilLabel(minutes: number): string {
  if (minutes <= 0) return "starting now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `in ${hours} h` : `in ${hours} h ${rest} min`;
}

interface NextUpCardProps {
  /** The soonest open deadline, shown when today's timeline has nothing left. */
  nextDeadline: Task | undefined;
}

/**
 * What comes after now, always one glance away: the next timed thing today (or the one happening
 * right now), and what follows it. The slab carries the colour of the hour.
 */
export function NextUpCard({ nextDeadline }: NextUpCardProps) {
  const now = useNowMinutes();
  const { entries } = useDayEntries(todayString());

  const { current, upcoming } = useMemo(() => {
    let current: ScheduleEntry | undefined;
    const upcoming: ScheduleEntry[] = [];
    for (const entry of entries) {
      if (entry.done) continue;
      const start = timeToMinutes(entry.startTime);
      if (start === null) continue;
      const end = timeToMinutes(entry.endTime);
      if (start <= now && end !== null && end > now) current ??= entry;
      else if (start >= now) upcoming.push(entry);
    }
    return { current, upcoming };
  }, [entries, now]);

  const lead = current ?? upcoming[0];
  const then = current ? upcoming[0] : upcoming[1];
  const leadStart = lead ? (timeToMinutes(lead.startTime) ?? now) : now;

  return (
    <section
      className="flex min-h-60 flex-col justify-between gap-6 rounded-[26px] p-6 shadow-[inset_0_1px_0_var(--glass-edge),inset_0_0_0_1px_var(--glass-rim),var(--glass-shadow)] backdrop-blur-[22px]"
      style={{
        // The hour's colour, poured through the glass.
        background:
          "linear-gradient(150deg, color-mix(in srgb, var(--sky-accent) 46%, transparent), color-mix(in srgb, var(--sky-accent) 14%, transparent) 75%), var(--glass-fill)",
      }}
    >
      <h2 className="font-display text-[19px] leading-tight font-semibold tracking-[-0.02em]">
        {current ? "Happening now" : "Next up"}
        {lead && !current && <span className="ml-2 font-sans text-sm font-normal text-foreground/75">{untilLabel(leadStart - now)}</span>}
      </h2>

      {lead ? (
        <div className="min-w-0">
          <p className="display-num text-[56px]">
            {current && lead.endTime ? `until ${lead.endTime}` : lead.startTime}
          </p>
          <p className="mt-2 flex items-center gap-2 text-base font-medium">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: lead.color }} />
            <span className="truncate">{lead.title}</span>
          </p>
          <p className="mt-0.5 text-sm text-foreground/75">{ENTRY_KIND_LABELS[lead.kind]}</p>
        </div>
      ) : nextDeadline?.dueDate ? (
        // Today's timeline is done: the next deadline takes the lead instead.
        <div className="min-w-0">
          <p className="text-sm text-foreground/80">Today's timeline is clear. Next deadline</p>
          <p className="display-num mt-2 text-[40px]">
            {formatDueDateTime(nextDeadline.dueDate, nextDeadline.dueTime)}
          </p>
          <p className="mt-1 line-clamp-2 text-base font-medium">{nextDeadline.title}</p>
        </div>
      ) : (
        <div className="min-w-0">
          <Moon className="size-7 text-foreground/80" />
          <p className="mt-3 text-base font-medium">Nothing else on today's timeline, and no deadlines ahead.</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-foreground/10 pt-3 text-sm">
        <span className="line-clamp-2 min-w-0 text-foreground/80">
          {then ? (
            <>
              Then <span className="font-medium text-foreground">{then.title}</span> at {then.startTime}
            </>
          ) : (
            "Nothing after that"
          )}
        </span>
        <Link
          to="/calendar"
          className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground/85 underline-offset-4 hover:text-foreground hover:underline"
        >
          Calendar
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
