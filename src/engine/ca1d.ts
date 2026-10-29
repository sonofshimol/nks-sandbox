// One-dimensional cellular automata with k colors and range r.
// Pure TypeScript, no DOM: shared by the UI, workers and tests.
//
// Rule numbering follows Wolfram (NKS ch. 3):
// - General rules: a neighborhood (c_-r .. c_r) is read as a base-k number with
//   the leftmost cell most significant; code = sum table[n] * k^n.
// - Totalistic rules: the new color depends only on the sum s of the 2r+1 cells;
//   code = sum table[s] * k^s.

export type Boundary = 'infinite' | 'periodic' | 'fixed';

export interface Rule1D {
  k: number;
  r: number;
  totalistic: boolean;
  /** Indexed by neighborhood number (general) or by sum (totalistic). */
  table: Uint8Array;
}

/** Marks a cell that lies outside the pyramid (light cone) and should not be drawn. */
export const MASKED = 255;

export function neighborhoodSize(r: number): number {
  return 2 * r + 1;
}

export function tableLength(k: number, r: number, totalistic: boolean): number {
  const n = neighborhoodSize(r);
  return totalistic ? (k - 1) * n + 1 : k ** n;
}

export function ruleCount(k: number, r: number, totalistic: boolean): bigint {
  return BigInt(k) ** BigInt(tableLength(k, r, totalistic));
}

export function codeToRule(code: bigint, k: number, r: number, totalistic: boolean): Rule1D {
  const len = tableLength(k, r, totalistic);
  const table = new Uint8Array(len);
  const K = BigInt(k);
  let c = code < 0n ? 0n : code % ruleCount(k, r, totalistic);
  for (let i = 0; i < len; i++) {
    table[i] = Number(c % K);
    c /= K;
  }
  return { k, r, totalistic, table };
}

export function ruleToCode(rule: Rule1D): bigint {
  const K = BigInt(rule.k);
  let code = 0n;
  for (let i = rule.table.length - 1; i >= 0; i--) code = code * K + BigInt(rule.table[i]);
  return code;
}

/** Cells of neighborhood number `n`, left to right. */
export function neighborhoodCells(n: number, k: number, r: number): number[] {
  const size = neighborhoodSize(r);
  const cells = new Array<number>(size);
  for (let i = size - 1; i >= 0; i--) {
    cells[i] = n % k;
    n = Math.floor(n / k);
  }
  return cells;
}

export function neighborhoodIndex(cells: ArrayLike<number>, k: number): number {
  let n = 0;
  for (let i = 0; i < cells.length; i++) n = n * k + cells[i];
  return n;
}

/** Index into rule.table for the given neighborhood cells. */
export function tableIndexFor(rule: Rule1D, cells: ArrayLike<number>): number {
  if (!rule.totalistic) return neighborhoodIndex(cells, rule.k);
  let s = 0;
  for (let i = 0; i < cells.length; i++) s += cells[i];
  return s;
}

/** The full k^(2r+1) lookup table, also for totalistic rules. */
export function expandTable(rule: Rule1D): Uint8Array {
  if (!rule.totalistic) return rule.table;
  const { k, r } = rule;
  const len = k ** neighborhoodSize(r);
  const out = new Uint8Array(len);
  for (let n = 0; n < len; n++) {
    let s = 0;
    let m = n;
    while (m > 0) {
      s += m % k;
      m = Math.floor(m / k);
    }
    out[n] = rule.table[s];
  }
  return out;
}

export function applyRule(rule: Rule1D, cells: ArrayLike<number>): number {
  return rule.table[tableIndexFor(rule, cells)];
}

export interface Run1DOptions {
  rule: Rule1D;
  init: Uint8Array;
  steps: number;
  boundary: Boundary;
  /** Background color outside the initial row, for 'infinite' and 'fixed'. */
  background?: number;
}

export interface Spacetime {
  width: number;
  /** Number of rows: steps + 1. */
  height: number;
  /** Row-major cells, row t is the state after t steps. */
  cells: Uint8Array;
}

