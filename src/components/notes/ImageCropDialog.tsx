import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { loadImage, type CropRect } from "@/lib/noteImages";

/** Smallest crop box, in on-screen pixels. */
const MIN_BOX = 24;
const MAX_VIEW_WIDTH = 640;

type Handle = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const HANDLES: { id: Exclude<Handle, "move">; className: string; cursor: string }[] = [
  { id: "nw", className: "-top-1.5 -left-1.5", cursor: "nwse-resize" },
  { id: "n", className: "-top-1.5 left-1/2 -translate-x-1/2", cursor: "ns-resize" },
  { id: "ne", className: "-top-1.5 -right-1.5", cursor: "nesw-resize" },
  { id: "e", className: "top-1/2 -right-1.5 -translate-y-1/2", cursor: "ew-resize" },
  { id: "se", className: "-right-1.5 -bottom-1.5", cursor: "nwse-resize" },
  { id: "s", className: "-bottom-1.5 left-1/2 -translate-x-1/2", cursor: "ns-resize" },
  { id: "sw", className: "-bottom-1.5 -left-1.5", cursor: "nesw-resize" },
  { id: "w", className: "top-1/2 -left-1.5 -translate-y-1/2", cursor: "ew-resize" },
];

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** The box after dragging `handle` by (dx, dy), kept inside the picture and above the minimum size. */
function dragBox(start: Box, handle: Handle, dx: number, dy: number, width: number, height: number): Box {
  if (handle === "move") {
    return { ...start, x: clamp(start.x + dx, 0, width - start.w), y: clamp(start.y + dy, 0, height - start.h) };
  }
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  if (handle.includes("w")) left = clamp(left + dx, 0, right - MIN_BOX);
  if (handle.includes("e")) right = clamp(right + dx, left + MIN_BOX, width);
  if (handle.includes("n")) top = clamp(top + dy, 0, bottom - MIN_BOX);
  if (handle.includes("s")) bottom = clamp(bottom + dy, top + MIN_BOX, height);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

interface CropEditorProps {
  data: string;
  onCancel: () => void;
  onApply: (rect: CropRect) => void;
}

function CropEditor({ data, onCancel, onApply }: CropEditorProps) {
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<{ width: number; height: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const drag = useRef<{ handle: Handle; pointerX: number; pointerY: number; start: Box } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadImage(data)
      .then((image) => {
        if (cancelled) return;
        const scale = Math.min(1, MAX_VIEW_WIDTH / image.naturalWidth, (window.innerHeight * 0.58) / image.naturalHeight);
        const width = Math.round(image.naturalWidth * scale);
        const height = Math.round(image.naturalHeight * scale);
        setNatural({ width: image.naturalWidth, height: image.naturalHeight });
        setView({ width, height });
        setBox({ x: 0, y: 0, w: width, h: height });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [data]);

  function onPointerDown(event: ReactPointerEvent<HTMLElement>, handle: Handle) {
    if (!box) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { handle, pointerX: event.clientX, pointerY: event.clientY, start: box };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || !view) return;
    setBox(dragBox(current.start, current.handle, event.clientX - current.pointerX, event.clientY - current.pointerY, view.width, view.height));
  }

  function onPointerUp() {
    drag.current = null;
  }

  const untouched = !box || !view || (box.x === 0 && box.y === 0 && box.w === view.width && box.h === view.height);
  const outWidth = box && view && natural ? Math.round((box.w / view.width) * natural.width) : 0;
  const outHeight = box && view && natural ? Math.round((box.h / view.height) * natural.height) : 0;

  function apply() {
    if (!box || !view || !natural) return;
    const ratioX = natural.width / view.width;
    const ratioY = natural.height / view.height;
    onApply({ x: box.x * ratioX, y: box.y * ratioY, width: box.w * ratioX, height: box.h * ratioY });
  }

  return (
    <>
      <div className="flex min-h-40 items-center justify-center glass-well rounded-xl p-3">
        {failed ? (
          <p className="text-sm text-destructive">Could not open this picture.</p>
        ) : view && box ? (
          <div className="overflow-hidden p-2">
            <div className="relative select-none" style={{ width: view.width, height: view.height }}>
            <img src={data} alt="" draggable={false} className="size-full" />
            <div
              role="group"
              aria-label="Crop area"
              onPointerDown={(event) => onPointerDown(event, "move")}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="absolute cursor-move touch-none border border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            >
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }, (_, index) => (
                  <span key={index} className="border border-white/25" />
                ))}
              </div>
              {HANDLES.map((handle) => (
                <span
                  key={handle.id}
                  onPointerDown={(event) => onPointerDown(event, handle.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className={`absolute size-3 rounded-[2px] border border-black/40 bg-white ${handle.className}`}
                  style={{ cursor: handle.cursor }}
                />
              ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </div>

      <DialogFooter className="items-center sm:justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">{box && natural ? `${outWidth} × ${outHeight} px` : ""}</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={untouched} onClick={() => view && setBox({ x: 0, y: 0, w: view.width, h: view.height })}>
            Reset
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={untouched} onClick={apply}>
            Crop
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The picture to crop, as a data URL. */
  data: string;
  onApply: (rect: CropRect) => void;
}

/** Drag the box (or its edges and corners) over the part of the picture to keep. */
export function ImageCropDialog({ open, onOpenChange, data, onApply }: ImageCropDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[min(720px,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Crop picture</DialogTitle>
          <DialogDescription>Drag the box, or its edges and corners, over the part you want to keep.</DialogDescription>
        </DialogHeader>
        {open && (
          <CropEditor
            data={data}
            onCancel={() => onOpenChange(false)}
            onApply={(rect) => {
              onApply(rect);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
