// A short Hebrew sentence that says what a 1D rule does.
// Color tokens are written as {0}, {1}, ... and rendered as swatches by the UI.

import { mirrorRule, neighborhoodSize, ruleToCode, type Rule1D } from '../../engine/ca1d';

const POS = ['השכן השמאלי', 'התא עצמו', 'השכן הימני'];

/** Hand-written descriptions for well-known elementary rules. */
const KNOWN: Record<number, string> = {
  30: 'התא החדש {1} כשבדיוק אחד משני אלה נכון: השכן השמאלי {1}, או שהתא עצמו או השכן הימני {1}.',
  110: 'התא החדש {1} אם התא עצמו או השכן הימני {1}, חוץ מהמקרה שבו שלושת התאים {1}.',
  184: 'כלל "התנועה": כל {1} הוא מכונית שמתקדמת ימינה בתא אחד אם התא שלפניה ריק, ונשארת במקום אם הוא תפוס.',
};

/** Which of the 3 positions the output of an elementary rule depends on. */
function dependencies(t: Uint8Array): number[] {
  const deps: number[] = [];
  for (let pos = 0; pos < 3; pos++) {
    const bit = 4 >> pos;
    for (let n = 0; n < 8; n++) {
      if (t[n] !== t[n ^ bit]) {
        deps.push(pos);
        break;
      }
    }
  }
  return deps;
}

function listHe(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' ו' + items[items.length - 1];
}

function describeElementary(rule: Rule1D): string {
  const t = rule.table;
  const code = Number(ruleToCode(rule));
  if (KNOWN[code]) return KNOWN[code];

  const deps = dependencies(t);
  const names = deps.map((p) => POS[p]);
  const value = (l: number, c: number, r: number) => t[(l << 2) | (c << 1) | r];
  const bitsOf = (n: number) => [(n >> 2) & 1, (n >> 1) & 1, n & 1];

  if (deps.length === 0) return `כל תא נעשה {${t[0]}} כבר אחרי צעד אחד, לא משנה מה היה.`;

  if (deps.length === 1) {
    const p = deps[0];
    const identity = [0, 1].every((v) => value(p === 0 ? v : 0, p === 1 ? v : 0, p === 2 ? v : 0) === v);
    if (identity) {
      if (p === 1) return 'כל תא שומר על הצבע שלו: שום דבר לא משתנה.';
      return `כל תא מעתיק את ${POS[p]}, ולכן כל התבנית זזה ${p === 0 ? 'ימינה' : 'שמאלה'} בתא אחד בכל צעד.`;
    }
    if (p === 1) return 'כל תא מתחלף לצבע ההפוך בכל צעד.';
    return `כל תא מקבל את הצבע ההפוך מזה של ${POS[p]}.`;
  }

  // Parity (XOR / XNOR) of the dependencies.
  let isXor = true;
  let isXnor = true;
  let isOr = true;
  let isAnd = true;
  for (let n = 0; n < 8; n++) {
    const b = bitsOf(n);
    const ones = deps.reduce((s, p) => s + b[p], 0);
    if (t[n] !== ones % 2) isXor = false;
    if (t[n] !== 1 - (ones % 2)) isXnor = false;
    if (t[n] !== (ones > 0 ? 1 : 0)) isOr = false;
    if (t[n] !== (ones === deps.length ? 1 : 0)) isAnd = false;
  }
  const who = listHe(names);
  if (isXor) return `התא החדש {1} אם מספר ה־{1} מבין ${who} הוא אי־זוגי.`;
  if (isXnor) return `התא החדש {1} אם מספר ה־{1} מבין ${who} הוא זוגי.`;
  if (isOr) return `התא החדש {1} אם לפחות אחד מבין ${who} הוא {1}.`;
  if (isAnd) return `התא החדש {1} רק אם ${who} כולם {1}.`;

  // Depends only on how many of the three cells are 1?
  const byCount = new Map<number, number>();
  let countOnly = deps.length === 3;
  for (let n = 0; n < 8 && countOnly; n++) {
    const c = bitsOf(n).reduce((a, b) => a + b, 0);
    const prev = byCount.get(c);
    if (prev !== undefined && prev !== t[n]) countOnly = false;
    byCount.set(c, t[n]);
  }
  if (countOnly) {
    const counts = [...byCount].filter(([, v]) => v === 1).map(([c]) => String(c));
    return `התא החדש {1} כשמספר ה־{1} בשכנות (כולל התא עצמו) הוא ${listHe(counts)}.`;
  }

  const ones = t.reduce((a, b) => a + b, 0);
  const mirror = Number(ruleToCode(mirrorRule(rule)));
  const sym = mirror === code ? 'הכלל סימטרי: שמאל וימין משחקים אותו תפקיד.' : `תמונת המראה שלו היא כלל ${mirror}.`;
  return `${ones} מתוך 8 השכנויות האפשריות נותנות {1}. ${sym}`;
}

export function describeRule(rule: Rule1D): string {
  const { k, r } = rule;
  const n = neighborhoodSize(r);
  if (rule.totalistic) {
    const quiet = rule.table[0] === 0 ? ' רקע של {0} נשאר {0}.' : '';
    return `הצבע החדש תלוי רק בסכום הצבעים של ${n} תאים: התא עצמו ו־${r} שכנים מכל צד (הצבעים נספרים כמספרים 0 עד ${k - 1}).${quiet}`;
  }
  if (k === 2 && r === 1) return describeElementary(rule);
  const mirror = ruleToCode(mirrorRule(rule)) === ruleToCode(rule) ? ' הכלל סימטרי.' : '';
  return `לכל אחד מ־${k ** n} הצירופים של ${n} תאים ב־${k} צבעים, הכלל קובע צבע חדש לתא האמצעי.${mirror}`;
}
