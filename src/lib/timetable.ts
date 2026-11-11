import { timeToMinutes } from "@/lib/calendarItems";
import type { ScheduleEntry } from "@/lib/schedule";

/**
 * Shortest a block is drawn, in minutes, so its title stays readable. Reminders and timed tasks have
 * no length at all and short events would shrink to a sliver; both are drawn at least this wide
 * (the real time range is still shown as text inside the block and in the list).
 */
export const MIN_BLOCK_MINUTES = 60;

const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 22;

export interface TimelineBlock {
  entry: ScheduleEntry;
  startMin: number;
  endMin: number;
  /** Row the block sits in; overlapping blocks go on separate rows. */
  lane: number;
}

export interface Timeline {
  blocks: TimelineBlock[];
  lanes: number;
  startHour: number;
  endHour: number;
}

/**
 * Lays out the timed entries of one day on a single horizontal axis. The axis covers 07:00-22:00
 * and widens when something falls outside that; overlapping blocks are stacked in lanes.
 */
export function layoutTimeline(entries: ScheduleEntry[]): Timeline {
  const timed = entries
    .map((entry) => {
      const start = timeToMinutes(entry.startTime);
      if (start === null) return null;
      const end = timeToMinutes(entry.endTime);
      const length = Math.max(end !== null && end > start ? end - start : 0, MIN_BLOCK_MINUTES);
      return { entry, startMin: start, endMin: Math.min(start + length, 24 * 60) };
    })
    .filter((block): block is Omit<TimelineBlock, "lane"> => block !== null)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const laneEnds: number[] = [];
  const blocks: TimelineBlock[] = timed.map((block) => {
    let lane = laneEnds.findIndex((end) => end <= block.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(block.endMin);
    } else {
      laneEnds[lane] = block.endMin;
    }
    return { ...block, lane };
  });

  const earliest = blocks.reduce((min, block) => Math.min(min, block.startMin), Infinity);
  const latest = blocks.reduce((max, block) => Math.max(max, block.endMin), 0);
  const startHour = Math.max(0, Math.min(DEFAULT_START_HOUR, Math.floor(earliest / 60)));
  const endHour = Math.min(24, Math.max(DEFAULT_END_HOUR, Math.ceil(latest / 60)));

  return { blocks, lanes: Math.max(1, laneEnds.length), startHour, endHour };
}

/** Left edge and width of a block as percentages of the axis. */
export function blockPosition(
  block: Pick<TimelineBlock, "startMin" | "endMin">,
  timeline: Pick<Timeline, "startHour" | "endHour">,
): { left: number; width: number } {
  const range = (timeline.endHour - timeline.startHour) * 60;
  return {
    left: ((block.startMin - timeline.startHour * 60) / range) * 100,
    width: ((block.endMin - block.startMin) / range) * 100,
  };
}
