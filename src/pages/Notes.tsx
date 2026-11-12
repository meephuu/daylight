import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ImagePlus, Plus, Search } from "lucide-react";
import { ColorSwatches } from "@/components/ColorSwatches";
import { PostIt } from "@/components/notes/PostIt";
import { Toolbar } from "@/components/PageHeader";
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

interface Point {
  x: number;
  y: number;
}

/** True while the user is typing somewhere, so board shortcuts (Space, Escape) leave the keys alone. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable='true']");
}

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

  // Box selection: drag on empty board space to select every note the box touches, then drag any
  // selected note to move them all together.
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const marqueeStart = useRef<{ origin: Point; base: Set<number> } | null>(null);
  const [marquee, setMarquee] = useState<{ from: Point; to: Point } | null>(null);
  /** How far the dragged group has moved so far; the other selected notes follow by this much. */
  const [groupDelta, setGroupDelta] = useState<Point | null>(null);
  /** Holding Space turns a drag on the board into panning. */
  const [spaceHeld, setSpaceHeld] = useState(false);

  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Notes that were on the board when the page opened. Anything added after that lands with a small drop.
  const knownIds = useRef<Set<number> | null>(null);
  if (knownIds.current === null && notesQuery.data) knownIds.current = new Set(notesQuery.data.map((note) => note.id));
  useEffect(() => {
    if (knownIds.current) for (const note of notes) knownIds.current.add(note.id);
  }, [notes]);

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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      if (event.key === " ") {
        event.preventDefault();
        setSpaceHeld(true);
      } else if (event.key === "Escape") {
        setSelected(new Set());
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key === " ") setSpaceHeld(false);
    }
    const release = () => setSpaceHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
    };
  }, []);

  /** A pointer position in board coordinates (the board's own top-left is 0,0, whatever the scroll). */
  function boardPoint(event: ReactPointerEvent): Point {
    const rect = boardRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  }

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

  /**
   * Pressing on empty board space: with Space held (or the middle button) it pans like a map; otherwise it
   * starts a selection box. Notes and the scrollbar are unaffected.
   */
  function handleBoardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const scroll = event.currentTarget;
    const target = event.target as HTMLElement;
    if (!target.dataset.boardSurface) return;
    const rect = scroll.getBoundingClientRect();
    const onScrollbar =
      event.clientX - rect.left >= scroll.clientWidth || event.clientY - rect.top >= scroll.clientHeight;
    if (onScrollbar) return;

    const pan = event.button === 1 || (event.button === 0 && spaceHeld);
    if (!pan && event.button !== 0) return;
    event.preventDefault();
    scroll.setPointerCapture(event.pointerId);

    if (pan) {
      panStart.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        scrollLeft: scroll.scrollLeft,
        scrollTop: scroll.scrollTop,
      };
      setPanning(true);
      return;
    }

    // Shift or Ctrl adds to the current selection; a plain press starts over (a plain click clears it).
    const base = event.shiftKey || event.ctrlKey || event.metaKey ? new Set(selected) : new Set<number>();
    const origin = boardPoint(event);
    marqueeStart.current = { origin, base };
    setMarquee({ from: origin, to: origin });
    setSelected(base);
  }

  function handleBoardPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = panStart.current;
    if (start) {
      event.currentTarget.scrollLeft = start.scrollLeft - (event.clientX - start.pointerX);
      event.currentTarget.scrollTop = start.scrollTop - (event.clientY - start.pointerY);
      return;
    }
    const box = marqueeStart.current;
    if (!box) return;
    const to = boardPoint(event);
    const left = Math.min(box.origin.x, to.x);
    const right = Math.max(box.origin.x, to.x);
    const top = Math.min(box.origin.y, to.y);
    const bottom = Math.max(box.origin.y, to.y);
    const next = new Set(box.base);
    for (const note of notes) {
      const touches = note.x < right && note.x + note.width > left && note.y < bottom && note.y + note.height > top;
      if (touches) next.add(note.id);
    }
    setMarquee({ from: box.origin, to });
    setSelected(next);
  }

  function handleBoardPointerEnd() {
    panStart.current = null;
    setPanning(false);
    marqueeStart.current = null;
    setMarquee(null);
  }

  /** Grabbing a note outside the selection drops the selection, so only that note moves. */
  function handleDragStart(event: DragStartEvent) {
    if (!selected.has(Number(event.active.id)) && selected.size > 0) setSelected(new Set());
  }

  function handleDragMove(event: DragMoveEvent) {
    if (selected.has(Number(event.active.id)) && selected.size > 1) {
      setGroupDelta({ x: event.delta.x, y: event.delta.y });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setGroupDelta(null);
    const id = Number(event.active.id);
    const moving = selected.has(id) && selected.size > 1 ? selected : new Set([id]);
    const group = notes.filter((note) => moving.has(note.id));
    if (group.length === 0 || (event.delta.x === 0 && event.delta.y === 0)) return;
    // Clamp the move as one, so the group keeps its shape when it reaches the board's top or left edge.
    const dx = Math.round(Math.max(event.delta.x, -Math.min(...group.map((note) => note.x))));
    const dy = Math.round(Math.max(event.delta.y, -Math.min(...group.map((note) => note.y))));
    if (dx === 0 && dy === 0) return;

    const positions: Record<number, Point> = {};
    for (const note of group) positions[note.id] = { x: note.x + dx, y: note.y + dy };
    setDropped((current) => ({ ...current, ...positions }));
    for (const note of group) {
      moveNote.mutate(
        { id: note.id, x: note.x + dx, y: note.y + dy },
        {
          onSettled: () =>
            setDropped((current) => {
              const { [note.id]: _settled, ...rest } = current;
              return rest;
            }),
        },
      );
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div data-settle className="flex flex-wrap items-end gap-x-6 gap-y-3 px-1 pt-3">
        <div className="mr-auto">
          <h1 className="font-display text-[44px] leading-none font-semibold tracking-[-0.035em]">Notes</h1>
          <p className="mt-2.5 text-[15px] text-foreground/80">
            {notes.length} {notes.length === 1 ? "note" : "notes"} on the board
          </p>
        </div>
        <Toolbar className="pr-2">
          <Button onClick={addNote} disabled={createNote.isPending}>
            <Plus className="size-4" />
            New note
          </Button>
          <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={createImageNote.isPending}>
            <ImagePlus className="size-4" />
            Add picture
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesChosen} />
          <span className="mx-1 h-5 w-px bg-foreground/15" aria-hidden="true" />
          <ColorSwatches value={newColor} colors={NOTE_COLORS} onChange={chooseColor} allowCustom />
        </Toolbar>
        <div className="pane relative w-64 rounded-full">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
            className="h-11 rounded-full border-transparent bg-transparent pl-10 shadow-none dark:bg-transparent"
          />
        </div>
      </div>

      {notesQuery.isError && (
        <p className="text-sm text-destructive">Could not load notes: {String(notesQuery.error)}</p>
      )}

      <div
        ref={scrollRef}
        data-board-surface
        data-settle
        onDoubleClick={handleBoardDoubleClick}
        onPointerDown={handleBoardPointerDown}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={handleBoardPointerEnd}
        onPointerCancel={handleBoardPointerEnd}
        className={`no-scrollbar isolate min-h-0 flex-1 overflow-auto rounded-[26px] bg-foreground/[0.04] shadow-[inset_0_0_0_1px_var(--glass-rim)] dark:bg-black/[0.12] ${
          panning ? "cursor-grabbing" : spaceHeld ? "cursor-grab" : "cursor-default"
        }`}
      >
        <DndContext
          sensors={sensors}
          autoScroll={false}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setGroupDelta(null)}
        >
          <div
            ref={boardRef}
            data-board-surface
            className="relative"
            style={{
              width: boardSize.width,
              height: boardSize.height,
              backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--foreground) 16%, transparent) 1px, transparent 1.2px)",
              backgroundSize: "24px 24px",
            }}
          >
            {notes.map((note) => (
              <PostIt
                key={note.id}
                note={dropped[note.id] ? { ...note, ...dropped[note.id] } : note}
                needsRaise={note.zIndex < topZ}
                dimmed={searching && !noteMatches(note, query)}
                selected={selected.has(note.id)}
                fresh={knownIds.current !== null && !knownIds.current.has(note.id)}
                groupOffset={groupDelta && selected.has(note.id) ? groupDelta : null}
              />
            ))}
            {marquee && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute z-[2100000] rounded-md border border-ring bg-ring/15"
                style={{
                  left: Math.min(marquee.from.x, marquee.to.x),
                  top: Math.min(marquee.from.y, marquee.to.y),
                  width: Math.abs(marquee.to.x - marquee.from.x),
                  height: Math.abs(marquee.to.y - marquee.from.y),
                }}
              />
            )}
            {notes.length === 0 && !notesQuery.isPending && (
              <p className="pointer-events-none absolute top-10 left-10 text-sm text-muted-foreground">
                Your board is empty. Click “New note”, double-click anywhere on the board, or paste a picture with Ctrl+V.
              </p>
            )}
          </div>
        </DndContext>
      </div>

      <p className="px-1 text-xs text-foreground/70">
        {searching
          ? `${matchCount} of ${notes.length} notes match. Others are faded.`
          : selected.size > 1
            ? `${selected.size} notes selected. Drag any of them to move them together. Esc or a click on empty board clears the selection.`
            : "Drag across empty board to select several notes, then drag one to move them all. Hold Space and drag (or drag with the middle button) to pan. Drag a note by its top bar to move it, the bottom-right corner to resize, and use the pin to keep a note on top. Paste a picture with Ctrl+V or use “Add picture”."}
      </p>
    </div>
  );
}
