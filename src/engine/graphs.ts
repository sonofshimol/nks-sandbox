// Multiway systems and causal networks (chapter 5 and 9).
//
// Multiway system: like a sequential substitution system, but every possible
// replacement is made, so one string leads to many. The result is a graph of
// strings, one layer per step.
//
// Causal network: run a sequential substitution system and connect each
// replacement event to the earlier events that produced the elements it uses.

import type { SeqRule } from './programs';

export interface MultiwayGraph {
  layers: string[][];
  edges: { from: [number, number]; to: [number, number] }[];
  truncated: boolean;
}

const enc = (a: number[]) => a.map((c) => String.fromCharCode(65 + c)).join('');
const dec = (s: string) => [...s].map((c) => c.charCodeAt(0) - 65);

export function multiway(rules: SeqRule[], start: number[], steps: number, maxPerLayer = 40, maxLen = 30): MultiwayGraph {
  const layers: string[][] = [[enc(start)]];
  const edges: MultiwayGraph['edges'] = [];
  const seen = new Set(layers[0]);
  let truncated = false;
  for (let t = 0; t < steps; t++) {
    const next: string[] = [];
    const index = new Map<string, number>();
    layers[t].forEach((s, i) => {
      const a = dec(s);
      for (const { from, to } of rules) {
        for (let p = 0; p + from.length <= a.length; p++) {
          let ok = true;
          for (let j = 0; j < from.length; j++) if (a[p + j] !== from[j]) ok = false;
          if (!ok) continue;
          const r = enc([...a.slice(0, p), ...to, ...a.slice(p + from.length)]);
          if (r.length > maxLen) {
            truncated = true;
            continue;
          }
          let k = index.get(r);
          if (k === undefined) {
            if (seen.has(r)) continue; // already appeared at an earlier step
            if (next.length >= maxPerLayer) {
              truncated = true;
              continue;
            }
            k = next.length;
            next.push(r);
            index.set(r, k);
          }
          if (!edges.some((e) => e.from[0] === t && e.from[1] === i && e.to[1] === k)) edges.push({ from: [t, i], to: [t + 1, k] });
        }
      }
    });
    if (!next.length) break;
    next.forEach((s) => seen.add(s));
    layers.push(next);
  }
  return { layers, edges, truncated };
}

export interface CausalNetwork {
  /** Layer (longest path from the first event) of each event. */
  depth: number[];
  /** Index of the rule used by each event. */
  rule: number[];
  edges: [number, number][];
  states: string[];
}

export function causalNetwork(rules: SeqRule[], start: number[], steps: number, maxLen = 400): CausalNetwork {
  let s = start.slice();
  let creator = s.map(() => -1);
  const depth: number[] = [];
  const rule: number[] = [];
  const edges: [number, number][] = [];
  const states = [enc(s)];
  for (let t = 0; t < steps; t++) {
    let done = false;
    for (let i = 0; i < rules.length && !done; i++) {
      const { from, to } = rules[i];
      for (let p = 0; p + from.length <= s.length; p++) {
        let ok = true;
        for (let j = 0; j < from.length; j++) if (s[p + j] !== from[j]) ok = false;
        if (!ok) continue;
        const parents = new Set(creator.slice(p, p + from.length).filter((c) => c >= 0));
        const id = depth.length;
        let d = 0;
        for (const q of parents) {
          edges.push([q, id]);
          d = Math.max(d, depth[q] + 1);
        }
        depth.push(d);
        rule.push(i);
        s = [...s.slice(0, p), ...to, ...s.slice(p + from.length)];
        creator = [...creator.slice(0, p), ...to.map(() => id), ...creator.slice(p + from.length)];
        states.push(enc(s));
        done = true;
        break;
      }
    }
    if (!done || s.length > maxLen) break;
  }
  return { depth, rule, edges, states };
}
