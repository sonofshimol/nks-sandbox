// Turn a grid of cell states into an image with one pixel per cell.

import { MASKED } from '../engine/ca1d';
import { hexToRgb } from '../engine/palette';

export function colorLUT(colors: string[]): Uint32Array {
  const lut = new Uint32Array(256); // MASKED and unknown states stay transparent
  colors.forEach((c, i) => {
    const [r, g, b] = hexToRgb(c);
    lut[i] = (255 << 24) | (b << 16) | (g << 8) | r; // little-endian RGBA
  });
  return lut;
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

export function cellImage(cells: Uint8Array, w: number, h: number, colors: string[]): HTMLCanvasElement {
  const canvas = canvasOf(w, h);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const out = new Uint32Array(img.data.buffer);
  const lut = colorLUT(colors);
  for (let i = 0; i < cells.length; i++) out[i] = lut[cells[i]];
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Opaque `bg` where cells are MASKED, transparent elsewhere; null if nothing is masked. */
export function maskImage(cells: Uint8Array, w: number, h: number, bg: string): HTMLCanvasElement | null {
  if (!cells.includes(MASKED)) return null;
  const canvas = canvasOf(w, h);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const out = new Uint32Array(img.data.buffer);
  const [r, g, b] = hexToRgb(bg);
  const px = (255 << 24) | (b << 16) | (g << 8) | r;
  for (let i = 0; i < cells.length; i++) if (cells[i] === MASKED) out[i] = px;
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** A PNG of the whole grid at `cellPx` pixels per cell, with grid lines if there is room. */
export async function gridPNG(
  cells: Uint8Array,
  w: number,
  h: number,
  colors: string[],
  grid: string | null,
  bg: string,
): Promise<Blob | null> {
  const cellPx = Math.max(1, Math.min(12, Math.floor(Math.sqrt(16_000_000 / (w * h)))));
  const canvas = canvasOf(w * cellPx, h * cellPx);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(cellImage(cells, w, h, colors), 0, 0, canvas.width, canvas.height);
  if (grid && cellPx >= 4) {
    ctx.fillStyle = grid;
    for (let x = 0; x <= w; x++) ctx.fillRect(Math.min(x * cellPx, canvas.width - 1), 0, 1, canvas.height);
    for (let y = 0; y <= h; y++) ctx.fillRect(0, Math.min(y * cellPx, canvas.height - 1), canvas.width, 1);
  }
  const mask = maskImage(cells, w, h, bg);
  if (mask) ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
