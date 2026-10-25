import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Palette, Pin, PinOff, Trash2 } from "lucide-react";
import { ColorSwatches } from "@/components/notes/ColorSwatches";
import {
  useBringNoteToFront,
  useDeleteNote,
  useResizeNote,
  useSetNoteColor,
  useSetNotePinned,
  useUpdateNoteText,
} from "@/hooks/useNotes";
import type { Note } from "@/lib/db/notes";
import {
  DRAGGING_Z,
  MIN_NOTE_HEIGHT,
  MIN_NOTE_WIDTH,
  noteZIndex,
  readableTextColor,
} from "@/lib/notes";
import { cn } from "@/lib/utils";

const SAVE_DELAY_MS = 700;

interface PostItProps {
  note: Note;
  /** True when another note is the topmost one, so clicking this should raise it. */
  needsRaise: boolean;
  /** Search is active and this note does not match. */
  dimmed: boolean;
}

interface ResizeState {
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

export function PostIt({ note, needsRaise, dimmed }: PostItProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: note.id });

  const updateText = useUpdateNoteText();
  const setColor = useSetNoteColor();
  const setPinned = useSetNotePinned();
  const bringToFront = useBringNoteToFront();
  const resizeNote = useResizeNote();
  const deleteNote = useDeleteNote();

  // Text lives in local state while typing and is saved after a short pause, on blur, and on unmount.
  // It is deliberately never re-synced from props, so a refetch cannot overwrite what is being typed.
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const lastSaved = useRef({ title: note.title, content: note.content });
  const saveRef = useRef<() => void>(() => undefined);
  saveRef.current = () => {
    if (title === lastSaved.current.title && content === lastSaved.current.content) return;
    lastSaved.current = { title, content };
    updateText.mutate({ id: note.id, title, content });
  };

  useEffect(() => {
    const timer = setTimeout(() => saveRef.current(), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [title, content]);
  useEffect(() => () => saveRef.current(), []);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!paletteOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!paletteRef.current?.contains(event.target as Node)) setPaletteOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [paletteOpen]);

  // While resizing, the size is kept locally and only written to the database on release.
  const [liveSize, setLiveSize] = useState<{ width: number; height: number } | null>(null);
  const resizeStart = useRef<ResizeState | null>(null);

  function onResizeDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStart.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: note.width,
      startHeight: note.height,
    };
  }

  function sizeFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const start = resizeStart.current;
    if (!start) return null;
    return {
      width: Math.max(MIN_NOTE_WIDTH, Math.round(start.startWidth + event.clientX - start.startX)),
      height: Math.max(MIN_NOTE_HEIGHT, Math.round(start.startHeight + event.clientY - start.startY)),
    };
  }

  function onResizeMove(event: ReactPointerEvent<HTMLDivElement>) {
    const size = sizeFromPointer(event);
    if (size) setLiveSize(size);
  }

  function onResizeUp(event: ReactPointerEvent<HTMLDivElement>) {
    const size = sizeFromPointer(event);
    resizeStart.current = null;
    setLiveSize(null);
    if (size) resizeNote.mutate({ id: note.id, ...size });
  }

  function raise() {
    if (needsRaise) bringToFront.mutate(note.id);
  }

  const width = liveSize?.width ?? note.width;
  const height = liveSize?.height ?? note.height;
  const textColor = readableTextColor(note.color);

  return (
    <div
      ref={setNodeRef}
      onPointerDownCapture={raise}
      className={cn(
        "absolute flex flex-col rounded-sm shadow-md transition-opacity",
        isDragging && "shadow-xl",
        dimmed && "opacity-25",
      )}
      style={{
        left: note.x,
        top: note.y,
        width,
        height,
        backgroundColor: note.color,
        color: textColor,
        zIndex: isDragging ? DRAGGING_Z : noteZIndex(note) + (paletteOpen ? 1000 : 0),
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      <div
        {...listeners}
        {...attributes}
        className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-end gap-0.5 rounded-t-sm bg-black/10 px-1 active:cursor-grabbing"
      >
        <div
          className="flex items-center gap-0.5"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setPaletteOpen((open) => !open)}
            className="rounded p-1 hover:bg-black/10"
            aria-label="Change colour"
            title="Change colour"
          >
            <Palette className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPinned.mutate({ id: note.id, pinned: !note.pinned })}
            className="rounded p-1 hover:bg-black/10"
            aria-label={note.pinned ? "Unpin" : "Pin on top"}
            title={note.pinned ? "Unpin" : "Pin on top"}
          >
            {note.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              const hasText = title.trim() !== "" || content.trim() !== "";
              if (!hasText || window.confirm("Delete this note?")) deleteNote.mutate(note.id);
            }}
            className="rounded p-1 hover:bg-black/10"
            aria-label="Delete note"
            title="Delete note"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {paletteOpen && (
        <div
          ref={paletteRef}
          className="absolute top-8 right-1 z-10 w-52 rounded-md bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          <ColorSwatches value={note.color} onChange={(color) => setColor.mutate({ id: note.id, color })} allowCustom />
        </div>
      )}

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => saveRef.current()}
        placeholder="Title"
        className="w-full bg-transparent px-2.5 pt-2 text-sm font-semibold outline-none placeholder:text-current placeholder:opacity-40"
      />
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onBlur={() => saveRef.current()}
        placeholder="Write something…"
        className="min-h-0 w-full flex-1 resize-none bg-transparent px-2.5 pt-1 pb-3 text-sm outline-none placeholder:text-current placeholder:opacity-40"
      />

      <div
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        className="absolute right-0 bottom-0 size-4 cursor-nwse-resize touch-none"
        title="Resize"
      >
        <svg viewBox="0 0 16 16" className="size-full opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 6 6 14M14 10l-4 4" />
        </svg>
      </div>
    </div>
  );
}
