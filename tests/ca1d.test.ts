import { describe, expect, it } from 'vitest';
import {
  codeToRule,
  column,
  complementRule,
  infiniteWidth,
  mirrorRule,
  neighborhoodCells,
  ruleToCode,
  run1D,
} from '../src/engine/ca1d';
import { makeRow } from '../src/engine/init1d';
import { decodePalette, encodePalette, BUILTIN_PALETTES, colorsFor } from '../src/engine/palette';
import { fromQuery, toQuery, randomCode } from '../src/systems/ca1d/params';

function singleCell(code: number | bigint, steps: number, k = 2, r = 1, tot = false, color = 1) {
  const W = infiniteWidth(1, r, steps);
  const init = new Uint8Array(W);
  init[r * steps] = color;
  return run1D({ rule: codeToRule(BigInt(code), k, r, tot), init, steps, boundary: 'infinite' });
}

describe('Wolfram numbering', () => {
  it('rule 30 maps neighborhoods 111..000 to 00011110', () => {
    const rule = codeToRule(30n, 2, 1, false);
    const out = [7, 6, 5, 4, 3, 2, 1, 0].map((n) => rule.table[n]).join('');
    expect(out).toBe('00011110');
    expect(neighborhoodCells(6, 2, 1)).toEqual([1, 1, 0]);
  });

  it('rule 110 maps neighborhoods 111..000 to 01101110', () => {
    const rule = codeToRule(110n, 2, 1, false);
    expect([7, 6, 5, 4, 3, 2, 1, 0].map((n) => rule.table[n]).join('')).toBe('01101110');
  });

  it('round-trips every elementary rule', () => {
    for (let c = 0; c < 256; c++) expect(ruleToCode(codeToRule(BigInt(c), 2, 1, false))).toBe(BigInt(c));
  });

  it('round-trips large codes beyond 2^53', () => {
    const big = 3n ** 200n + 12345n;
    expect(ruleToCode(codeToRule(big, 3, 2, false))).toBe(big);
  });

  it('totalistic code 1599 (k=3) has table 0,2,0,2,1,0,2 by sum', () => {
    expect(Array.from(codeToRule(1599n, 3, 1, true).table)).toEqual([0, 2, 0, 2, 1, 0, 2]);
  });

  it('mirror and complement match known equivalences', () => {
    // Rule 30 mirrors to 86, complements to 135; rule 110 mirrors to 124, complements to 137.
    expect(ruleToCode(mirrorRule(codeToRule(30n, 2, 1, false)))).toBe(86n);
    expect(ruleToCode(complementRule(codeToRule(30n, 2, 1, false)))).toBe(135n);
    expect(ruleToCode(mirrorRule(codeToRule(110n, 2, 1, false)))).toBe(124n);
    expect(ruleToCode(complementRule(codeToRule(110n, 2, 1, false)))).toBe(137n);
  });
});

describe('evolution', () => {
  it('rule 30 center column starts with the known bits (OEIS A051023)', () => {
    const st = singleCell(30, 40);
    const bits = Array.from(column(st, 40)).join('');
    expect(bits.slice(0, 20)).toBe('11011100110001011001');
  });

  it('rule 30 agrees with the formula left XOR (center OR right) for 1000 steps', () => {
    const steps = 1000;
    const st = singleCell(30, steps);
    const W = st.width;
    let row = new Uint8Array(W);
    row[steps] = 1;
    let mismatches = 0;
    for (let t = 1; t <= steps; t++) {
      const next = new Uint8Array(W);
      for (let x = 0; x < W; x++) next[x] = (x > 0 ? row[x - 1] : 0) ^ (row[x] | (x < W - 1 ? row[x + 1] : 0));
      row = next;
      for (let x = 0; x < W; x++) if (st.cells[t * W + x] !== row[x]) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it('rule 90 from a single cell is Pascal’s triangle mod 2', () => {
    const steps = 64;
    const st = singleCell(90, steps);
    for (let t = 0; t <= steps; t++) {
      for (let d = -t; d <= t; d++) {
        const expected = (t + d) % 2 === 0 ? Number((binom(t, (t + d) / 2) & 1n) === 1n) : 0;
        expect(st.cells[t * st.width + steps + d]).toBe(expected);
      }
    }
  });

  it('infinite boundary handles rules that flip the background (rule 1)', () => {
    const steps = 20;
    const st = singleCell(1, steps);
    // Compare with a very wide periodic run, which behaves like an infinite line.
    const W = 2001;
    const init = new Uint8Array(W);
    init[1000] = 1;
    const wide = run1D({ rule: codeToRule(1n, 2, 1, false), init, steps, boundary: 'periodic' });
    for (let t = 0; t <= steps; t++)
      for (let x = 0; x < st.width; x++)
        expect(st.cells[t * st.width + x]).toBe(wide.cells[t * W + 1000 - steps + x]);
  });

  it('periodic boundaries wrap around', () => {
    const init = new Uint8Array(5);
    init[0] = 1;
    // rule 170 copies the right neighbor: the pattern moves left by one each step
    const st = run1D({ rule: codeToRule(170n, 2, 1, false), init, steps: 1, boundary: 'periodic' });
    expect(Array.from(st.cells.subarray(5))).toEqual([0, 0, 0, 0, 1]);
  });

  it('random rows are reproducible from a seed', () => {
    const a = makeRow({ kind: 'random', density: 0.5, seed: 42 }, 100, 3);
    const b = makeRow({ kind: 'random', density: 0.5, seed: 42 }, 100, 3);
    expect(a).toEqual(b);
    expect(a.some((v) => v === 2)).toBe(true);
  });
});

describe('URL state', () => {
  it('round-trips parameters through the query string', () => {
    const p = fromQuery(new URLSearchParams('k=3&tot=1&rule=1599&t=900&init=random&d=0.3&seed=9&b=per&w=300'));
    const q = new URLSearchParams(toQuery(p));
    expect(fromQuery(q)).toEqual(p);
    expect(p.k).toBe(3);
    expect(p.init).toEqual({ kind: 'random', density: 0.3, seed: 9 });
  });

  it('random rules keep the empty neighborhood empty', () => {
    for (let i = 0; i < 20; i++) {
      const code = randomCode(3, 1, false, i);
      expect(codeToRule(BigInt(code), 3, 1, false).table[0]).toBe(0);
    }
  });

  it('round-trips palettes', () => {
    for (const p of BUILTIN_PALETTES) {
      const d = decodePalette(encodePalette(p))!;
      expect(colorsFor(d, 3)).toEqual(colorsFor(p, 3));
      expect(d.grid).toBe(p.grid);
    }
  });
});

function binom(n: number, k: number): bigint {
  let r = 1n;
  for (let i = 0; i < k; i++) r = (r * BigInt(n - i)) / BigInt(i + 1);
  return r;
}
