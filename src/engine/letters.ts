// Spellular automata: a 1D cellular automaton whose cells are Hebrew letters.
// 23 symbols (space + 22 letters), range 1, and a symmetric rule: the triple
// a b c gives the same letter as c b a. Evolution is hill climbing on the rule:
// change a few entries, keep the change if the score (Hebrew words found in rows
// and columns) does not drop. Ported from "אורגניזמים של אותיות.html".

export const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';
export const N = 23;
export const SYMBOLS = [' ', ...LETTERS];
export const MAX_WORD = 7;

const FINAL: Record<string, string> = { כ: 'ך', מ: 'ם', נ: 'ן', פ: 'ף', צ: 'ץ' };
const UNFINAL: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

export const INDEX: Record<string, number> = Object.fromEntries(SYMBOLS.map((c, i) => [c, i]));

/** Symmetric key of a triple. */
export function key(a: number, b: number, c: number): number {
  return a <= c ? (a * N + b) * N + c : (c * N + b) * N + a;
}

export function keyCells(k: number): [number, number, number] {
  return [Math.floor(k / (N * N)), Math.floor(k / N) % N, k % N];
}

/** Letter with a final form when it ends a word. */
export function displayLetter(v: number, endsWord: boolean): string {
  const c = SYMBOLS[v];
  return endsWord && FINAL[c] ? FINAL[c] : c;
}

export function displayWord(w: string): string {
  const last = w[w.length - 1];
  return FINAL[last] ? w.slice(0, -1) + FINAL[last] : w;
}

/** Normalize text: final letters to regular ones, drop anything that is not a letter or space. */
export function normalize(text: string): string {
  let s = '';
  for (const ch of text) {
    const c = UNFINAL[ch] ?? ch;
    if (INDEX[c] !== undefined) s += c;
  }
  return s.replace(/ +/g, ' ');
}

export function loadWords(text: string): Set<string> {
  const set = new Set<string>();
  for (const line of text.split(/\s+/)) {
    const w = normalize(line).trim();
    if (w.length >= 2) set.add(w);
  }
  return set;
}

export interface LettersConfig {
  shape: 'pyr' | 'rect';
  /** Size level 0..2 */
  size: number;
  minLen: number;
  /** Only words surrounded by spaces (or the edge). */
  whole: boolean;
}

const SIZES = { pyr: [10, 13, 16], rect: [[12, 16], [16, 20], [22, 26]] as [number, number][] };

export interface FoundWord {
  word: string;
  dir: 'r' | 'c';
  cells: number[];
}

/** One run of the evolution. All randomness comes from `rnd`. */
export class LettersWorld {
  W: number;
  H: number;
  rule = new Uint8Array(N * N * N);
  seed: Uint8Array;
  grid: Uint8Array;
  private tmp: Uint8Array;
  active: Uint8Array;
  usedKeys: number[] = [];
  ruleUse = new Map<number, number>();
  found: FoundWord[] = [];
  best = -1;
  gen = 0;
  lockSeed = false;
  private cum = new Float64Array(N);

  constructor(
    public config: LettersConfig,
    public words: Set<string>,
    public rnd: () => number = Math.random,
  ) {
    if (config.shape === 'pyr') {
      this.H = SIZES.pyr[config.size];
      this.W = 2 * this.H - 1;
    } else {
      [this.W, this.H] = SIZES.rect[config.size];
    }
    const n = this.W * this.H;
    this.seed = new Uint8Array(this.W);
    this.grid = new Uint8Array(n);
    this.tmp = new Uint8Array(n);
    this.active = new Uint8Array(n);
    const c = this.H - 1;
    for (let r = 0; r < this.H; r++)
      for (let i = 0; i < this.W; i++)
        this.active[r * this.W + i] = config.shape === 'pyr' ? (Math.abs(i - c) <= r ? 1 : 0) : 1;

    // Random symbols follow the letter frequencies of the dictionary; space gets 20%.
    const f = new Float64Array(N);
    let total = 0;
    for (const w of words)
      for (const ch of w) {
        f[INDEX[ch]]++;
        total++;
      }
    f[0] = total * 0.2;
    let s = 0;
    for (let i = 0; i < N; i++) {
      s += f[i] || 1;
      this.cum[i] = s;
    }
    for (let i = 0; i < N; i++) this.cum[i] /= s;
  }

  randSym(): number {
    const r = this.rnd();
    for (let i = 0; i < N; i++) if (r < this.cum[i]) return i;
    return N - 1;
  }

  randLetter(): number {
    let s;
    do s = this.randSym();
    while (!s);
    return s;
  }

