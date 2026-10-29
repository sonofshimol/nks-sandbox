// Initial conditions for 1D systems.

import { mulberry32 } from './random';

export type Init1D =
  | { kind: 'single'; color: number }
  | { kind: 'random'; density: number; seed: number }
  | { kind: 'custom'; cells: string };

/** The finite seed (non-background part) of an initial condition, for infinite boundaries. */
export function seedCells(init: Init1D, k: number): Uint8Array {
  if (init.kind === 'single') return Uint8Array.of(Math.min(init.color, k - 1));
  if (init.kind === 'custom') return parseCells(init.cells, k);
  throw new Error('random initial conditions have no finite seed');
}

/** A row of `width` cells. Finite seeds are centered on a background of 0. */
export function makeRow(init: Init1D, width: number, k: number): Uint8Array {
  const row = new Uint8Array(width);
  if (init.kind === 'random') {
    const rnd = mulberry32(init.seed);
    for (let x = 0; x < width; x++) {
      if (rnd() < init.density) row[x] = k === 2 ? 1 : 1 + Math.floor(rnd() * (k - 1));
    }
    return row;
  }
  const seed = seedCells(init, k);
  const start = Math.floor((width - seed.length) / 2);
  for (let i = 0; i < seed.length; i++) {
    const x = start + i;
    if (x >= 0 && x < width) row[x] = seed[i];
  }
  return row;
}

export function parseCells(s: string, k: number): Uint8Array {
  const digits = s.replace(/[^0-9]/g, '');
  const out = new Uint8Array(Math.max(1, digits.length));
  for (let i = 0; i < digits.length; i++) out[i] = Math.min(k - 1, Number(digits[i]));
  return out;
}

export function formatCells(cells: ArrayLike<number>): string {
  let s = '';
  for (let i = 0; i < cells.length; i++) s += cells[i];
  return s;
}

/** Trim background (0) cells from both ends, keeping at least one cell. */
export function trimCells(cells: Uint8Array): Uint8Array {
  let a = 0;
  let b = cells.length - 1;
  while (a < b && cells[a] === 0) a++;
  while (b > a && cells[b] === 0) b--;
  return cells.slice(a, b + 1);
}
