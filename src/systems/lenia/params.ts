import { LENIA_DEFAULT, type LeniaParams } from '../../engine/lenia';

export interface LeniaViewParams extends LeniaParams {
  size: number;
  seed: number;
  /** Fraction of the grid covered by random patches at the start. */
  density: number;
  colorMap: 'palette' | 'viridis' | 'fire';
  speed: number;
}

export const SIZES = [128, 256, 512];
export const SPEEDS = [1, 2, 5, 10, 20, 30, 60, 120];

export function defaults(mode: 'lenia' | 'smooth' = 'lenia'): LeniaViewParams {
  const base = { ...LENIA_DEFAULT, mode };
  if (mode === 'smooth') Object.assign(base, { R: 12 });
  return { ...base, size: 256, seed: 1, density: mode === 'lenia' ? 0.05 : 0.3, colorMap: 'viridis', speed: 5 };
}

const NUM_KEYS = ['R', 'mu', 'sigma', 'T', 'b1', 'b2', 'd1', 'd2', 'dt', 'size', 'seed', 'density', 'speed'] as const;

export function fromQuery(q: URLSearchParams): LeniaViewParams {
  const d = defaults(q.get('mode') === 'smooth' ? 'smooth' : 'lenia');
  for (const k of NUM_KEYS) {
    const v = Number(q.get(k));
    if (q.has(k) && Number.isFinite(v)) (d as unknown as Record<string, number>)[k] = v;
  }
  d.R = Math.min(30, Math.max(2, Math.round(d.R)));
  d.T = Math.max(1, d.T);
  d.size = SIZES.includes(d.size) ? d.size : 256;
  d.speed = Math.min(SPEEDS.length - 1, Math.max(0, Math.round(d.speed)));
  const cm = q.get('cmap');
  if (cm === 'palette' || cm === 'fire') d.colorMap = cm;
  return d;
}

export function toQuery(p: LeniaViewParams): Record<string, string> {
  const d = defaults(p.mode);
  const q: Record<string, string> = { mode: p.mode };
  for (const k of NUM_KEYS) if (p[k] !== d[k]) q[k] = String(p[k]);
  if (p.colorMap !== d.colorMap) q.cmap = p.colorMap;
  return q;
}
