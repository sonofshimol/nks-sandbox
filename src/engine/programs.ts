// Other simple programs from chapter 3 of the book. Each one produces a
// picture: rows of cells, one row per step (like a 1D cellular automaton),
// plus optional marks (the active cell, the head of a Turing machine).

export interface Mark {
  x: number;
  y: number;
  /** Index of a mark color (e.g. the Turing machine state). */
  c: number;
}

export interface Picture {
  width: number;
  height: number;
  cells: Uint8Array;
  marks: Mark[];
  /** Extra information per row, shown when a cell is clicked. */
  rowInfo?: string[];
}

/** Empty (background) cells that are not part of the system, drawn as page background. */
export const NONE = 255;

function picture(rows: number[][], width: number, align: 'left' | 'center' = 'left', fill = NONE): Picture {
  const height = rows.length;
  const cells = new Uint8Array(width * height).fill(fill);
  rows.forEach((r, y) => {
    const off = align === 'center' ? Math.floor((width - r.length) / 2) : 0;
    for (let x = 0; x < r.length && off + x < width; x++) if (off + x >= 0) cells[y * width + off + x] = r[x];
  });
  return { width, height, cells, marks: [] };
}

// ---------------------------------------------------------------- mobile automata
// One active cell. Its color and its neighbors' colors (8 cases, as in an
// elementary CA) decide its new color and whether the active cell moves left or right.

export interface MobileRule {
  /** For neighborhood n (0..7, like elementary rules): new color of the active cell. */
  color: number[];
  /** For neighborhood n: move right (true) or left (false). */
  right: boolean[];
}

export function mobileCode(r: MobileRule): number {
  let code = 0;
  for (let n = 7; n >= 0; n--) code = code * 4 + r.color[n] * 2 + (r.right[n] ? 1 : 0);
  return code;
}

export function mobileFromCode(code: number): MobileRule {
  const color: number[] = [];
  const right: boolean[] = [];
  for (let n = 0; n < 8; n++) {
    const d = code % 4;
    code = Math.floor(code / 4);
    color.push(d >> 1);
    right.push((d & 1) === 1);
  }
  return { color, right };
}

export function runMobile(rule: MobileRule, steps: number, width = 2 * steps + 3): Picture {
  const tape = new Array(width).fill(0);
  let pos = Math.floor(width / 2);
  const rows: number[][] = [];
  const marks: Mark[] = [];
  for (let t = 0; t <= steps; t++) {
    rows.push(tape.slice());
    marks.push({ x: pos, y: t, c: 0 });
    if (t === steps) break;
    const l = tape[(pos - 1 + width) % width];
    const c = tape[pos];
    const r = tape[(pos + 1) % width];
    const n = (l << 2) | (c << 1) | r;
    tape[pos] = rule.color[n];
    pos = (pos + (rule.right[n] ? 1 : -1) + width) % width;
  }
  const p = picture(rows, width);
  p.marks = marks;
  return p;
}

// ---------------------------------------------------------------- Turing machines

export interface TMRule {
  states: number;
  colors: number;
  /** Indexed by state * colors + color. */
  table: { state: number; color: number; right: boolean }[];
}

export function tmEntries(states: number, colors: number) {
  return states * colors;
}

/** Our own numbering: entry digit = (state' * colors + color') * 2 + right, in base 2*s*k. */
export function tmCode(r: TMRule): bigint {
  const base = BigInt(2 * r.states * r.colors);
  let code = 0n;
  for (let i = r.table.length - 1; i >= 0; i--) {
    const e = r.table[i];
    code = code * base + BigInt((e.state * r.colors + e.color) * 2 + (e.right ? 1 : 0));
  }
  return code;
}

export function tmFromCode(code: bigint, states: number, colors: number): TMRule {
  const base = BigInt(2 * states * colors);
  const table: TMRule['table'] = [];
  for (let i = 0; i < states * colors; i++) {
    const d = Number(code % base);
    code /= base;
    table.push({ state: Math.floor(d / 2 / colors), color: Math.floor(d / 2) % colors, right: (d & 1) === 1 });
  }
  return { states, colors, table };
}

export function runTM(rule: TMRule, steps: number, initState = 0): Picture & { halted: boolean } {
  const width = 2 * steps + 3;
  const tape = new Array(width).fill(0);
  let pos = Math.floor(width / 2);
  let state = initState;
  const rows: number[][] = [];
  const marks: Mark[] = [];
  const info: string[] = [];
  for (let t = 0; t <= steps; t++) {
    rows.push(tape.slice());
    marks.push({ x: pos, y: t, c: state });
    info.push(`מצב ${state + 1}`);
    if (t === steps) break;
    const e = rule.table[state * rule.colors + tape[pos]];
    tape[pos] = e.color;
    state = e.state;
    pos += e.right ? 1 : -1;
    if (pos < 0 || pos >= width) break;
  }
  const p = picture(rows, width);
  return { ...p, marks, rowInfo: info, halted: false };
}

