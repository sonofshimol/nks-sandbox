import { findKind, type KindId } from './kinds';

export interface ProgramsParams {
  kind: KindId;
  rule: string;
  start: string;
  steps: number;
}

export function defaults(kind?: KindId): ProgramsParams {
  const k = findKind(kind ?? 'mobile');
  const ex = k.examples[0];
  return { kind: k.id, rule: ex.rule, start: ex.start, steps: ex.steps };
}

export function fromQuery(q: URLSearchParams): ProgramsParams {
  const k = findKind(q.get('kind'));
  const d = defaults(k.id);
  const steps = Number(q.get('t'));
  return {
    kind: k.id,
    rule: q.get('rule') ?? d.rule,
    start: q.get('start') ?? d.start,
    steps: q.has('t') && steps >= 1 ? Math.min(k.maxSteps, Math.round(steps)) : d.steps,
  };
}

export function toQuery(p: ProgramsParams): Record<string, string> {
  const q: Record<string, string> = { kind: p.kind, rule: p.rule, t: String(p.steps) };
  if (p.start) q.start = p.start;
  return q;
}
