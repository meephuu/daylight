import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ACCENT_COLORS, HEX_COLOR_PATTERN } from "@/lib/colors";
import { cn } from "@/lib/utils";

/** How long a drag in the picker must pause before the colour is saved, so a drag is one write, not hundreds. */
const COMMIT_DELAY_MS = 200;

interface ColorSwatchesProps {
  value: string;
  onChange: (color: string) => void;
  /** Palette to offer; defaults to the shared accent colours. */
  colors?: { name: string; value: string }[];
  /** Also offer the custom picker (saturation square, hue slider, hex field) for any other colour. */
  allowCustom?: boolean;
  className?: string;
}

const RAINBOW = "conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)";

/** Row of preset colour dots, plus an optional rainbow dot that opens the custom colour popover. */
export function ColorSwatches({
  value,
  onChange,
  colors = ACCENT_COLORS,
  allowCustom = false,
  className,
}: ColorSwatchesProps) {
  const isCustom = !colors.some((color) => color.value.toLowerCase() === value.toLowerCase());
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
      {allowCustom && <CustomColor value={value} isCustom={isCustom} onChange={onChange} />}
    </div>
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
