// Two-dimensional "Life-like" rules: outer totalistic rules on a square grid.
// One representation covers the whole family:
//   life         B3/S23, HighLife B36/S23, ...           (2 states, range 1)
//   generations  B2/S/C3 (Brian's Brain), ...            (dying states 2..C-1)
//   ltl          Larger than Life: R5,C0,M1,S34..58,B34..45,NM  (range R)
//   wireworld    electrons on wires (4 states, its own update)
// A cell counts its neighbors in state 1 ("alive"). The GPU and the CPU
// reference implementation below share these tables.

export type LifeFamily = 'life' | 'generations' | 'ltl' | 'wireworld';

export interface LifeRule {
  family: LifeFamily;
  /** Number of states (2 for life; C for generations and LtL; 4 for WireWorld). */
  states: number;
  range: number;
  /** Count the cell itself as a neighbor (LtL "M1"). */
  center: boolean;
  /** Von Neumann (diamond) neighborhood instead of Moore (square). */
  vonNeumann: boolean;
  /** Indexed by neighbor count: become alive from state 0 / stay alive from state 1. */
  birth: boolean[];
  survive: boolean[];
}

export function maxCount(range: number, vonNeumann: boolean, center: boolean): number {
  const n = vonNeumann ? 2 * range * (range + 1) : (2 * range + 1) ** 2 - 1;
  return n + (center ? 1 : 0);
}

function emptyRule(family: LifeFamily, states: number, range = 1, center = false, vonNeumann = false): LifeRule {
  const m = maxCount(range, vonNeumann, center);
  return {
    family,
    states,
    range,
    center,
    vonNeumann,
    birth: new Array(m + 1).fill(false),
    survive: new Array(m + 1).fill(false),
  };
}

const digitsOf = (s: string) => [...s].filter((c) => /[0-8]/.test(c)).map(Number);

/** Parse rule notation. Returns null if it cannot be understood. */
export function parseRule(input: string): LifeRule | null {
  const s = input.trim().replace(/\s+/g, '');
  if (!s) return null;
  if (/^wire ?world$/i.test(s)) return emptyRule('wireworld', 4);

  // Larger than Life (Golly / Kellie Evans notation)
  if (/^R\d+,/i.test(s)) {
    const get = (k: string) => new RegExp(`(?:^|,)${k}(\\d+)(?:\\.\\.(\\d+))?`, 'i').exec(s);
    const R = get('R');
    if (!R) return null;
    const range = Math.min(10, Math.max(1, Number(R[1])));
    const C = get('C');
    const M = get('M');
    const states = Math.max(2, C ? Number(C[1]) : 2);
    const center = M ? M[1] === '1' : false;
    const vn = /,N[N]/i.test(s);
    const rule = emptyRule('ltl', states, range, center, vn);
    const fill = (arr: boolean[], k: string) => {
      const m = get(k);
      if (!m) return;
      const a = Number(m[1]);
      const b = m[2] !== undefined ? Number(m[2]) : a;
      for (let i = a; i <= b && i < arr.length; i++) arr[i] = true;
    };
    fill(rule.survive, 'S');
    fill(rule.birth, 'B');
    return rule;
  }

  // B3/S23, B2/S/C3, b3s23, B3/S23V
  let m = /^B([0-8]*)\/?S([0-8]*)(?:\/?[CG](\d+))?(V)?$/i.exec(s);
  if (m) {
    const states = m[3] ? Math.max(2, Number(m[3])) : 2;
    const rule = emptyRule(states > 2 ? 'generations' : 'life', states, 1, false, !!m[4]);
    digitsOf(m[1]).forEach((d) => d < rule.birth.length && (rule.birth[d] = true));
    digitsOf(m[2]).forEach((d) => d < rule.survive.length && (rule.survive[d] = true));
    return rule;
  }
  // Old S/B and S/B/C notation: 23/3, /2/3
  m = /^([0-8]*)\/([0-8]*)(?:\/(\d+))?$/.exec(s);
  if (m) {
    const states = m[3] ? Math.max(2, Number(m[3])) : 2;
    const rule = emptyRule(states > 2 ? 'generations' : 'life', states);
    digitsOf(m[1]).forEach((d) => (rule.survive[d] = true));
    digitsOf(m[2]).forEach((d) => (rule.birth[d] = true));
    return rule;
  }
  return null;
}

function ranges(arr: boolean[]): string {
  const out: string[] = [];
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i]) continue;
    let j = i;
    while (j + 1 < arr.length && arr[j + 1]) j++;
    out.push(i === j ? `${i}` : `${i}..${j}`);
    i = j;
  }
  return out.join(',');
}