// ---------------------------------------------------------------- substitution systems

/** rules[s] = the symbols that symbol s turns into. */
export type SubstRules = number[][];

export function substitute(seq: number[], rules: SubstRules): number[] {
  const out: number[] = [];
  for (const s of seq) out.push(...(rules[s] ?? [s]));
  return out;
}

/** Each step as a row of the same total width: an element of step t spans width/len(t) cells. */
export function runSubstitution(rules: SubstRules, start: number[], steps: number, maxLen = 4096): Picture {
  const seqs: number[][] = [start];
  for (let t = 0; t < steps; t++) {
    const next = substitute(seqs[seqs.length - 1], rules);
    if (next.length > maxLen || next.length === 0) break;
    seqs.push(next);
  }
  const width = Math.max(...seqs.map((s) => s.length));
  const rowH = Math.max(1, Math.round(width / seqs.length / 4));
  const rows: number[][] = [];
  const info: string[] = [];
  for (const s of seqs) {
    const row = new Array(width);
    for (let x = 0; x < width; x++) row[x] = s[Math.floor((x * s.length) / width)];
    for (let k = 0; k < rowH; k++) {
      rows.push(row);
      info.push(`${s.length} איברים`);
    }
  }
  const p = picture(rows, width);
  p.rowInfo = info;
  return p;
}

/** 2D substitution: each symbol becomes an n×n block of symbols (fractals). */
export function runSubstitution2D(blocks: number[][], n: number, start: number, steps: number): Picture {
  let grid = [start];
  let size = 1;
  for (let t = 0; t < steps; t++) {
    const ns = size * n;
    if (ns > 2048) break;
    const next = new Array(ns * ns);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const b = blocks[grid[y * size + x]];
        for (let by = 0; by < n; by++)
          for (let bx = 0; bx < n; bx++) next[(y * n + by) * ns + x * n + bx] = b ? b[by * n + bx] : grid[y * size + x];
      }
    grid = next;
    size = ns;
  }
  return { width: size, height: size, cells: Uint8Array.from(grid), marks: [] };
}

// ---------------------------------------------------------------- sequential substitution
// Rules are tried in order; the first one whose left side appears is applied at its first occurrence.

export interface SeqRule {
  from: number[];
  to: number[];
}

export function runSequential(rules: SeqRule[], start: number[], steps: number, maxLen = 400): Picture & { used: number[] } {
  let s = start.slice();
  const rows: number[][] = [s.slice()];
  const used: number[] = [];
  const info: string[] = ['התחלה'];
  for (let t = 0; t < steps; t++) {
    let applied = -1;
    for (let i = 0; i < rules.length && applied < 0; i++) {
      const { from, to } = rules[i];
      for (let p = 0; p + from.length <= s.length; p++) {
        let ok = true;
        for (let j = 0; j < from.length; j++) if (s[p + j] !== from[j]) ok = false;
        if (ok) {
          s = [...s.slice(0, p), ...to, ...s.slice(p + from.length)];
          applied = i;
          break;
        }
      }
    }
    if (applied < 0 || s.length > maxLen) break;
    used.push(applied);
    info.push(`כלל ${applied + 1}`);
    rows.push(s.slice());
  }
  const width = Math.max(...rows.map((r) => r.length));
  const p = picture(rows, width);
  return { ...p, rowInfo: info, used };
}

// ---------------------------------------------------------------- tag systems

/** Remove `n` elements from the front; append rules[first element]. */
export function runTag(rules: number[][], n: number, start: number[], steps: number, maxLen = 400): Picture {
  let s = start.slice();
  const rows: number[][] = [s.slice()];
  for (let t = 0; t < steps && s.length >= 1; t++) {
    const first = s[0];
    s = [...s.slice(n), ...(rules[first] ?? [])];
    if (s.length > maxLen) break;
    rows.push(s.slice());
  }
  return picture(rows, Math.max(1, ...rows.map((r) => r.length)));
}

