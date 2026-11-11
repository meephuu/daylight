import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import {
  applyShortcut,
  convertTo,
  hasList,
  insertItemAfter,
  lineIndexAt,
  normalizeRows,
  parseRows,
  pressBackspaceAtStart,
  pressEnter,
  revertConversion,
  serializeRows,
  setText,
  shortcutFromLine,
  splitOnNewlines,
  toggleItem,
  type Conversion,
  type RowEdit,
} from "@/lib/noteRows";
import { cn } from "@/lib/utils";

export interface NoteBodyHandle {
  /** Turns the line being edited into a checkbox item, or adds a new checkbox below it. */
  addCheckbox: () => void;
}

interface NoteBodyProps {
  content: string;
  onChange: (content: string) => void;
  onBlur: () => void;
}

const TEXT_CLASS = "text-[15px] leading-relaxed placeholder:text-current placeholder:opacity-40";

/**
 * The writing area of a post-it. A note without lists is one plain textarea, as it always was.
 * Typing "- " (bullet), "1. " (numbered) or "[] " (checkbox) at the start of a line, or pressing the
 * checkbox button, turns the note into one editable row per line where Enter, Backspace and the arrow
 * keys behave like a notes app's list. The saved text stays plain ("- item", "1. item", "- [ ] item").
 * Ctrl+Z straight after a conversion puts the line back the way it was (a bullet becomes plain text).
 */
