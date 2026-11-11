/** Pictures are shrunk to this on their longest side before they are stored. */
const MAX_STORED_SIDE = 2000;
/** How wide a freshly added picture note is, at most / at least. */
const MAX_NEW_NOTE_WIDTH = 420;
const MIN_NEW_NOTE_WIDTH = 220;

export interface PreparedImage {
  /** The picture as a data URL, ready to store. */
  data: string;
  /** Pixel size of the stored picture. */
  width: number;
  height: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the picture"));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the picture"))), type, quality);
  });
}

/** WebP keeps screenshots sharp at a fraction of PNG's size; PNG is the fallback if it is unavailable. */
async function encode(canvas: HTMLCanvasElement): Promise<string> {
  const webp = await canvasToBlob(canvas, "image/webp", 0.92);
  return blobToDataUrl(webp.type === "image/webp" ? webp : await canvasToBlob(canvas, "image/png"));
}

export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That file is not a picture this app can open"));
    image.src = source;
  });
}

/** Reads a picture file or clipboard image, shrinks it if it is huge, and encodes it for storage. */
export async function prepareImage(blob: Blob): Promise<PreparedImage> {
  const image = await loadImage(await blobToDataUrl(blob));
  const scale = Math.min(1, MAX_STORED_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
  return { data: await encode(canvas), width, height };
}

/** Cuts the given part (in the picture's own pixels) out of a stored picture. */
export async function cropImage(data: string, rect: CropRect): Promise<PreparedImage> {
  const image = await loadImage(data);
  const x = Math.max(0, Math.min(image.naturalWidth - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(image.naturalHeight - 1, Math.round(rect.y)));
  const width = Math.max(1, Math.min(image.naturalWidth - x, Math.round(rect.width)));
  const height = Math.max(1, Math.min(image.naturalHeight - y, Math.round(rect.height)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(image, x, y, width, height, 0, 0, width, height);
  return { data: await encode(canvas), width, height };
}

/** The clipboard only reliably accepts PNG pictures. */
export async function toPngBlob(data: string): Promise<Blob> {
  const image = await loadImage(data);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  return canvasToBlob(canvas, "image/png");
}

/** Board size of a note showing a picture of the given pixel size: picture width is kept, height follows the shape. */
export function noteSizeForImage(pixelWidth: number, pixelHeight: number, width?: number): { width: number; height: number } {
  const noteWidth = Math.round(width ?? Math.min(MAX_NEW_NOTE_WIDTH, Math.max(MIN_NEW_NOTE_WIDTH, pixelWidth)));
  return { width: noteWidth, height: Math.round((noteWidth * pixelHeight) / pixelWidth) };
}

/** The first picture on a paste / drop, if there is one. */
export function pictureFromClipboard(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) return item.getAsFile();
  }
  return null;
}
