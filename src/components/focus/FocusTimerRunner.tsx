import { useEffect, useRef } from "react";
import { useCreateFocusSession } from "@/hooks/useFocusSessions";
import { useTimerConfig } from "@/hooks/useTimerConfig";
import { playChime, useFocusTimer } from "@/lib/focusTimer";

/**
 * Mounted once in the app layout (renders nothing) so the timer keeps counting, saving sessions
 * and chiming no matter which page is open.
 */
export function FocusTimerRunner() {
  const config = useTimerConfig();
  const createSession = useCreateFocusSession();
  const status = useFocusTimer((state) => state.status);
  const pendingSave = useFocusTimer((state) => state.pendingSave);
  const completions = useFocusTimer((state) => state.completions);
  const seenCompletions = useRef(completions);

  useEffect(() => {
    useFocusTimer.getState().setConfig(config);
  }, [config]);

  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => useFocusTimer.getState().tick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (!pendingSave) return;
    createSession.mutate(pendingSave);
    useFocusTimer.getState().clearPendingSave();
  }, [pendingSave, createSession]);

  useEffect(() => {
    if (completions === seenCompletions.current) return;
    seenCompletions.current = completions;
    playChime();
  }, [completions]);

  return null;
}