export const NoteBody = forwardRef<NoteBodyHandle, NoteBodyProps>(function NoteBody({ content, onChange, onBlur }, ref) {
  const [listMode, setListMode] = useState(() => hasList(content));
  const caret = useRef(content.length);
  const rowRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const focusedRow = useRef<number | null>(null);
  const pendingFocus = useRef<{ index: number; caret: number } | null>(null);
  /** The latest list conversion, which Ctrl+Z can undo. Any other structural edit forgets it. */
  const lastConversion = useRef<Conversion | null>(null);
  const rows = useMemo(() => parseRows(content), [content]);
  // Numbers shown are always the counted ones, even if the saved text had them out of order.
  const view = useMemo(() => normalizeRows(rows), [rows]);

  function focusRow(index: number, position: number) {
    const element = rowRefs.current[index];
    if (!element) return;
    element.focus();
    element.setSelectionRange(position, position);
  }

  // Runs after every render: puts the caret where the last edit asked for, and fits each row to its text.
  useLayoutEffect(() => {
    if (pendingFocus.current) {
      const { index, caret: position } = pendingFocus.current;
      pendingFocus.current = null;
      focusRow(index, position);
    }
    for (const element of rowRefs.current) {
      if (!element) continue;
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  });

  function apply(edit: RowEdit) {
    lastConversion.current = null;
    const next = serializeRows(edit.rows);
    if (next === content) {
      focusRow(edit.focus.index, edit.focus.caret);
      return;
    }
    pendingFocus.current = edit.focus;
    onChange(next);
  }

  useImperativeHandle(ref, () => ({
    addCheckbox() {
      if (!listMode) {
        const base = parseRows(content);
        const index = Math.min(lineIndexAt(content, caret.current), base.length - 1);
        const edit = convertTo(base, index, "check");
        const before = base[index];
        pendingFocus.current = edit.focus;
        lastConversion.current = before ? { index, before, kind: "check" } : null;
        setListMode(true);
        const next = serializeRows(edit.rows);
        if (next !== content) onChange(next);
        return;
      }
      const index = focusedRow.current;
      const current = index === null ? undefined : rows[index];
      if (index !== null && current && current.kind !== "check") {
        apply(convertTo(rows, index, "check"));
        lastConversion.current = { index, before: current, kind: "check" };
      } else apply(insertItemAfter(rows, index !== null && index < rows.length ? index : null, "check"));
    },
  }));

  if (!listMode) {
    return (
      <textarea
        spellCheck={false}
        value={content}
        onChange={(event) => {
          const value = event.target.value;
          const position = event.target.selectionStart;
          caret.current = position;

          // A line that is just a freshly typed marker ("- ", "1. ", "[] ") starts a list.
          const index = lineIndexAt(value, position);
          const lines = value.split("\n");
          const line = lines[index] ?? "";
          const lineStart = lines.slice(0, index).reduce((sum, text) => sum + text.length + 1, 0);
          const shortcut = shortcutFromLine(line);
          if (shortcut && position === lineStart + line.length) {
            const converted = convertTo(parseRows(value), index, shortcut.kind);
            const emptied = setText(converted.rows, index, "");
            pendingFocus.current = { index, caret: 0 };
            lastConversion.current = { index, before: { kind: "text", text: "", checked: false, number: 1 }, kind: shortcut.kind };
            setListMode(true);
            onChange(serializeRows(emptied));
            return;
          }
          onChange(value);
        }}
        onSelect={(event) => {
          caret.current = event.currentTarget.selectionStart;
        }}
        onBlur={onBlur}
        placeholder="Write something…"
        className={cn("min-h-0 w-full flex-1 resize-none bg-transparent px-3 pt-1 pb-4 outline-none", TEXT_CLASS)}
      />
    );
  }

  function handleChange(index: number, event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    if (value.includes("\n")) {
      apply(splitOnNewlines(rows, index, value));
      return;
    }
    const shortcut = applyShortcut(rows, index, value);
    const before = rows[index];
    const converted = shortcut?.rows[index];
    if (shortcut && before && converted) {
      apply(shortcut);
      lastConversion.current = { index, before, kind: converted.kind };
    } else {
      onChange(serializeRows(setText(rows, index, value)));
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLTextAreaElement>) {
    // Leave Enter alone while an input method (e.g. Thai or Japanese) is still composing a word.
    if (event.nativeEvent.isComposing) return;
    const element = event.currentTarget;
    const atStart = element.selectionStart === 0 && element.selectionEnd === 0;
    const atEnd = element.selectionStart === element.value.length && element.selectionEnd === element.value.length;

    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
      const conversion = lastConversion.current;
      const edit = conversion && conversion.index === index ? revertConversion(rows, conversion, element.selectionStart) : null;
      if (edit) {
        event.preventDefault();
        apply(edit);
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      apply(pressEnter(rows, index, element.selectionStart));
    } else if (event.key === "Backspace" && atStart) {
      const edit = pressBackspaceAtStart(rows, index);
      if (edit) {
        event.preventDefault();
        apply(edit);
      }
    } else if (event.key === "ArrowUp" && atStart && index > 0) {
      event.preventDefault();
      focusRow(index - 1, rows[index - 1]?.text.length ?? 0);
    } else if (event.key === "ArrowDown" && atEnd && index < rows.length - 1) {
      event.preventDefault();
      focusRow(index + 1, 0);
    }
  }

  return (
    <div
      className="min-h-0 flex-1 cursor-text overflow-y-auto px-3 pt-1 pb-4"
      onClick={(event) => {
        // Clicking the empty space below the last row continues writing there.
        if (event.target === event.currentTarget) focusRow(rows.length - 1, rows[rows.length - 1]?.text.length ?? 0);
      }}
    >
      {view.map((row, index) => (
        <div key={index} className="flex items-start gap-2">
          {row.kind === "check" && (
            <button
              type="button"
              role="checkbox"
              aria-checked={row.checked}
              aria-label={row.checked ? `Untick: ${row.text || "empty item"}` : `Tick: ${row.text || "empty item"}`}
              onClick={() => {
                lastConversion.current = null;
                onChange(serializeRows(toggleItem(rows, index)));
              }}
              className="mt-[5px] flex size-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-current outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              {row.checked && <Check className="size-3" strokeWidth={3.5} aria-hidden="true" />}
            </button>
          )}
          {row.kind === "bullet" && (
            <span className="mt-[5px] flex size-4 shrink-0 items-center justify-center" aria-hidden="true" data-marker="bullet">
              <span className="size-1.5 rounded-full bg-current" />
            </span>
          )}
          {row.kind === "number" && (
            <span className={cn("w-6 shrink-0 text-right tabular-nums", TEXT_CLASS)} aria-hidden="true" data-marker="number">
              {row.number}.
            </span>
          )}
          <textarea
            spellCheck={false}
            ref={(element) => {
              rowRefs.current[index] = element;
            }}
            rows={1}
            value={row.text}
            onChange={(event) => handleChange(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onFocus={() => {
              focusedRow.current = index;
              if (lastConversion.current && lastConversion.current.index !== index) lastConversion.current = null;
            }}
            onBlur={onBlur}
            placeholder={rows.length === 1 ? "Write something…" : undefined}
            aria-label={
              row.kind === "check" ? `Checkbox item ${index + 1}` : row.kind === "text" ? `Line ${index + 1}` : `List item ${index + 1}`
            }
            className={cn(
              "min-w-0 flex-1 resize-none overflow-hidden bg-transparent outline-none",
              TEXT_CLASS,
              row.kind === "check" && row.checked && "line-through opacity-55",
            )}
          />
        </div>
      ))}
    </div>
  );
});
