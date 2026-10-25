import { Link } from "react-router-dom";
import { Timer } from "lucide-react";
import { useRemainingMs } from "@/hooks/useTimerDisplay";
import { formatClock, PHASE_LABELS, useFocusTimer } from "@/lib/focusTimer";

/** Shows the running timer in the sidebar from any page; hidden while the timer is idle. */
export function SidebarTimer() {
  const status = useFocusTimer((state) => state.status);
  const phase = useFocusTimer((state) => state.phase);
  const remainingMs = useRemainingMs();

  if (status === "idle") return null;

  return (
    <Link
      to="/focus"
      className="mt-auto flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
    >
      <Timer className="size-4 text-muted-foreground" />
      <span className="flex-1 text-muted-foreground">
        {PHASE_LABELS[phase]}
        {status === "paused" && " (paused)"}
      </span>
      <span className="font-medium tabular-nums">{formatClock(remainingMs)}</span>
    </Link>
  );
}
