// Small computations for the guided tour of chapters 7–12.

import { codeToRule, column, infiniteWidth, run1D } from './ca1d';

/** The center column of rule 30 from a single black cell. */
export function rule30Bits(n: number): Uint8Array {
  const W = infiniteWidth(1, 1, n);
  const init = new Uint8Array(W);
  init[n] = 1;
  return column(run1D({ rule: codeToRule(30n, 2, 1, false), init, steps: n, boundary: 'infinite' }), n);
}

/** How often each block of length L appears (as fractions), and the ideal 1/2^L. */
export function blockFrequencies(bits: Uint8Array, L: number): { block: string; freq: number }[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (let i = 0; i + L <= bits.length; i++) {
    const b = Array.from(bits.subarray(i, i + L)).join('');
    counts.set(b, (counts.get(b) ?? 0) + 1);
    total++;
  }
  const out: { block: string; freq: number }[] = [];
  for (let v = 0; v < 2 ** L; v++) {
    const b = v.toString(2).padStart(L, '0');
    out.push({ block: b, freq: (counts.get(b) ?? 0) / total });
  }
  return out;
}

/** Second-order reversible CA: x(t+1) = f(x(t)) XOR x(t−1). Rows are returned forward. */
export function secondOrder(code: number, init: Uint8Array, steps: number): Uint8Array[] {
  const table = codeToRule(BigInt(code), 2, 1, false).table;
  const W = init.length;
  const rows = [init.slice(), init.slice()];
  for (let t = 1; t < steps; t++) {
    const cur = rows[t];
    const prev = rows[t - 1];
    const next = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      const n = (cur[(x - 1 + W) % W] << 2) | (cur[x] << 1) | cur[(x + 1) % W];
      next[x] = table[n] ^ prev[x];
    }
    rows.push(next);
  }
  return rows;
}

/**
 * Hexagonal snowflake growth (in the spirit of chapter 8): a cell freezes when
 * exactly one of its six neighbors is frozen. Axial coordinates on an N×N grid.
 */
export function snowflake(N: number, steps: number, counts = [1]): Uint8Array {
  let g = new Uint8Array(N * N);
  const c = Math.floor(N / 2);
  g[c * N + c] = 1;
  const nb = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, -1],
    [-1, 1],
  ];
  for (let t = 0; t < steps; t++) {
    const next = g.slice();
    for (let r = 1; r < N - 1; r++)
      for (let q = 1; q < N - 1; q++) {
        if (g[r * N + q]) continue;
        let n = 0;
        for (const [dq, dr] of nb) if (g[(r + dr) * N + q + dq]) n++;
        if (counts.includes(n)) next[r * N + q] = t + 2 > 255 ? 255 : t + 2;
      }
    g = next;
  }
  return g;
}
