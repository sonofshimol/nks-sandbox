// Systems based on numbers (chapter 4). Each produces a picture of digits:
// one row per number, digit colors = digit values. BigInt keeps everything exact.

import { NONE, type Picture } from './programs';

function digitsOf(n: bigint, base: number): number[] {
  if (n === 0n) return [0];
  const B = BigInt(base);
  const out: number[] = [];
  while (n > 0n) {
    out.push(Number(n % B));
    n /= B;
  }
  return out.reverse();
}

/** Rows of digits, right-aligned (like writing numbers under each other). */
function rightAligned(rows: number[][], maxWidth = 1200): Picture {
  const width = Math.min(maxWidth, Math.max(1, ...rows.map((r) => r.length)));
  const cells = new Uint8Array(width * rows.length).fill(NONE);
  rows.forEach((r, y) => {
    const d = r.slice(-width);
    for (let i = 0; i < d.length; i++) cells[y * width + width - d.length + i] = d[i];
  });
  return { width, height: rows.length, cells, marks: [] };
}

export function successive(base: number, count: number): Picture {
  return rightAligned(Array.from({ length: count }, (_, i) => digitsOf(BigInt(i + 1), base)));
}

/** Start at 1 and repeatedly multiply by m (or add a constant). */
export function iterate(base: number, count: number, step: (n: bigint) => bigint, start = 1n): Picture {
  const rows: number[][] = [];
  let n = start;
  for (let i = 0; i < count; i++) {
    rows.push(digitsOf(n, base));
    n = step(n);
    if (rows[rows.length - 1].length > 1200) break;
  }
  return rightAligned(rows);
}

/** Powers of 3/2 in base 2: 3^n written with the binary point n places from the right, aligned at the point. */
export function powersOfThreeHalves(count: number): Picture {
  const rows: number[][] = [];
  let p = 1n;
  for (let n = 0; n < count; n++) {
    rows.push(digitsOf(p, 2));
    p *= 3n;
  }
  // Align the binary points: row n has n fractional digits.
  const intW = Math.max(...rows.map((r, n) => r.length - n), 1);
  const width = intW + count;
  const cells = new Uint8Array(width * count).fill(NONE);
  rows.forEach((r, n) => {
    const start = intW - (r.length - n);
    for (let i = 0; i < r.length; i++) if (start + i >= 0) cells[n * width + start + i] = r[i];
  });
  return { width, height: count, cells, marks: [] };
}

/** Write n backwards in base b and add it to n (p.125). */
export function reverseAdd(base: number, count: number, start: bigint): Picture {
  return iterate(base, count, (n) => {
    const d = digitsOf(n, base).reverse();
    let r = 0n;
    for (const x of d) r = r * BigInt(base) + BigInt(x);
    return n + r;
  }, start);
}

/** Sieve of Eratosthenes: each row removes the multiples of the next prime (p.132). */
export function sieve(N: number): Picture {
  const alive = new Array(N + 1).fill(true);
  alive[0] = alive[1] = false;
  const rows: number[][] = [];
  const snapshot = () => rows.push(alive.slice(1).map((a) => (a ? 1 : 0)));
  snapshot();
  for (let p = 2; p * p <= N; p++) {
    if (!alive[p]) continue;
    for (let m = p * p; m <= N; m += p) alive[m] = false;
    snapshot();
  }
  const width = N;
  const cells = new Uint8Array(width * rows.length);
  rows.forEach((r, y) => cells.set(r, y * width));
  return { width, height: rows.length, cells, marks: [] };
}

/** A sequence plotted as one dot per column (n), height = value. */
export function plotSequence(values: number[], maxH = 400): Picture {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const H = Math.min(maxH, Math.max(2, hi - lo + 1));
  const scale = (H - 1) / Math.max(1, hi - lo);
  const W = values.length;
  const cells = new Uint8Array(W * H);
  values.forEach((v, x) => {
    const y = H - 1 - Math.round((v - lo) * scale);
    cells[y * W + x] = 1;
  });
  return { width: W, height: H, cells, marks: [] };
}

export const SEQUENCES: Record<string, { name: string; f: (n: number) => number[] }> = {
  hofstadter: {
    name: 'f(n) = f(n − f(n−1)) + f(n − f(n−2))',
    f: (N) => {
      const f = [0, 1, 1];
      for (let n = 3; n <= N; n++) f[n] = f[n - f[n - 1]] + f[n - f[n - 2]];
      return f.slice(1);
    },
  },
  conway: {
    name: 'f(n) = f(f(n−1)) + f(n − f(n−1))',
    f: (N) => {
      const f = [0, 1, 1];
      for (let n = 3; n <= N; n++) f[n] = f[f[n - 1]] + f[n - f[n - 1]];
      return f.slice(1).map((v, i) => v - (i + 1) / 2);
    },
  },
  primeGaps: {
    name: 'ההפרשים בין ראשוניים עוקבים',
    f: (N) => {
      const lim = N * 20;
      const s = new Uint8Array(lim + 1);
      const ps: number[] = [];
      for (let i = 2; i <= lim && ps.length <= N; i++) {
        if (s[i]) continue;
        ps.push(i);
        for (let m = i * i; m <= lim; m += i) s[m] = 1;
      }
      return ps.slice(1).map((p, i) => p - ps[i]).slice(0, N);
    },
  },
  divisors: {
    name: 'מספר המחלקים של n',
    f: (N) => Array.from({ length: N }, (_, i) => {
      let c = 0;
      for (let d = 1; d * d <= i + 1; d++) if ((i + 1) % d === 0) c += d * d === i + 1 ? 1 : 2;
      return c;
    }),
  },
};

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  if (x === 0n) x = 1n;
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) {
      // settle
      while (x * x > n) x--;
      while ((x + 1n) * (x + 1n) <= n) x++;
      return x;
    }
    x = y;
  }
}

/** Digits of √m in base b (integer part followed by `count` fractional digits). */
export function sqrtDigits(m: number, base: number, count: number): number[] {
  const B = BigInt(base);
  const r = isqrt(BigInt(m) * B ** BigInt(2 * count));
  return digitsOf(r, base);
}

/** Digits of π in base b (Machin's formula with BigInt fixed point). */
export function piDigits(base: number, count: number): number[] {
  const guard = 10n;
  const B = BigInt(base);
  const ONE = B ** (BigInt(count) + guard);
  const arctanInv = (x: bigint) => {
    let sum = 0n;
    let term = ONE / x;
    const x2 = x * x;
    for (let k = 0n; term !== 0n; k++) {
      const t = term / (2n * k + 1n);
      sum += k % 2n === 0n ? t : -t;
      term /= x2;
    }
    return sum;
  };
  const pi = 4n * (4n * arctanInv(5n) - arctanInv(239n));
  return digitsOf(pi / B ** guard, base);
}

/** A long digit sequence wrapped into rows of `width`. */
export function wrapDigits(d: number[], width: number): Picture {
  const height = Math.ceil(d.length / width);
  const cells = new Uint8Array(width * height).fill(NONE);
  d.forEach((v, i) => (cells[i] = v));
  return { width, height, cells, marks: [] };
}
