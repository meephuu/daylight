import { useEffect, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ACCENT_COLORS, HEX_COLOR_PATTERN } from "@/lib/colors";
import { useSavedColors, type PaletteName } from "@/lib/savedColors";
import { cn } from "@/lib/utils";

/** How long a drag in the picker must pause before the colour is saved, so a drag is one write, not hundreds. */
const COMMIT_DELAY_MS = 200;

interface ColorSwatchesProps {
  value: string;
  onChange: (color: string) => void;
  /** Palette to offer; defaults to the shared accent colours. */
  colors?: { name: string; value: string }[];
  /**
   * Also offer the owner's saved colours, a "+" to add one to that shared palette, and the custom picker
   * (saturation square, hue slider, hex field) for a one-off colour.
   */
  allowCustom?: boolean;
  /** Which saved palette "+" adds to and shows: post-its keep their own, apart from everything else. */
  palette?: PaletteName;
  className?: string;
}

const RAINBOW = "conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)";

/** Row of preset colour dots, then (with allowCustom) the saved colours, "+" to save another, and the rainbow picker. */
export function ColorSwatches({
  value,
  onChange,
  colors = ACCENT_COLORS,
  allowCustom = false,
  palette = "accent",
  className,
}: ColorSwatchesProps) {
  const saved = useSavedColors((state) => state.palettes[palette]);
  const removeSaved = useSavedColors((state) => state.remove);
  const current = value.toLowerCase();
  const extra = allowCustom ? saved.filter((color) => !colors.some((preset) => preset.value.toLowerCase() === color)) : [];
  const isCustom = !colors.some((color) => color.value.toLowerCase() === current) && !extra.includes(current);
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {colors.map((color) => {
        const selected = color.value.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={color.value}
            type="button"
            onClick={() => onChange(color.value)}
            title={color.name}
            aria-label={color.name}
            aria-pressed={selected}
            className="flex size-6 items-center justify-center rounded-full ring-1 ring-black/15 transition-transform hover:scale-110"
            style={{ backgroundColor: color.value }}
          >
            {selected && <Check className="size-3.5 text-stone-800" />}
          </button>
        );
      })}
      {extra.map((color) => {
        const selected = color === current;
        return (
          <span key={color} className="group/saved relative">
            <button
              type="button"
              onClick={() => onChange(color)}
              title={`${color.toUpperCase()} (saved)`}
              aria-label={`Saved colour ${color.toUpperCase()}`}
              aria-pressed={selected}
              className="flex size-6 items-center justify-center rounded-full ring-1 ring-black/15 transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
            >
              {selected && <Check className="size-3.5 text-stone-800 mix-blend-difference" />}
            </button>
            {/* Shown on hover: takes the colour out of the palette (things already using it keep it). */}
            <button
              type="button"
              onClick={() => removeSaved(palette, color)}
              title="Remove from palette"
              aria-label={`Remove ${color.toUpperCase()} from the palette`}
              className="absolute -top-1 -right-1 hidden size-3.5 items-center justify-center rounded-full bg-foreground text-background shadow-sm group-hover/saved:flex focus-visible:flex"
            >
              <X className="size-2.5" strokeWidth={3} />
            </button>
          </span>
        );
      })}
      {allowCustom && <AddColor initial={value} palette={palette} onAdd={onChange} />}
      {allowCustom && <CustomColor value={value} isCustom={isCustom} onChange={onChange} />}
    </div>
  );
}

