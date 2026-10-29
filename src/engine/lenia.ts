// Continuous 2D automata: Lenia (Bert Chan) and SmoothLife (Stephan Rafler).
// Each cell holds a value between 0 and 1.
//
// Lenia: U = (kernel * A), the weighted average of the neighborhood, where the
// kernel is a smooth ring of radius R. A ← clip(A + G(U) / T), with the growth
// function G(u) = 2·exp(−(u−μ)² / 2σ²) − 1.
//
// SmoothLife: m = average over an inner disk, n = average over the ring around
// it (outer radius 3× inner). The new value is a smooth version of the Life
// rule: birth when n ∈ [b1, b2] for empty cells, survival when n ∈ [d1, d2].

export interface LeniaParams {
  mode: 'lenia' | 'smooth';
  /** Kernel radius in cells (Lenia) / outer radius (SmoothLife). */
  R: number;
  /** Lenia: growth center μ and width σ, time resolution T. */
  mu: number;
  sigma: number;
  T: number;
  /** SmoothLife birth / death intervals and step size. */
  b1: number;
  b2: number;
  d1: number;
  d2: number;
  dt: number;
}

export const LENIA_DEFAULT: LeniaParams = {
  mode: 'lenia',
  R: 13,
  mu: 0.15,
  sigma: 0.015,
  T: 10,
  b1: 0.278,
  b2: 0.365,
  d1: 0.267,
  d2: 0.445,
  dt: 0.1,
};

/** Smooth bump on (0, 1): the shape of the Lenia ring. */
export function kernelCore(r: number): number {
  if (r <= 0 || r >= 1) return 0;
  return Math.exp(4 - 1 / (r * (1 - r)));
}

export function growth(u: number, mu: number, sigma: number): number {
  return 2 * Math.exp(-((u - mu) ** 2) / (2 * sigma * sigma)) - 1;
}

/** Normalized kernel weights on a (2R+1)² grid, row-major. Sums to 1. */
export function leniaKernel(R: number): Float32Array {
  const n = 2 * R + 1;
  const k = new Float32Array(n * n);
  let sum = 0;
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const v = kernelCore(Math.hypot(x, y) / R);
      k[(y + R) * n + x + R] = v;
      sum += v;
    }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}

/** SmoothLife: anti-aliased inner disk (channel 0) and ring (channel 1) weights, each normalized. */
export function smoothKernels(R: number): { disk: Float32Array; ring: Float32Array } {
  const ri = R / 3;
  const n = 2 * R + 1;
  const disk = new Float32Array(n * n);
  const ring = new Float32Array(n * n);
  let sd = 0;
  let sr = 0;
  const b = 1; // antialiasing width in cells
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y);
      const inner = Math.min(1, Math.max(0, ri + b / 2 - d) / b);
      const outer = Math.min(1, Math.max(0, R + b / 2 - d) / b);
      const i = (y + R) * n + x + R;
      disk[i] = inner;
      ring[i] = Math.max(0, outer - inner);
      sd += disk[i];
      sr += ring[i];
    }
  for (let i = 0; i < n * n; i++) {
    disk[i] /= sd;
    ring[i] /= sr;
  }
  return { disk, ring };
}

const sigmoid = (x: number, a: number, w: number) => 1 / (1 + Math.exp((-(x - a) * 4) / w));

/** SmoothLife transition s(n, m) in [0, 1] (Rafler's sigmoids). */
export function smoothTransition(n: number, m: number, p: LeniaParams, an = 0.028, am = 0.147): number {
  const aliveness = sigmoid(m, 0.5, am);
  const lo = p.b1 * (1 - aliveness) + p.d1 * aliveness;
  const hi = p.b2 * (1 - aliveness) + p.d2 * aliveness;
  return sigmoid(n, lo, an) * (1 - sigmoid(n, hi, an));
}

/** One step on the CPU (reference for tests; the app uses the GPU). */
export function leniaStepCPU(A: Float32Array, W: number, H: number, p: LeniaParams): Float32Array {
  const out = new Float32Array(W * H);
  const R = p.R;
  const n = 2 * R + 1;
  if (p.mode === 'lenia') {
    const K = leniaKernel(R);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let u = 0;
        for (let dy = -R; dy <= R; dy++)
          for (let dx = -R; dx <= R; dx++) {
            const w = K[(dy + R) * n + dx + R];
            if (w) u += w * A[((y + dy + H) % H) * W + ((x + dx + W) % W)];
          }
        out[y * W + x] = Math.min(1, Math.max(0, A[y * W + x] + growth(u, p.mu, p.sigma) / p.T));
      }
  } else {
    const { disk, ring } = smoothKernels(R);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let m = 0;
        let nn = 0;
        for (let dy = -R; dy <= R; dy++)
          for (let dx = -R; dx <= R; dx++) {
            const v = A[((y + dy + H) % H) * W + ((x + dx + W) % W)];
            m += disk[(dy + R) * n + dx + R] * v;
            nn += ring[(dy + R) * n + dx + R] * v;
          }
        const s = smoothTransition(nn, m, p);
        out[y * W + x] = Math.min(1, Math.max(0, A[y * W + x] + p.dt * (2 * s - 1)));
      }
  }
  return out;
}
