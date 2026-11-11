import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ImagePlus, Plus, Search } from "lucide-react";
import { ColorSwatches } from "@/components/ColorSwatches";
import { PostIt } from "@/components/notes/PostIt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateImageNote, useCreateNote, useMoveNote, useNotes } from "@/hooks/useNotes";
import { noteSizeForImage, pictureFromClipboard, prepareImage } from "@/lib/noteImages";
import { DEFAULT_NOTE_COLOR, DEFAULT_NOTE_WIDTH, NOTE_COLORS, noteMatches } from "@/lib/notes";
import { showToast } from "@/lib/toast";

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
  const createImageNote = useCreateImageNote();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  // Where a note was just dropped. The saved position reaches the screen a moment after the drag ends,
  // and without this the note would flash back to its old spot for one frame in between.
  const [dropped, setDropped] = useState<Record<number, { x: number; y: number }>>({});

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

  /** A picture from a file or the clipboard becomes its own note, in the visible top-left corner like a new text note. */
  async function addPicture(blob: Blob) {
    const scroll = scrollRef.current;
    const offset = (notes.length % 6) * 28;
    try {
      const picture = await prepareImage(blob);
      createImageNote.mutate({
        x: Math.round((scroll?.scrollLeft ?? 0) + 32 + offset),
        y: Math.round((scroll?.scrollTop ?? 0) + 32 + offset),
        data: picture.data,
        ...noteSizeForImage(picture.width, picture.height),
      });
    } catch (error) {
      showToast({ message: error instanceof Error ? error.message : "Could not add the picture" });
    }
  }

  function handleFilesChosen(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (files.length === 0) {
      showToast({ message: "Choose a picture file (PNG, JPG, WebP, GIF...)" });
      return;
    }
    for (const file of files) void addPicture(file);
  }

  // Pasting (Ctrl+V) a copied picture anywhere on this page adds it. Text pastes into a note are left alone.
  const addPictureRef = useRef(addPicture);
  addPictureRef.current = addPicture;
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const picture = pictureFromClipboard(event.clipboardData);
      if (!picture) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, [contenteditable='true']") ?? false;
      if (typing && event.clipboardData?.getData("text/plain")) return;
      event.preventDefault();
      void addPictureRef.current(picture);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function handleBoardDoubleClick(event: MouseEvent<HTMLDivElement>) {
    // Pressing on the board captures the pointer for panning, which makes the browser deliver the click to the
    // scrolling container instead of whatever is under the pointer. So look at what is really there: only empty
    // board space counts, double-clicking a note's text must not create another note.
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const board = boardRef.current;
    if (!board || !(hit instanceof HTMLElement) || !hit.dataset.boardSurface) return;
    const rect = board.getBoundingClientRect();
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
    const position = {
      x: Math.max(0, Math.round(note.x + event.delta.x)),
      y: Math.max(0, Math.round(note.y + event.delta.y)),
    };
    setDropped((current) => ({ ...current, [note.id]: position }));
    moveNote.mutate(
      { id: note.id, ...position },
      {
        onSettled: () =>
          setDropped((current) => {
            const { [note.id]: _settled, ...rest } = current;
            return rest;
          }),
      },
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.025em]">Notes</h1>
        <div className="flex items-center gap-3">
          <Button onClick={addNote} disabled={createNote.isPending}>
            <Plus className="size-4" />
            New note
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={createImageNote.isPending}>
            <ImagePlus className="size-4" />
            Add picture
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesChosen} />
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
        onDoubleClick={handleBoardDoubleClick}
        onPointerDown={handlePanStart}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanEnd}
        onPointerCancel={handlePanEnd}
        className={`no-scrollbar isolate min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/30 ${
          panning ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <DndContext sensors={sensors} autoScroll={false} onDragEnd={handleDragEnd}>
          <div
            ref={boardRef}
            data-board-surface
            className="relative"
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
                note={dropped[note.id] ? { ...note, ...dropped[note.id] } : note}
                needsRaise={note.zIndex < topZ}
                dimmed={searching && !noteMatches(note, query)}
              />
            ))}
            {notes.length === 0 && !notesQuery.isPending && (
              <p className="pointer-events-none absolute top-10 left-10 text-sm text-muted-foreground">
                Your board is empty. Click “New note”, double-click anywhere on the board, or paste a picture with Ctrl+V.
              </p>
            )}
          </div>
        </DndContext>
      </div>

      <p className="text-xs text-muted-foreground">
        {searching
          ? `${matchCount} of ${notes.length} notes match. Others are faded.`
          : "Drag empty space to pan around the board. Drag a note by its top bar to move it, the bottom-right corner to resize, and use the pin to keep a note on top. Paste a picture with Ctrl+V or use “Add picture”."}
      </p>
    </div>
  );
}