/**
 * Evolve `init` for `steps` steps.
 *
 * 'infinite' simulates an unbounded line on a uniform background: the cells just
 * outside the window always hold the background color, which itself evolves by
 * the rule (so rules with 000 -> 1 flip it). This is exact as long as the pattern
 * stays within the window, which `infiniteWidth` guarantees for finite seeds.
 */
export function run1D({ rule, init, steps, boundary, background = 0 }: Run1DOptions): Spacetime {
  const { k, r } = rule;
  const W = init.length;
  const H = steps + 1;
  const table = expandTable(rule);
  const size = neighborhoodSize(r);
  const top = k ** (size - 1); // place value of the leftmost cell
  const cells = new Uint8Array(W * H);
  cells.set(init);
  let bg = background;
  const ext = new Uint8Array(W + 2 * r);

  for (let t = 1; t < H; t++) {
    const prev = (t - 1) * W;
    // Fill the extended row with halo cells according to the boundary.
    for (let i = 0; i < r; i++) {
      if (boundary === 'periodic') {
        ext[i] = cells[prev + ((W - r + i) % W + W) % W];
        ext[r + W + i] = cells[prev + (i % W)];
      } else {
        const v = boundary === 'infinite' ? bg : background;
        ext[i] = v;
        ext[r + W + i] = v;
      }
    }
    ext.set(cells.subarray(prev, prev + W), r);

    // Sliding base-k window over ext.
    let n = 0;
    for (let i = 0; i < size - 1; i++) n = n * k + ext[i];
    const row = t * W;
    for (let x = 0; x < W; x++) {
      n = n * k + ext[x + size - 1];
      cells[row + x] = table[n];
      n -= ext[x] * top;
    }

    if (boundary === 'infinite') {
      let b = 0;
      for (let i = 0; i < size; i++) b = b * k + bg;
      bg = table[b];
    }
  }
  return { width: W, height: H, cells };
}

/** Width that holds the whole evolution of a finite seed of length `seedLen`. */
export function infiniteWidth(seedLen: number, r: number, steps: number): number {
  return seedLen + 2 * r * steps;
}

/** Replace cells outside the light cone of the seed by MASKED (pyramid view). */
export function maskPyramid(st: Spacetime, seedStart: number, seedEnd: number, r: number): void {
  const { width: W, height: H, cells } = st;
  for (let t = 0; t < H; t++) {
    const lo = seedStart - r * t;
    const hi = seedEnd + r * t; // inclusive
    const row = t * W;
    for (let x = 0; x < W; x++) if (x < lo || x > hi) cells[row + x] = MASKED;
  }
}

/** Mirror image of a rule (left <-> right). */
export function mirrorRule(rule: Rule1D): Rule1D {
  if (rule.totalistic) return { ...rule, table: rule.table.slice() };
  const { k, r } = rule;
  const table = new Uint8Array(rule.table.length);
  for (let n = 0; n < table.length; n++) {
    const cells = neighborhoodCells(n, k, r).reverse();
    table[neighborhoodIndex(cells, k)] = rule.table[n];
  }
  return { ...rule, table };
}

/** Color complement: swap color c with k-1-c everywhere. */
export function complementRule(rule: Rule1D): Rule1D {
  const { k, r } = rule;
  const table = new Uint8Array(rule.table.length);
  if (rule.totalistic) {
    const maxSum = (k - 1) * neighborhoodSize(r);
    for (let s = 0; s < table.length; s++) table[maxSum - s] = k - 1 - rule.table[s];
  } else {
    for (let n = 0; n < table.length; n++) {
      const cells = neighborhoodCells(n, k, r).map((c) => k - 1 - c);
      table[neighborhoodIndex(cells, k)] = k - 1 - rule.table[n];
    }
  }
  return { ...rule, table };
}

/** Column of cells at x, from the top of the spacetime. */
export function column(st: Spacetime, x: number): Uint8Array {
  const out = new Uint8Array(st.height);
  for (let t = 0; t < st.height; t++) out[t] = st.cells[t * st.width + x];
  return out;
}