  randomRule() {
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) for (let c = a; c < N; c++) this.rule[(a * N + b) * N + c] = this.randSym();
  }

  /** Set the start from text: the first letter (pyramid) or a centered row (rectangle). Empty text → random. */
  setSeedText(text: string) {
    const s = normalize(text).trim();
    this.seed.fill(0);
    if (this.config.shape === 'pyr') {
      this.seed[this.H - 1] = s ? INDEX[s[0]] : this.randLetter();
      return;
    }
    const t = s.slice(0, this.W);
    if (!t) {
      for (let i = 0; i < this.W; i++) this.seed[i] = this.randSym();
      return;
    }
    const off = Math.floor((this.W - t.length) / 2);
    for (let i = 0; i < t.length; i++) this.seed[off + i] = INDEX[t[i]];
  }

  run(g: Uint8Array, collect: boolean) {
    const { W, H, active, rule, seed } = this;
    g.fill(0);
    g.set(seed, 0);
    const marks = collect ? new Map<number, number>() : null;
    const pyr = this.config.shape === 'pyr';
    for (let r = 1; r < H; r++) {
      const p = (r - 1) * W;
      const q = r * W;
      for (let i = 0; i < W; i++) {
        if (!active[q + i]) continue;
        const b = g[p + i];
        let a, c;
        if (pyr) {
          a = i > 0 ? g[p + i - 1] : 0;
          c = i < W - 1 ? g[p + i + 1] : 0;
        } else {
          a = g[p + ((i + W - 1) % W)];
          c = g[p + ((i + 1) % W)];
        }
        const k = key(a, b, c);
        g[q + i] = rule[k];
        if (marks) marks.set(k, (marks.get(k) ?? 0) + 1);
      }
    }
    if (marks) {
      this.usedKeys = [...marks.keys()];
      this.ruleUse = marks;
    }
  }

  private scanLine(str: string, cb: (t: string, start: number) => void) {
    const { minLen, whole } = this.config;
    const n = str.length;
    if (whole) {
      let st = 0;
      for (let i = 0; i <= n; i++) {
        if (i === n || str[i] === ' ') {
          const L = i - st;
          if (L >= minLen && L <= MAX_WORD) {
            const t = str.slice(st, i);
            if (this.words.has(t)) cb(t, st);
          }
          st = i + 1;
        }
      }
    } else {
      for (let st = 0; st < n; st++) {
        if (str[st] === ' ') continue;
        const lim = Math.min(MAX_WORD, n - st);
        for (let L = minLen; L <= lim; L++) {
          const t = str.substr(st, L);
          if (t.indexOf(' ') >= 0) break;
          if (this.words.has(t)) cb(t, st);
        }
      }
    }
  }

  /** Each distinct word counts once; a word one letter longer is worth twice as much. */
  score(g: Uint8Array, collect: boolean): number {
    const { W, H } = this;
    const uniq = new Set<string>();
    const out: FoundWord[] | null = collect ? [] : null;
    for (let r = 0; r < H; r++) {
      let s = '';
      for (let i = 0; i < W; i++) s += SYMBOLS[g[r * W + i]];
      this.scanLine(s, (t, st) => {
        uniq.add(t);
        if (out) out.push({ word: t, dir: 'r', cells: Array.from(t, (_, j) => r * W + st + j) });
      });
    }
    for (let c = 0; c < W; c++) {
      let s = '';
      for (let r = 0; r < H; r++) s += SYMBOLS[g[r * W + c]];
      this.scanLine(s, (t, st) => {
        uniq.add(t);
        if (out) out.push({ word: t, dir: 'c', cells: Array.from(t, (_, j) => (st + j) * W + c) });
      });
    }
    let sc = 0;
    uniq.forEach((t) => (sc += 2 ** (t.length - 3)));
    if (out) this.found = out;
    return sc;
  }

  evaluate() {
    this.run(this.grid, true);
    this.best = this.score(this.grid, true);
  }

  fresh(seedText: string) {
    this.randomRule();
    this.setSeedText(seedText);
    this.gen = 0;
    this.evaluate();
  }

  /** One hill-climbing step. Returns true if the change was kept. */
  step(): boolean {
    const saved: number[] = [];
    const nm = 2 + Math.floor(this.rnd() * 2);
    for (let m = 0; m < nm; m++) {
      const k = this.usedKeys[Math.floor(this.rnd() * this.usedKeys.length)];
      saved.push(k, this.rule[k]);
      this.rule[k] = this.randSym();
    }
    let si = -1;
    let sv = 0;
    if (!this.lockSeed && this.rnd() < 0.15) {
      if (this.config.shape === 'pyr') {
        si = this.H - 1;
        sv = this.seed[si];
        this.seed[si] = this.randLetter();
      } else {
        si = Math.floor(this.rnd() * this.W);
        sv = this.seed[si];
        this.seed[si] = this.randSym();
      }
    }
    this.run(this.tmp, false);
    const s = this.score(this.tmp, false);
    this.gen++;
    if (s >= this.best) {
      this.evaluate();
      return true;
    }
    for (let m = saved.length - 2; m >= 0; m -= 2) this.rule[saved[m]] = saved[m + 1];
    if (si >= 0) this.seed[si] = sv;
    return false;
  }

  /** Parents of cell k (index into grid) or null for the first row / inactive cells. -1 = outside. */
  parentsOf(k: number): [number, number, number] | null {
    const { W } = this;
    const r = Math.floor(k / W);
    const i = k % W;
    if (r === 0 || !this.active[k]) return null;
    const p = (r - 1) * W;
    if (this.config.shape === 'pyr') return [i > 0 ? p + i - 1 : -1, p + i, i < W - 1 ? p + i + 1 : -1];
    return [p + ((i + W - 1) % W), p + i, p + ((i + 1) % W)];
  }

  // ---- sharing: only the rule entries that are in use, plus the seed ----

  /** Compact text: seed symbols, then used entries as 4 base-36 chars each (key*23+value). */
  encode(): string {
    const seed = Array.from(this.seed, (v) => v.toString(36).padStart(1, '0')).join('');
    const entries = [...this.usedKeys]
      .sort((a, b) => a - b)
      .map((k) => (k * N + this.rule[k]).toString(36).padStart(4, '0'))
      .join('');
    return `${seed}.${entries}`;
  }

  /** Apply an encoded state; entries not listed keep their current (random) values. */
  decode(s: string): boolean {
    const [seed, entries] = s.split('.');
    if (!seed || seed.length !== this.W || entries === undefined || entries.length % 4) return false;
    for (let i = 0; i < this.W; i++) this.seed[i] = Math.min(N - 1, parseInt(seed[i], 36) || 0);
    for (let i = 0; i < entries.length; i += 4) {
      const n = parseInt(entries.slice(i, i + 4), 36);
      const k = Math.floor(n / N);
      if (k < this.rule.length) this.rule[k] = n % N;
    }
    this.evaluate();
    return true;
  }
}