/** Cyclic tag: blocks are used in turn; if the first element is 1 the current block is appended. */
export function runCyclicTag(blocks: number[][], start: number[], steps: number, maxLen = 400): Picture {
  let s = start.slice();
  const rows: number[][] = [s.slice()];
  const info: string[] = ['התחלה'];
  for (let t = 0; t < steps && s.length; t++) {
    const b = blocks[t % blocks.length];
    s = [...s.slice(1), ...(s[0] === 1 ? b : [])];
    if (s.length > maxLen) break;
    rows.push(s.slice());
    info.push(`בלוק ${(t % blocks.length) + 1}`);
  }
  const p = picture(rows, Math.max(1, ...rows.map((r) => r.length)));
  p.rowInfo = info;
  return p;
}

// ---------------------------------------------------------------- register machines
// I r: add 1 to register r.  D r j: if register r > 0, subtract 1 and jump to
// instruction j; otherwise go on to the next instruction. The program loops
// back to the start after the last instruction.

export type RegInstr = { op: 'I'; r: number } | { op: 'D'; r: number; j: number };

export function parseRegProgram(text: string): RegInstr[] | string {
  const out: RegInstr[] = [];
  for (const raw of text.split(/[\n;,]+/)) {
    const t = raw.trim();
    if (!t) continue;
    const m = /^([IDid])\s*(\d+)(?:\s+(\d+))?$/.exec(t);
    if (!m) return `לא הבנתי: "${t}"`;
    const r = Number(m[2]) - 1;
    if (r < 0) return 'מספרי האוגרים מתחילים ב־1';
    if (m[1].toUpperCase() === 'I') out.push({ op: 'I', r });
    else {
      if (!m[3]) return `חסרה כתובת קפיצה: "${t}"`;
      out.push({ op: 'D', r, j: Number(m[3]) - 1 });
    }
  }
  return out.length ? out : 'התוכנית ריקה';
}

export function runRegister(prog: RegInstr[], steps: number, regs = 2): Picture {
  const n = Math.max(regs, ...prog.map((p) => p.r + 1));
  const R = new Array(n).fill(0);
  let pc = 0;
  const hist: { pc: number; R: number[] }[] = [];
  for (let t = 0; t <= steps; t++) {
    hist.push({ pc, R: R.slice() });
    const ins = prog[pc];
    if (ins.op === 'I') {
      R[ins.r]++;
      pc++;
    } else if (R[ins.r] > 0) {
      R[ins.r]--;
      pc = ins.j;
    } else pc++;
    if (pc >= prog.length || pc < 0) pc = 0;
  }
  const maxR = Math.max(1, ...hist.flatMap((h) => h.R));
  const regW = Math.min(200, maxR);
  // Layout: [program counter: one cell per instruction] gap [register 1 bar] gap [register 2 bar] ...
  const width = prog.length + 1 + n * (regW + 1);
  const rows = hist.map((h) => {
    const row = new Array(width).fill(0);
    row[h.pc] = 1;
    row[prog.length] = NONE;
    for (let i = 0; i < n; i++) {
      const off = prog.length + 1 + i * (regW + 1);
      for (let k = 0; k < Math.min(regW, h.R[i]); k++) row[off + k] = 2 + (i % 3);
      if (i < n - 1) row[off + regW] = NONE;
    }
    return row;
  });
  const p = picture(rows, width);
  p.rowInfo = hist.map((h) => `הוראה ${h.pc + 1}; ` + h.R.map((v, i) => `אוגר ${i + 1} = ${v}`).join(', '));
  return p;
}

// ---------------------------------------------------------------- continuous cellular automata
// Each cell holds a gray level between 0 and 1. New value: the fractional part
// of (a × the average of the cell and its two neighbors + b).

export function runContinuous(a: number, b: number, steps: number, width = 2 * steps + 1, levels = 254): Picture {
  let row = new Float64Array(width);
  row[Math.floor(width / 2)] = 1;
  const cells = new Uint8Array(width * (steps + 1));
  const put = (t: number, r: Float64Array) => {
    for (let x = 0; x < width; x++) cells[t * width + x] = Math.min(levels - 1, Math.floor(r[x] * levels));
  };
  put(0, row);
  for (let t = 1; t <= steps; t++) {
    const next = new Float64Array(width);
    for (let x = 0; x < width; x++) {
      const avg = ((x > 0 ? row[x - 1] : row[width - 1]) + row[x] + (x < width - 1 ? row[x + 1] : row[0])) / 3;
      const v = a * avg + b;
      // Keep exact 1 as 1 (pure averaging never exceeds 1).
      next[x] = v === 1 ? 1 : v - Math.floor(v);
    }
    row = next;
    put(t, row);
  }
  return { width, height: steps + 1, cells, marks: [] };
}
