// Parameters of the 1D cellular automaton system and their URL form.

import { codeToRule, ruleCount, type Boundary, type Rule1D } from '../../engine/ca1d';
import type { Init1D } from '../../engine/init1d';
import { mulberry32, randomSeed } from '../../engine/random';

export interface CA1DParams {
  k: number;
  r: number;
  totalistic: boolean;
  /** Wolfram code, as a decimal string (codes can exceed 2^53). */
  code: string;
  init: Init1D;
  steps: number;
  /** Width for random initial conditions and for periodic/fixed boundaries. */
  width: number;
  boundary: Boundary;
  /** Hide cells outside the light cone of a finite seed. */
  pyramid: boolean;
}

export const LIMITS = {
  k: [2, 3, 4],
  r: [1, 2, 3],
  maxSteps: 3000,
  maxWidth: 4001,
  /** Upper bound on width * height so huge requests stay responsive. */
  maxCells: 9_000_000,
};

export function defaults(): CA1DParams {
  return {
    k: 2,
    r: 1,
    totalistic: false,
    code: '30',
    init: { kind: 'single', color: 1 },
    steps: 250,
    width: 401,
    boundary: 'infinite',
    pyramid: true,
  };
}

export function ruleOf(p: CA1DParams): Rule1D {
  return codeToRule(safeBigInt(p.code), p.k, p.r, p.totalistic);
}

export function safeBigInt(s: string): bigint {
  try {
    return /^\d+$/.test(s) ? BigInt(s) : 0n;
  } catch {
    return 0n;
  }
}

/** A random rule that keeps an all-0 neighborhood at 0, so patterns grow from a seed. */
export function randomCode(k: number, r: number, totalistic: boolean, seed = randomSeed()): string {
  const rnd = mulberry32(seed);
  const max = ruleCount(k, r, totalistic);
  const K = BigInt(k);
  let code = 0n;
  let place = 1n;
  let i = 0;
  while (place < max) {
    const digit = i === 0 ? 0n : BigInt(Math.floor(rnd() * k));
    code += digit * place;
    place *= K;
    i++;
  }
  return code.toString();
}

/** A reasonable rule when switching to a new (k, r, totalistic) family. */
export function defaultCodeFor(k: number, r: number, totalistic: boolean): string {
  if (k === 2 && r === 1 && !totalistic) return '30';
  if (k === 3 && r === 1 && totalistic) return '1599';
  if (k === 2 && r === 2 && totalistic) return '20';
  return randomCode(k, r, totalistic, 12345);
}

const BOUNDARY_KEYS: Record<Boundary, string> = { infinite: 'inf', periodic: 'per', fixed: 'fix' };

export function fromQuery(q: URLSearchParams): CA1DParams {
  const d = defaults();
  const int = (key: string, def: number, lo: number, hi: number) => {
    const v = Number(q.get(key));
    return q.has(key) && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : def;
  };
  const k = int('k', d.k, 2, 4);
  const r = int('r', d.r, 1, 3);
  const totalistic = q.get('tot') === '1';
  const code = q.get('rule') && /^\d+$/.test(q.get('rule')!) ? q.get('rule')! : defaultCodeFor(k, r, totalistic);

  let init: Init1D = d.init;
  const kind = q.get('init');
  if (kind === 'random') {
    const dens = Number(q.get('d'));
    init = {
      kind: 'random',
      density: Number.isFinite(dens) && q.has('d') ? Math.min(1, Math.max(0, dens)) : 0.5,
      seed: int('seed', 1, 0, 0x7fffffff),
    };
  } else if (kind === 'custom') {
    init = { kind: 'custom', cells: (q.get('cells') ?? '1').replace(/[^0-9]/g, '') || '1' };
  } else {
    init = { kind: 'single', color: int('c', 1, 1, k - 1) };
  }

  const b = q.get('b');
  const boundary = (Object.keys(BOUNDARY_KEYS) as Boundary[]).find((x) => BOUNDARY_KEYS[x] === b) ?? d.boundary;

  return {
    k,
    r,
    totalistic,
    code,
    init,
    steps: int('t', d.steps, 1, LIMITS.maxSteps),
    width: int('w', d.width, 3, LIMITS.maxWidth),
    boundary: init.kind === 'random' && boundary === 'infinite' ? 'periodic' : boundary,
    pyramid: q.get('view') !== 'full',
  };
}

export function toQuery(p: CA1DParams): Record<string, string> {
  const d = defaults();
  const q: Record<string, string> = {};
  if (p.k !== d.k) q.k = String(p.k);
  if (p.r !== d.r) q.r = String(p.r);
  if (p.totalistic) q.tot = '1';
  q.rule = p.code;
  if (p.init.kind === 'random') {
    q.init = 'random';
    q.d = String(p.init.density);
    q.seed = String(p.init.seed);
  } else if (p.init.kind === 'custom') {
    q.init = 'custom';
    q.cells = p.init.cells;
  } else if (p.init.color !== 1) {
    q.c = String(p.init.color);
  }
  if (p.steps !== d.steps) q.t = String(p.steps);
  if (p.boundary !== 'infinite') {
    q.b = BOUNDARY_KEYS[p.boundary];
    q.w = String(p.width);
  }
  if (!p.pyramid) q.view = 'full';
  return q;
}

/** Display name of a rule: "כלל 30" for elementary rules, "קוד 1599" otherwise. */
export function ruleName(p: CA1DParams): string {
  return p.k === 2 && p.r === 1 && !p.totalistic ? `כלל ${p.code}` : `קוד ${p.code}`;
}

export function familyName(p: CA1DParams): string {
  if (p.k === 2 && p.r === 1 && !p.totalistic) return 'אוטומט תאי אלמנטרי';
  const parts = [`${p.k} צבעים`, `טווח ${p.r}`];
  if (p.totalistic) parts.unshift('טוטליסטי');
  return parts.join(', ');
}
