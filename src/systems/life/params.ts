// Parameters of the 2D Life-like system and their URL form.

import { parseRule } from '../../engine/life';

export type LifeInit =
  | { kind: 'random'; density: number; seed: number }
  | { kind: 'pattern'; id: string }
  | { kind: 'rle'; rle: string }
  | { kind: 'empty' };

export interface LifeParams {
  rule: string;
  size: number;
  wrap: boolean;
  init: LifeInit;
  /** Index into SPEEDS. */
  speed: number;
  /** Color living cells by age. */
  age: boolean;
}

/** Generations per second. */
export const SPEEDS = [1, 2, 4, 8, 15, 30, 60, 120, 240, 480, 960, 1920];
export const SIZES = [64, 128, 256, 512, 1024, 2048];

export function defaults(): LifeParams {
  return {
    rule: 'B3/S23',
    size: 256,
    wrap: true,
    init: { kind: 'random', density: 0.3, seed: 1 },
    speed: 5,
    age: false,
  };
}

export function fromQuery(q: URLSearchParams): LifeParams {
  const d = defaults();
  const rule = q.get('rule');
  const size = Number(q.get('n'));
  const speed = Number(q.get('speed'));
  let init: LifeInit = d.init;
  const kind = q.get('init');
  if (kind === 'pattern' && q.get('pat')) init = { kind: 'pattern', id: q.get('pat')! };
  else if (kind === 'rle' && q.get('rle')) init = { kind: 'rle', rle: q.get('rle')! };
  else if (kind === 'empty') init = { kind: 'empty' };
  else if (kind === 'random' || q.has('d')) {
    const dens = Number(q.get('d'));
    init = {
      kind: 'random',
      density: q.has('d') && Number.isFinite(dens) ? Math.min(1, Math.max(0, dens)) : 0.3,
      seed: Number(q.get('seed')) || 1,
    };
  }
  return {
    rule: rule && parseRule(rule) ? rule : d.rule,
    size: SIZES.includes(size) ? size : d.size,
    wrap: q.get('wrap') !== '0',
    init,
    speed: q.has('speed') && speed >= 0 && speed < SPEEDS.length ? Math.round(speed) : d.speed,
    age: q.get('age') === '1',
  };
}

export function toQuery(p: LifeParams): Record<string, string> {
  const d = defaults();
  const q: Record<string, string> = { rule: p.rule };
  if (p.size !== d.size) q.n = String(p.size);
  if (!p.wrap) q.wrap = '0';
  if (p.init.kind === 'random') {
    if (p.init.density !== 0.3 || p.init.seed !== 1) {
      q.init = 'random';
      q.d = String(p.init.density);
      q.seed = String(p.init.seed);
    }
  } else if (p.init.kind === 'pattern') {
    q.init = 'pattern';
    q.pat = p.init.id;
  } else if (p.init.kind === 'rle') {
    q.init = 'rle';
    q.rle = p.init.rle;
  } else q.init = 'empty';
  if (p.speed !== d.speed) q.speed = String(p.speed);
  if (p.age) q.age = '1';
  return q;
}
