/**
 * Website icons as the bare logo. Many sites only offer a "touch icon": the logo printed on a white
 * square. This lifts the logo off that square (the white connected to the edge becomes transparent, with
 * its anti-aliased rim un-blended), trims it to its drawn edges and centres it on a square canvas, so a
 * site's logo stands on the glass like an app's icon does. It also reports a one-colour mark that would
 * vanish on one theme (GitHub's black cat on dark glass), so the tile can invert it there.
 */

export interface RefinedIcon {
  src: string;
  /** A one-colour mark: "dark" needs inverting on dark glass, "light" on light glass. */
  tone: "dark" | "light" | null;
}

const cache = new Map<string, Promise<RefinedIcon>>();
const settled = new Map<string, RefinedIcon>();

/** The refined icon for `src` (a data: URL), worked out once per icon per session. */
export function refineSiteIcon(src: string): Promise<RefinedIcon> {
  let result = cache.get(src);
  if (!result) {
    result = refine(src).catch(() => ({ src, tone: null }));
    cache.set(src, result);
  }
  return result;
}

/** Already worked out (so a tile can draw it on the first frame). */
export function peekRefinedIcon(src: string): RefinedIcon | undefined {
  return settled.get(src);
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function refine(src: string): Promise<RefinedIcon> {
  const image = await load(src);
  const svg = src.startsWith("data:image/svg");
  const naturalW = image.naturalWidth || 256;
  const naturalH = image.naturalHeight || 256;
  // Draw small favicons at their own size (blowing them up here only blurs them twice), big ones at 256.
  const size = svg ? 256 : Math.min(256, Math.max(naturalW, naturalH, 32));
  const scale = Math.min(size / naturalW, size / naturalH);
  const w = Math.round(naturalW * scale);
  const h = Math.round(naturalH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { src, tone: null };
  context.imageSmoothingQuality = "high";
  context.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
  const pixels = context.getImageData(0, 0, size, size);

  liftOffWhite(pixels.data, size);
  const box = drawnBox(pixels.data, size);
  // Nothing (or almost nothing) left: the "background" was the logo. Keep the original.
  if (!box || box.w * box.h < size * size * 0.02) return remember(src, { src, tone: null });

  const side = Math.max(box.w, box.h);
  const out = document.createElement("canvas");
  out.width = side;
  out.height = side;
  const outContext = out.getContext("2d");
  if (!outContext) return { src, tone: null };
  context.putImageData(pixels, 0, 0);
  outContext.drawImage(canvas, box.x, box.y, box.w, box.h, (side - box.w) / 2, (side - box.h) / 2, box.w, box.h);
  return remember(src, { src: out.toDataURL("image/png"), tone: toneOf(pixels.data) });
}

function remember(key: string, icon: RefinedIcon): RefinedIcon {
  settled.set(key, icon);
  return icon;
}

const isWhitish = (r: number, g: number, b: number) => Math.min(r, g, b) > 222 && Math.max(r, g, b) - Math.min(r, g, b) < 24;

/**
 * Makes the white square behind a logo transparent: every near-white (or already transparent) pixel
 * connected to the edge. Only when the edge really is white; a coloured square (a brand's own tile)
 * stays, since it is part of that logo.
 */
function liftOffWhite(data: Uint8ClampedArray, size: number) {
  // The edge, sampled at corners and midpoints a little inside: mostly opaque white, or leave it be.
  const inset = Math.max(1, Math.round(size * 0.02));
  const spots = [
    [inset, inset], [size - 1 - inset, inset], [inset, size - 1 - inset], [size - 1 - inset, size - 1 - inset],
    [size >> 1, inset], [size >> 1, size - 1 - inset], [inset, size >> 1], [size - 1 - inset, size >> 1],
  ];
  let white = 0;
  for (const [x, y] of spots) {
    const i = (y * size + x) * 4;
    if (data[i + 3] > 230 && isWhitish(data[i], data[i + 1], data[i + 2])) white++;
    else if (data[i + 3] > 40) return;
  }
  if (white < 3) return;

  const near = (i: number) => data[i + 3] < 24 || (data[i + 3] > 0 && Math.min(data[i], data[i + 1], data[i + 2]) > 200 && Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) < 40);
  const removed = new Uint8Array(size * size);
  const queue = new Int32Array(size * size);
  let head = 0;
  let tail = 0;
  const push = (p: number) => {
    if (removed[p] || !near(p * 4)) return;
    removed[p] = 1;
    queue[tail++] = p;
  };
  for (let x = 0; x < size; x++) {
    push(x);
    push((size - 1) * size + x);
  }
  for (let y = 0; y < size; y++) {
    push(y * size);
    push(y * size + size - 1);
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % size;
    if (x > 0) push(p - 1);
    if (x < size - 1) push(p + 1);
    if (p >= size) push(p - size);
    if (p < size * (size - 1)) push(p + size);
  }

  for (let p = 0; p < size * size; p++) {
    const i = p * 4;
    if (removed[p]) {
      data[i + 3] = 0;
      continue;
    }
    // The logo's anti-aliased rim against the white: take the white back out of it.
    const x = p % size;
    const touches = (x > 0 && removed[p - 1]) || (x < size - 1 && removed[p + 1]) || (p >= size && removed[p - size]) || (p < size * (size - 1) && removed[p + size]);
    if (!touches) continue;
    const alpha = Math.max(1 - data[i] / 255, 1 - data[i + 1] / 255, 1 - data[i + 2] / 255);
    if (alpha <= 0.02) {
      data[i + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c++) data[i + c] = Math.round((data[i + c] - (1 - alpha) * 255) / alpha);
    data[i + 3] = Math.round(data[i + 3] * alpha);
  }
}

function drawnBox(data: Uint8ClampedArray, size: number) {
  let left = size;
  let top = size;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] > 12) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return right < 0 ? null : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

/** One colour only, and very dark or very light: a mark that one of the two themes would swallow. */
function toneOf(data: Uint8ClampedArray): RefinedIcon["tone"] {
  let count = 0;
  let grey = 0;
  let light = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    count++;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) < 28) grey++;
    light += 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  if (!count || grey / count < 0.92) return null;
  const mean = light / count;
  if (mean < 70) return "dark";
  if (mean > 200) return "light";
  return null;
}
