import { Check, Disc3, Palette } from "lucide-react";
import { Segmented } from "@/components/Segmented";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNowPlayingStore } from "@/lib/nowPlaying";
import { CLASSIC_RECORD, useRecordStyle, VINYL_COLORS, vinylLook, type LabelStyle, type VinylFinish } from "@/lib/recordStyle";
import { cn } from "@/lib/utils";

const FINISHES: { value: VinylFinish; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "clear", label: "Clear" },
  { value: "marble", label: "Marble" },
  { value: "splatter", label: "Splatter" },
  { value: "split", label: "Split" },
];

const LABELS: { value: LabelStyle; label: string }[] = [
  { value: "cover", label: "Album colour" },
  { value: "art", label: "Album art" },
  { value: "black", label: "Black" },
  { value: "white", label: "White" },
];

/** A small disc showing a vinyl colour in the chosen finish, as the swatch for that colour. */
function Swatch({ fill, selected }: { fill: string; selected: boolean }) {
  return (
    <span
      className={cn(
        "relative grid size-8 place-items-center rounded-full ring-1 ring-foreground/15 transition-transform duration-150 group-hover/swatch:scale-110",
        selected && "ring-2 ring-foreground",
      )}
      style={{ background: fill }}
    >
      {/* The label hole, so it reads as a record. */}
      <span className="size-2.5 rounded-full bg-black/45 ring-1 ring-white/20" />
      {selected && (
        <Check className="absolute -right-1 -bottom-1 size-4 rounded-full bg-foreground p-0.5 text-background" strokeWidth={3} />
      )}
    </span>
  );
}

/**
 * The record's style, chosen from a small panel by the turntable: the vinyl's colour (or the playing
 * cover's), its finish, and what the label shows. The record itself is the preview: it changes as you pick.
 */
export function RecordStyleMenu() {
  const style = useRecordStyle();
  const coverColor = useNowPlayingStore((state) => state.coverColor);

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Record style"
        title="Record style"
        className="pane grid size-9 place-items-center rounded-full text-foreground/75 outline-none transition-[color,scale] duration-150 hover:scale-105 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
      >
        <Palette className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[356px] gap-4 p-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-[17px] leading-tight font-semibold">Record style</p>
          <button
            type="button"
            onClick={() => style.set(CLASSIC_RECORD)}
            className="rounded-full px-2.5 py-1 text-xs text-foreground/65 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Classic
          </button>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-foreground/70">Vinyl</p>
          <div className="grid grid-cols-6 gap-2.5" role="radiogroup" aria-label="Vinyl colour">
            {VINYL_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                role="radio"
                aria-checked={style.color === color.id}
                aria-label={color.name}
                title={color.name}
                onClick={() => style.set({ color: color.id })}
                className="group/swatch grid place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Swatch fill={vinylLook({ ...style, color: color.id }, coverColor).fill} selected={style.color === color.id} />
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={style.color === "album"}
              aria-label="Album colour"
              title="The playing album's colour"
              onClick={() => style.set({ color: "album" })}
              className="group/swatch grid place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {coverColor ? (
                <Swatch fill={vinylLook({ ...style, color: "album" }, coverColor).fill} selected={style.color === "album"} />
              ) : (
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full bg-foreground/10 ring-1 ring-foreground/15",
                    style.color === "album" && "ring-2 ring-foreground",
                  )}
                >
                  <Disc3 className="size-4 text-foreground/60" />
                </span>
              )}
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-foreground/70">Finish</p>
          <Segmented
            size="sm"
            aria-label="Vinyl finish"
            value={style.finish}
            onChange={(finish) => style.set({ finish })}
            options={FINISHES}
            className="w-full justify-between"
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-foreground/70">Label</p>
          <Segmented
            size="sm"
            aria-label="Label"
            value={style.label}
            onChange={(label) => style.set({ label })}
            options={LABELS}
            className="w-full justify-between"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
