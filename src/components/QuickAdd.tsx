import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCreateTask } from "@/hooks/useTasks";
import { normalizeTags } from "@/lib/db/tasks";

interface QuickAddProps {
  dueDate: string | null;
  projectId: number | null;
  /** Changing this value (e.g. a timestamp from the tray menu) moves focus into the input. */
  focusSignal?: number;
}

/** "Buy milk #home #errand" -> title "Buy milk", tags ["home", "errand"]. */
export function parseQuickAdd(text: string): { title: string; tags: string[] } {
  const tags: string[] = [];
  const title = text
    .replace(/(^|\s)#([^\s#,]+)/g, (_match, _space: string, tag: string) => {
      tags.push(tag);
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { title, tags: normalizeTags(tags) };
}

export function QuickAdd({ dueDate, projectId, focusSignal }: QuickAddProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSignal !== undefined) inputRef.current?.focus();
  }, [focusSignal]);
  const createTask = useCreateTask();

  async function submit() {
    const { title, tags } = parseQuickAdd(text);
    if (!title) return;
    await createTask.mutateAsync({
      title,
      notes: "",
      status: "todo",
      priority: "medium",
      dueDate,
      projectId,
      tags,
    });
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Ignore Enter while an IME composition is active.
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="relative">
      <Plus className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Add a task and press Enter  (use #tags)"
        className="h-10 pl-9"
        disabled={createTask.isPending}
      />
    </div>
  );
}