/** The "+" dot: pick a colour and keep it in the shared palette (and use it here straight away). */
function AddColor({ initial, palette, onAdd }: { initial: string; palette: PaletteName; onAdd: (color: string) => void }) {
  const add = useSavedColors((state) => state.add);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [hexText, setHexText] = useState(initial);

  function handleOpenChange(next: boolean) {
    if (next) {
      const start = HEX_COLOR_PATTERN.test(initial) ? initial.toLowerCase() : "#3b82f6";
      setDraft(start);
      setHexText(start);
    }
    setOpen(next);
  }

  function pick(color: string) {
    setDraft(color);
    setHexText(color);
  }

  function handleHexInput(text: string) {
    const withHash = text.startsWith("#") ? text : `#${text}`;
    setHexText(withHash);
    if (HEX_COLOR_PATTERN.test(withHash)) setDraft(withHash.toLowerCase());
  }

  function save() {
    if (!HEX_COLOR_PATTERN.test(draft)) return;
    add(palette, draft);
    onAdd(draft.toLowerCase());
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        title="Add a colour to the palette"
        aria-label="Add a colour to the palette"
        className="flex size-6 items-center justify-center rounded-full text-foreground/70 ring-1 ring-foreground/30 ring-inset transition-[scale,color] hover:scale-110 hover:text-foreground"
      >
        <Plus className="size-3.5" strokeWidth={2.5} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60" positionerClassName="z-[3000000]">
        <HexColorPicker color={draft} onChange={pick} className="color-picker" />
        <div className="flex items-center gap-2">
          <span className="size-8 shrink-0 rounded-md ring-1 ring-foreground/15" style={{ backgroundColor: draft }} aria-hidden="true" />
          <Input
            value={hexText}
            onChange={(event) => handleHexInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), save())}
            maxLength={7}
            spellCheck={false}
            aria-label="Hex colour"
            aria-invalid={!HEX_COLOR_PATTERN.test(hexText)}
            className="font-mono uppercase"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={save}>
            Add to palette
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface CustomColorProps {
  value: string;
  isCustom: boolean;
  onChange: (color: string) => void;
}

function CustomColor({ value, isCustom, onChange }: CustomColorProps) {
  const [open, setOpen] = useState(false);
  // While the popover is open the picker works on a local draft; the real value is committed after a pause.
  const [draft, setDraft] = useState(value);
  const [hexText, setHexText] = useState(value);
  const draftRef = useRef(value);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const timer = useRef<number | undefined>(undefined);
  valueRef.current = value;
  onChangeRef.current = onChange;

  // Follow outside changes (e.g. clicking a preset) while the popover is closed.
  useEffect(() => {
    if (!open) {
      setDraft(value);
      setHexText(value);
      draftRef.current = value;
    }
  }, [value, open]);

  function flush() {
    window.clearTimeout(timer.current);
    if (draftRef.current.toLowerCase() !== valueRef.current.toLowerCase()) onChangeRef.current(draftRef.current);
  }

  // Save a pending change if the component goes away (e.g. the dialog closes) mid-edit.
  useEffect(() => flush, []);

  function update(color: string) {
    draftRef.current = color;
    setDraft(color);
    setHexText(color);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, COMMIT_DELAY_MS);
  }

  function handleOpenChange(next: boolean) {
    if (!next) flush();
    setOpen(next);
  }

  function handleHexInput(text: string) {
    const withHash = text.startsWith("#") ? text : `#${text}`;
    setHexText(withHash);
    if (HEX_COLOR_PATTERN.test(withHash)) update(withHash.toLowerCase());
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        title="Custom colour"
        aria-label="Custom colour"
        className={cn(
          "relative flex size-6 items-center justify-center rounded-full ring-1 ring-black/15 transition-transform hover:scale-110",
          isCustom && "ring-2 ring-foreground",
        )}
        style={{ background: isCustom ? value : RAINBOW }}
      >
        {isCustom && <Check className="size-3.5 text-stone-800 mix-blend-difference" />}
      </PopoverTrigger>
      {/* Very high stacking order so it also opens above post-its, which sit on layers up to ~2,000,000. */}
      <PopoverContent align="start" className="w-60" positionerClassName="z-[3000000]">
        <HexColorPicker color={draft} onChange={update} className="color-picker" />
        <div className="flex items-center gap-2">
          <span
            className="size-8 shrink-0 rounded-md ring-1 ring-foreground/15"
            style={{ backgroundColor: HEX_COLOR_PATTERN.test(draft) ? draft : value }}
            aria-hidden="true"
          />
          <Input
            value={hexText}
            onChange={(event) => handleHexInput(event.target.value)}
            maxLength={7}
            spellCheck={false}
            aria-label="Hex colour"
            aria-invalid={!HEX_COLOR_PATTERN.test(hexText)}
            className="font-mono uppercase"
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => handleOpenChange(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