export function formatRule(rule: LifeRule): string {
  if (rule.family === 'wireworld') return 'WireWorld';
  if (rule.family === 'ltl' || rule.range > 1) {
    // Golly allows a single interval per B and S; we write all intervals.
    const one = (a: boolean[], k: string) => {
      const r = ranges(a);
      return r ? r.split(',').map((x) => k + x).join(',') : '';
    };
    const parts = [`R${rule.range}`, `C${rule.states > 2 ? rule.states : 0}`, `M${rule.center ? 1 : 0}`];
    const S = one(rule.survive, 'S');
    const B = one(rule.birth, 'B');
    if (S) parts.push(S);
    if (B) parts.push(B);
    parts.push(rule.vonNeumann ? 'NN' : 'NM');
    return parts.join(',');
  }
  const list = (a: boolean[]) => a.map((v, i) => (v ? i : '')).join('');
  const base = `B${list(rule.birth)}/S${list(rule.survive)}`;
  return (rule.states > 2 ? `${base}/C${rule.states}` : base) + (rule.vonNeumann ? 'V' : '');
}

/** One step on the CPU (reference implementation for tests and small grids). */
export function stepCPU(grid: Uint8Array, W: number, H: number, rule: LifeRule, wrap: boolean): Uint8Array {
  const out = new Uint8Array(W * H);
  const R = rule.range;
  const at = (x: number, y: number) => {
    if (wrap) {
      x = ((x % W) + W) % W;
      y = ((y % H) + H) % H;
    } else if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return grid[y * W + x];
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const s = grid[y * W + x];
      if (rule.family === 'wireworld') {
        if (s === 1) out[y * W + x] = 2;
        else if (s === 2) out[y * W + x] = 3;
        else if (s === 3) {
          let h = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(x + dx, y + dy) === 1) h++;
          out[y * W + x] = h === 1 || h === 2 ? 1 : 3;
        }
        continue;
      }
      let n = 0;
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          if (rule.vonNeumann && Math.abs(dx) + Math.abs(dy) > R) continue;
          if (!dx && !dy && !rule.center) continue;
          if (at(x + dx, y + dy) === 1) n++;
        }
      let ns: number;
      if (s === 0) ns = rule.birth[n] ? 1 : 0;
      else if (s === 1) ns = rule.survive[n] ? 1 : rule.states > 2 ? 2 : 0;
      else ns = (s + 1) % rule.states;
      out[y * W + x] = ns;
    }
  return out;
}

/** Named rules from LifeWiki / Golly. */
export const NAMED_RULES: { name: string; rule: string; text: string }[] = [
  { name: 'משחק החיים', rule: 'B3/S23', text: 'תא נולד כשיש לו בדיוק 3 שכנים חיים, ושורד כשיש לו 2 או 3.' },
  { name: 'HighLife', rule: 'B36/S23', text: 'כמו משחק החיים, ונוסף לידה גם עם 6 שכנים. יש בו "משכפל" שמעתיק את עצמו.' },
  { name: 'Seeds', rule: 'B2/S', text: 'כל תא חי מת מיד, ונולד תא חדש כשיש בדיוק 2 שכנים. מתפוצץ כמעט מכל דבר.' },
  { name: 'Day & Night', rule: 'B3678/S34678', text: 'סימטרי בין חיים למוות: אזורים חיים ומתים מתנהגים אותו דבר.' },
  { name: 'Life without Death', rule: 'B3/S012345678', text: 'תאים חיים לעולם לא מתים, והתבנית צומחת כמו גביש.' },
  { name: 'Replicator', rule: 'B1357/S1357', text: 'כל תבנית משכפלת את עצמה שוב ושוב.' },
  { name: 'Maze', rule: 'B3/S12345', text: 'נוצרים מבוכים של מסדרונות.' },
  { name: '2x2', rule: 'B36/S125', text: 'מלא בלוקים של 2 על 2 ומתנדים מעניינים.' },
  { name: 'Diamoeba', rule: 'B35678/S5678', text: 'כתמים גדולים בצורת יהלום שמשנים צורה לאט.' },
  { name: "Brian's Brain", rule: 'B2/S/C3', text: 'שלושה מצבים: חי, גוסס ומת. כל תא חי מת מיד, ונולד כשיש בדיוק 2 שכנים חיים. מלא "חלליות".' },
  { name: 'Star Wars', rule: 'B2/S345/C4', text: 'Generations עם ארבעה מצבים: מבנים שנעים ויורים.' },
  { name: 'WireWorld', rule: 'WireWorld', text: 'חשמל על חוטים: ראש אלקטרון הופך לזנב, זנב חוזר להיות חוט, וחוט הופך לראש כשיש לידו ראש אחד או שניים.' },
  { name: 'Bosco (Larger than Life)', rule: 'R5,C0,M1,S34..58,B34..45,NM', text: 'טווח 5: סופרים 121 תאים. נוצרים "חיידקים" עגולים שזזים.' },
  { name: 'Majority (Larger than Life)', rule: 'R4,C0,M1,S41..81,B41..81,NM', text: 'כל תא מקבל את צבע הרוב בריבוע של 81 תאים סביבו. מתקבלים כתמים חלקים.' },
];
