import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Copy, Crop, ListChecks, Palette, Pin, PinOff, Trash2 } from "lucide-react";
import { ColorSwatches } from "@/components/ColorSwatches";
import { ImageCropDialog } from "@/components/notes/ImageCropDialog";
import { NoteBody, type NoteBodyHandle } from "@/components/notes/NoteBody";
import { useConfirm } from "@/hooks/useConfirm";
import {
  useBringNoteToFront,
  useDeleteNote,
  useNoteImage,
  useReplaceNoteImage,
  useResizeNote,
  useSetNoteColor,
  useSetNotePinned,
  useUpdateNoteText,
} from "@/hooks/useNotes";
import type { Note } from "@/lib/db/notes";
import { cropImage, noteSizeForImage, toPngBlob, type CropRect } from "@/lib/noteImages";
import { showToast } from "@/lib/toast";
import {
  DRAGGING_Z,
  MIN_IMAGE_NOTE_WIDTH,
  MIN_NOTE_HEIGHT,
  MIN_NOTE_WIDTH,
  NOTE_COLORS,
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

  const isImage = note.kind === "image";
  const imageQuery = useNoteImage(note.id, isImage);
  const imageData = imageQuery.data ?? null;
  const replaceImage = useReplaceNoteImage();
  const [cropOpen, setCropOpen] = useState(false);

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

  const bodyRef = useRef<NoteBodyHandle>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!paletteOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element;
      // The custom-colour picker is a popover rendered outside the palette, so clicks in it do not count as outside.
      if (paletteRef.current?.contains(target) || target.closest('[data-slot="popover-content"]')) return;
      setPaletteOpen(false);
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
    if (isImage) {
      // A picture keeps its shape: the width follows the pointer and the height follows the width.
      const width = Math.max(MIN_IMAGE_NOTE_WIDTH, Math.round(start.startWidth + event.clientX - start.startX));
      return { width, height: Math.round((width * start.startHeight) / start.startWidth) };
    }
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
    if (!size) {
      setLiveSize(null);
      return;
    }
    // The new size stays on screen until the save has settled, so the note never flashes back to its old size.
    resizeNote.mutate({ id: note.id, ...size }, { onSettled: () => setLiveSize(null) });
  }

  async function applyCrop(rect: CropRect) {
    if (!imageData) return;
    const previous = { data: imageData, width: note.width, height: note.height };
    try {
      const cropped = await cropImage(imageData, rect);
      replaceImage.mutate({ id: note.id, data: cropped.data, ...noteSizeForImage(cropped.width, cropped.height, note.width) });
      showToast({
        message: "Picture cropped",
        actionLabel: "Undo",
        onAction: () => replaceImage.mutate({ id: note.id, ...previous }),
      });
    } catch {
      showToast({ message: "Could not crop the picture" });
    }
  }

  async function copyImage() {
    if (!imageData) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": toPngBlob(imageData) })]);
      showToast({ message: "Picture copied to the clipboard" });
    } catch {
      showToast({ message: "Could not copy the picture" });
    }
  }

  async function removeNote() {
    const hasText = title.trim() !== "" || content.trim() !== "";
    const confirmed =
      (!isImage && !hasText) ||
      (await confirm({
        title: isImage ? "Delete picture?" : "Delete note?",
        description: isImage
          ? "This picture will be permanently deleted."
          : note.title.trim()
            ? `“${note.title.trim()}” will be permanently deleted.`
            : "This note will be permanently deleted.",
        confirmLabel: isImage ? "Delete picture" : "Delete note",
      }));
    if (confirmed) deleteNote.mutate(note.id);
  }

  function raise() {
    if (needsRaise) bringToFront.mutate(note.id);
  }

  const width = liveSize?.width ?? note.width;
  const height = liveSize?.height ?? note.height;
  const textColor = readableTextColor(note.color);
  // A picture note has no bar: the whole picture is the handle for dragging, and its buttons float over it.
  const iconButton = isImage
    ? "rounded p-1 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] hover:bg-black/40 disabled:opacity-40"
    : "rounded p-1 hover:bg-black/10 disabled:opacity-40";
  const iconSize = "size-3.5";

  return (
    <div
      ref={setNodeRef}
      onPointerDownCapture={raise}
      className={cn(
        "absolute flex flex-col rounded-sm shadow-md transition-opacity",
        isImage && "cursor-grab touch-none overflow-hidden bg-card active:cursor-grabbing",
        isDragging && "shadow-xl",
        dimmed && "opacity-25",
      )}
      style={{
        left: note.x,
        top: note.y,
        width,
        height,
        backgroundColor: isImage ? undefined : note.color,
        color: isImage ? undefined : textColor,
        zIndex: isDragging ? DRAGGING_Z : noteZIndex(note) + (paletteOpen ? 1000 : 0),
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      {...(isImage ? { ...listeners, ...attributes } : {})}
    >
      <div
        {...(isImage ? {} : { ...listeners, ...attributes })}
        className={
          isImage
            ? "absolute top-1 right-1 z-10"
            : "flex h-7 shrink-0 cursor-grab touch-none items-center justify-end gap-0.5 rounded-t-sm bg-black/10 px-1 active:cursor-grabbing"
        }
      >
        <div
          className="flex items-center gap-0.5"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {isImage ? (
            <>
              <button
                type="button"
                onClick={() => setCropOpen(true)}
                disabled={!imageData}
                className={iconButton}
                aria-label="Crop picture"
                title="Crop"
              >
                <Crop className={iconSize} />
              </button>
              <button
                type="button"
                onClick={copyImage}
                disabled={!imageData}
                className={iconButton}
                aria-label="Copy picture"
                title="Copy to clipboard"
              >
                <Copy className={iconSize} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => bodyRef.current?.addCheckbox()}
                className={iconButton}
                aria-label="Add checkbox"
                title="Add checkbox"
              >
                <ListChecks className={iconSize} />
              </button>
              <button
                type="button"
                onClick={() => setPaletteOpen((open) => !open)}
                className={iconButton}
                aria-label="Change colour"
                title="Change colour"
              >
                <Palette className={iconSize} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setPinned.mutate({ id: note.id, pinned: !note.pinned })}
            className={iconButton}
            aria-label={note.pinned ? "Unpin" : "Pin on top"}
            title={note.pinned ? "Unpin" : "Pin on top"}
          >
            {note.pinned ? <PinOff className={iconSize} /> : <Pin className={iconSize} />}
          </button>
          <button
            type="button"
            onClick={removeNote}
            className={iconButton}
            aria-label={isImage ? "Delete picture" : "Delete note"}
            title="Delete"
          >
            <Trash2 className={iconSize} />
          </button>
        </div>
      </div>

      {!isImage && paletteOpen && (
        <div
          ref={paletteRef}
          className="absolute top-8 right-1 z-10 w-52 glass-strong rounded-xl p-2 text-popover-foreground"
        >
          <ColorSwatches
            value={note.color}
            colors={NOTE_COLORS}
            onChange={(color) => setColor.mutate({ id: note.id, color })}
            allowCustom
          />
        </div>
      )}

      {isImage ? (
        <div className="min-h-0 flex-1">
          {imageData ? (
            <img
              src={imageData}
              alt=""
              draggable={false}
              className="size-full object-contain select-none"
              onLoad={(event) => {
                // Keeps the note exactly the picture's shape (also tidies pictures added before the bar was removed).
                const { naturalWidth, naturalHeight } = event.currentTarget;
                const wanted = Math.round((note.width * naturalHeight) / naturalWidth);
                if (naturalWidth > 0 && Math.abs(wanted - note.height) > 2) {
                  resizeNote.mutate({ id: note.id, width: note.width, height: wanted });
                }
              }}
            />
          ) : (
            <p className="p-3 text-xs text-muted-foreground">{imageQuery.isError ? "Could not load this picture." : "Loading…"}</p>
          )}
        </div>
      ) : (
        <>
          <input
            spellCheck={false}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => saveRef.current()}
            placeholder="Title"
            className="w-full bg-transparent px-3 pt-2.5 text-base font-semibold outline-none placeholder:text-current placeholder:opacity-40"
          />
          <NoteBody ref={bodyRef} content={content} onChange={setContent} onBlur={() => saveRef.current()} />
        </>
      )}

      {confirmDialog}
      {isImage && imageData && (
        <ImageCropDialog open={cropOpen} onOpenChange={setCropOpen} data={imageData} onApply={applyCrop} />
      )}

      <div
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        className="absolute right-0 bottom-0 size-4 cursor-nwse-resize touch-none"
        title="Resize"
      >
        <svg viewBox="0 0 16 16" className={cn("size-full", isImage ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]" : "opacity-40")} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 6 6 14M14 10l-4 4" />
        </svg>
      </div>
    </div>
  );
}
