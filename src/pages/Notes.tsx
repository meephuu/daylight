import { useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus, Search } from "lucide-react";
import { ColorSwatches } from "@/components/ColorSwatches";
import { PostIt } from "@/components/notes/PostIt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateNote, useMoveNote, useNotes } from "@/hooks/useNotes";
import { DEFAULT_NOTE_COLOR, DEFAULT_NOTE_WIDTH, NOTE_COLORS, noteMatches } from "@/lib/notes";

const COLOR_STORAGE_KEY = "newNoteColor";
const MIN_BOARD_WIDTH = 1600;
const MIN_BOARD_HEIGHT = 1000;
/** Free space kept to the right of / below the furthest note so the board can always grow. */
const BOARD_MARGIN = 320;

function readStoredColor(): string {
  try {
    return localStorage.getItem(COLOR_STORAGE_KEY) ?? DEFAULT_NOTE_COLOR;
  } catch {
    return DEFAULT_NOTE_COLOR;
  }
}

export default function NotesPage() {
  const notesQuery = useNotes();
  const createNote = useCreateNote();
  const moveNote = useMoveNote();

  const [newColor, setNewColor] = useState(readStoredColor);
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{
    pointerX: number;
    pointerY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [panning, setPanning] = useState(false);

  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const topZ = useMemo(() => notes.reduce((max, note) => Math.max(max, note.zIndex), 0), [notes]);
  const boardSize = useMemo(
    () => ({
      width: Math.max(MIN_BOARD_WIDTH, ...notes.map((note) => note.x + note.width + BOARD_MARGIN)),
      height: Math.max(MIN_BOARD_HEIGHT, ...notes.map((note) => note.y + note.height + BOARD_MARGIN)),
    }),
    [notes],
  );
  const searching = query.trim() !== "";
  const matchCount = searching ? notes.filter((note) => noteMatches(note, query)).length : notes.length;

  function chooseColor(color: string) {
    setNewColor(color);
    try {
      localStorage.setItem(COLOR_STORAGE_KEY, color);
    } catch {
      // Remembering the colour is only a convenience.
    }
  }

  /** New notes from the button land in the visible top-left corner, slightly staggered. */
  function addNote() {
    const scroll = scrollRef.current;
    const offset = (notes.length % 6) * 28;
    createNote.mutate({
      x: Math.round((scroll?.scrollLeft ?? 0) + 32 + offset),
      y: Math.round((scroll?.scrollTop ?? 0) + 32 + offset),
      color: newColor,
    });
  }

  function handleBoardDoubleClick(event: MouseEvent<HTMLDivElement>) {
    // Only empty board space: double-clicking a note's text must not create another note.
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    createNote.mutate({
      x: Math.max(0, Math.round(event.clientX - rect.left - DEFAULT_NOTE_WIDTH / 2)),
      y: Math.max(0, Math.round(event.clientY - rect.top - 16)),
      color: newColor,
    });
  }

  /** Grab empty board space and drag to pan, like a map. Notes and the scrollbar are unaffected. */
  function handlePanStart(event: ReactPointerEvent<HTMLDivElement>) {
    const scroll = event.currentTarget;
    const target = event.target as HTMLElement;
    if (event.button !== 0 || !target.dataset.boardSurface) return;
    const rect = scroll.getBoundingClientRect();
    const onScrollbar =
      event.clientX - rect.left >= scroll.clientWidth || event.clientY - rect.top >= scroll.clientHeight;
    if (onScrollbar) return;

    scroll.setPointerCapture(event.pointerId);
    panStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      scrollLeft: scroll.scrollLeft,
      scrollTop: scroll.scrollTop,
    };
    setPanning(true);
  }

  function handlePanMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = panStart.current;
    if (!start) return;
    event.currentTarget.scrollLeft = start.scrollLeft - (event.clientX - start.pointerX);
    event.currentTarget.scrollTop = start.scrollTop - (event.clientY - start.pointerY);
  }

  function handlePanEnd() {
    panStart.current = null;
    setPanning(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const note = notes.find((candidate) => candidate.id === event.active.id);
    if (!note || (event.delta.x === 0 && event.delta.y === 0)) return;
    moveNote.mutate({
      id: note.id,
      x: Math.max(0, Math.round(note.x + event.delta.x)),
      y: Math.max(0, Math.round(note.y + event.delta.y)),
    });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold">Notes</h1>
        <div className="flex items-center gap-3">
          <Button onClick={addNote} disabled={createNote.isPending}>
            <Plus className="size-4" />
            New note
          </Button>
          <ColorSwatches value={newColor} colors={NOTE_COLORS} onChange={chooseColor} allowCustom />
        </div>
        <div className="relative ml-auto w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
            className="pl-8"
          />
        </div>
      </div>

      {notesQuery.isError && (
        <p className="text-sm text-destructive">Could not load notes: {String(notesQuery.error)}</p>
      )}

      <div
        ref={scrollRef}
        data-board-surface
        onPointerDown={handlePanStart}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanEnd}
        onPointerCancel={handlePanEnd}
        className={`min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/30 ${
          panning ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <DndContext sensors={sensors} autoScroll={false} onDragEnd={handleDragEnd}>
          <div
            data-board-surface
            className="relative"
            onDoubleClick={handleBoardDoubleClick}
            style={{
              width: boardSize.width,
              height: boardSize.height,
              backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          >
            {notes.map((note) => (
              <PostIt
                key={note.id}
                note={note}
                needsRaise={note.zIndex < topZ}
                dimmed={searching && !noteMatches(note, query)}
              />
            ))}
            {notes.length === 0 && !notesQuery.isPending && (
              <p className="pointer-events-none absolute top-10 left-10 text-sm text-muted-foreground">
                Your board is empty. Click “New note”, or double-click anywhere on the board.
              </p>
            )}
          </div>
        </DndContext>
      </div>

      <p className="text-xs text-muted-foreground">
        {searching
          ? `${matchCount} of ${notes.length} notes match. Others are faded.`
          : "Drag empty space to pan around the board. Drag a note by its top bar to move it, the bottom-right corner to resize, and use the pin to keep a note on top."}
      </p>
    </div>
  );
}
