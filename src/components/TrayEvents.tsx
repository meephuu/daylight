import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";

/** Reacts to tray menu actions sent from Rust (renders nothing). */
export function TrayEvents() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listen("quick-add-task", () => {
      // A fresh timestamp makes the Tasks page focus its input even if it is already open.
      navigate("/tasks", { state: { quickAddSignal: Date.now() } });
    }).then((stop) => {
      if (cancelled) stop();
      else unlisten = stop;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [navigate]);

  return null;
}
