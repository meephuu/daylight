import { useEffect, useState } from "react";
import { useFocusTimer } from "@/lib/focusTimer";

/** Time left on the timer, re-rendering about four times a second while it runs. */
export function useRemainingMs(): number {
  const status = useFocusTimer((state) => state.status);
  const endsAt = useFocusTimer((state) => state.endsAt);
  const remainingMs = useFocusTimer((state) => state.remainingMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "running") return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [status]);

  return status === "running" && endsAt !== null ? Math.max(0, endsAt - now) : remainingMs;
}
