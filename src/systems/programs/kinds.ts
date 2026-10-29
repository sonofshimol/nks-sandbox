// The kinds of simple programs from chapter 3, with their rule text format,
// examples and explanations. Page ranges were checked against the figure
// references in the Hebrew translation.

import {
  mobileFromCode,
  parseRegProgram,
  runContinuous,
  runCyclicTag,
  runMobile,
  runRegister,
  runSequential,
  runSubstitution,
  runSubstitution2D,
  runTag,
  runTM,
  tmFromCode,
  type Picture,
} from '../../engine/programs';

export type KindId = 'mobile' | 'tm' | 'subst' | 'subst2d' | 'seq' | 'tag' | 'ctag' | 'reg' | 'cont';

export interface KindExample {
  title: string;
  text: string;
  rule: string;
  start: string;
  steps: number;
  page?: string;
}

export interface Kind {
  id: KindId;
  title: string;
  pages: string;
  intro: string;
  /** Number of colors used by the picture (continuous CA: gray levels). */
  colors: (rule: string) => number;
  hasStart: boolean;
  startHint?: string;
  ruleHint: string;
  maxSteps: number;
  defaultSteps: number;
  run: (rule: string, start: string, steps: number) => Picture | string;
  examples: KindExample[];
}

const digits = (s: string, max = 9) =>
  [...s.replace(/\s/g, '')].map((c) => {
    if (/[A-Za-z]/.test(c)) return c.toUpperCase().charCodeAt(0) - 65;
    return Math.min(max, Number(c));
  });

/** "0>01, 1>10" → [[0,1],[1,0]] */
function parseMap(s: string, letters = false): Map<number, number[]> | string {
  const m = new Map<number, number[]>();
  for (const part of s.split(/[,;\n]+/)) {
    const t = part.trim();
    if (!t) continue;
    const [a, b] = t.split(/->|→|>/).map((x) => x.trim());
    if (a === undefined || b === undefined) return `לא הבנתי: "${t}" (צריך לכתוב למשל ${letters ? 'A>AB' : '0>01'})`;
    const from = digits(a);
    if (from.length !== 1) return `בצד שמאל צריך להיות סמל אחד: "${t}"`;
    m.set(from[0], digits(b));
  }
  return m.size ? m : 'אין כללים';
}

const letterString = (s: string) => digits(s.toUpperCase());

export const KINDS: Kind[] = [
  {
    id: 'mobile',
    title: 'אוטומט נייד',
    pages: '71–77',
    intro: 'שורה של תאים כמו באוטומט תאי, אבל רק תא אחד פעיל בכל צעד. הכלל קובע לפי התא הפעיל ושני שכניו מה יהיה הצבע החדש שלו, והאם התא הפעיל זז שמאלה או ימינה.',
    colors: () => 2,
    hasStart: false,
    ruleHint: 'מספר הכלל (0 עד 65535): ספרה בבסיס 4 לכל אחת מ־8 השכנויות',
    maxSteps: 3000,
    defaultSteps: 300,
    run: (rule, _s, steps) => {
      const c = Number(rule);
      if (!Number.isInteger(c) || c < 0 || c > 65535) return 'מספר הכלל צריך להיות בין 0 ל־65535';
      return runMobile(mobileFromCode(c), steps);
    },
    examples: [
      { title: 'תנועה חזרתית', text: 'התא הפעיל זז בקצב קבוע ומשאיר אחריו תבנית חזרתית.', rule: '22858', start: '', steps: 120 },
      { title: 'התרחבות לא סדירה', text: 'התא הפעיל חוזר שוב ושוב, ובכל פעם מגיע קצת יותר רחוק. נמצא בחיפוש בין כל 65,536 הכללים.', rule: '6670', start: '', steps: 2000 },
      { title: 'עוד כלל מורכב', text: 'רוב הכללים פשוטים. לחצו "כלל אקראי" שוב ושוב כדי למצוא עוד כאלה.', rule: '39438', start: '', steps: 2000 },
    ],
  },
  {
    id: 'tm',
    title: 'מכונת טיורינג',
    pages: '78–81',
    intro: 'יש "ראש" אחד שנע על סרט של תאים, ולו יש מצב פנימי. בכל צעד הכלל קובע, לפי המצב של הראש והצבע של התא שמתחתיו, צבע חדש לתא, מצב חדש לראש, והאם הראש זז שמאלה או ימינה.',
    colors: (rule) => Number(rule.split(',')[1]) || 2,
    hasStart: false,
    ruleHint: 'מצבים,צבעים,מספר — למשל 2,2,1234',
    maxSteps: 3000,
    defaultSteps: 300,
    run: (rule, _s, steps) => {
      const [s, k, code] = rule.split(',').map((x) => x.trim());
      const S = Number(s);
      const K = Number(k);
      if (!(S >= 1 && S <= 5 && K >= 2 && K <= 4) || !/^\d+$/.test(code ?? '')) return 'צריך לכתוב מצבים (1–5), צבעים (2–4) ומספר, מופרדים בפסיקים';
      return runTM(tmFromCode(BigInt(code), S, K), steps);
    },
    examples: [
      { title: '2 מצבים, 2 צבעים', text: 'יש 4096 מכונות כאלה, ורובן חזרתיות או מקוננות. זו אחת המסובכות שבהן.', rule: '2,2,3292', start: '', steps: 1500 },
      { title: '3 מצבים, 2 צבעים', text: 'עם יותר מצבים מופיעות תבניות מסובכות יותר.', rule: '3,2,2564276', start: '', steps: 2000 },
      { title: '2 מצבים, 3 צבעים', text: 'שלושה צבעים על הסרט.', rule: '2,3,484185', start: '', steps: 2000 },
      { title: '4 מצבים, 2 צבעים', text: 'ארבעה מצבים לראש.', rule: '4,2,2987363497', start: '', steps: 2000 },
    ],
  },
  {
    id: 'subst',
    title: 'מערכת החלפה',
    pages: '82–87',
    intro: 'בכל צעד כל איבר מוחלף ברצף של איברים לפי צבעו, כולם בבת אחת. בתמונה כל שורה היא צעד, וכל איבר מצויר כאילו הוא מתחלק לאיברים החדשים, ולכן השורות נעשות דקות יותר.',
    colors: (rule) => Math.max(2, ...[...rule].filter((c) => /\d/.test(c)).map((c) => Number(c) + 1)),
    hasStart: true,
    startHint: 'רצף התחלה, למשל 0',
    ruleHint: 'כלל לכל סמל, למשל 0>01, 1>10',
    maxSteps: 14,
    defaultSteps: 8,
    run: (rule, start, steps) => {
      const m = parseMap(rule);
      if (typeof m === 'string') return m;
      const rules: number[][] = [];
      m.forEach((v, k) => (rules[k] = v));
      return runSubstitution(rules, digits(start || '0'), steps);
    },
    examples: [
      { title: 'תואה־מורס', text: 'כל שחור הופך לשחור־לבן וכל לבן ללבן־שחור. נוצר רצף מקונן שלא חוזר על עצמו.', rule: '0>01, 1>10', start: '0', steps: 9 },
      { title: 'פיבונאצ׳י', text: 'האורכים של הרצפים הם מספרי פיבונאצ׳י.', rule: '0>01, 1>0', start: '0', steps: 12 },
      { title: 'שלושה צבעים', text: 'עם יותר צבעים מתקבלים מבנים מקוננים מגוונים.', rule: '0>012, 1>02, 2>1', start: '0', steps: 9 },
    ],
  },
  {
    id: 'subst2d',
    title: 'מערכת החלפה דו־ממדית (פרקטלים)',
    pages: '',
    intro: 'כל ריבוע מוחלף בכל צעד בגוש של n×n ריבועים קטנים לפי צבעו. אחרי כמה צעדים מתקבלים פרקטלים, כמו משולש סרפינסקי.',
    colors: (rule) => Math.max(2, ...[...rule.split(':')[1] ?? ''].filter((c) => /\d/.test(c)).map((c) => Number(c) + 1)),
    hasStart: false,
    ruleHint: 'גודל הגוש ואז גוש לכל צבע (שורה אחרי שורה): 2:0>0000, 1>1110',
    maxSteps: 10,
    defaultSteps: 7,
    run: (rule, _s, steps) => {
      const [nStr, rest] = rule.split(':');
      const n = Number(nStr);
      if (!(n >= 2 && n <= 4) || !rest) return 'צריך לכתוב גודל גוש (2 עד 4), נקודתיים, וכלל לכל צבע';
      const m = parseMap(rest);
      if (typeof m === 'string') return m;
      const blocks: number[][] = [];
      for (const [k, v] of m) {
        if (v.length !== n * n) return `לצבע ${k} צריך ${n * n} ספרות`;
        blocks[k] = v;
      }
      return runSubstitution2D(blocks, n, 1, steps);
    },
    examples: [
      { title: 'משולש סרפינסקי', text: 'כל ריבוע שחור הופך לשלושה שחורים ולבן אחד.', rule: '2:0>0000, 1>1110', start: '', steps: 8 },
      { title: 'שטיח סרפינסקי', text: 'גוש של 3×3 עם חור באמצע.', rule: '3:0>000000000, 1>111101111', start: '', steps: 6 },
      { title: 'קישוט בשלושה צבעים', text: 'צבעים שונים מתחלקים בדרכים שונות.', rule: '2:0>0000, 1>1221, 2>1002', start: '', steps: 8 },
    ],
  },
  {
    id: 'seq',
    title: 'מערכת החלפה סדרתית',
    pages: '89–92',
    intro: 'יש מחרוזת של איברים ורשימה מסודרת של החלפות. בכל צעד מחפשים את ההחלפה הראשונה ברשימה שאפשר לבצע, ומבצעים אותה רק במקום הראשון שבו היא מופיעה.',
    colors: () => 2,
    hasStart: true,
    startHint: 'מחרוזת התחלה, למשל BAB',
    ruleHint: 'החלפות לפי הסדר, למשל BA>AB, A>BBA (A בהיר, B כהה)',
    maxSteps: 2000,
    defaultSteps: 150,
    run: (rule, start, steps) => {
      const rules = [];
      for (const part of rule.split(/[,;\n]+/)) {
        const t = part.trim();
        if (!t) continue;
        const [a, b] = t.split(/->|→|>/);
        if (a === undefined || b === undefined) return `לא הבנתי: "${t}"`;
        rules.push({ from: letterString(a.trim()), to: letterString(b.trim()) });
      }
      if (!rules.length) return 'אין כללים';
      return runSequential(rules, letterString(start || 'BAB'), steps);
    },
    examples: [
      { title: 'מיון', text: 'החלפה אחת: BA הופך ל־AB. ה־A־ים נודדים שמאלה עד שהמחרוזת ממוינת.', rule: 'BA>AB', start: 'BABABBABAB', steps: 40 },
      { title: 'צמיחה', text: 'שתי החלפות: המחרוזת גדלה ויוצרת תבנית מקוננת.', rule: 'ABA>AAB, A>ABA', start: 'AB', steps: 200 },
      { title: 'שלוש החלפות', text: 'נסו לשנות את ההחלפות ולראות מה קורה.', rule: 'ABA>BAAB, BAB>AA, A>ABB', start: 'BA', steps: 300 },
    ],
  },
  {
    id: 'tag',
    title: 'מערכת תגים',
    pages: '93–94',
    intro: 'בכל צעד מוחקים מספר קבוע של איברים מתחילת הרצף, ומוסיפים לסופו גוש של איברים שנקבע לפי האיבר הראשון שנמחק.',
    colors: () => 2,
    hasStart: true,
    startHint: 'רצף התחלה, למשל 10010',
    ruleHint: 'כמה למחוק, נקודתיים, ומה להוסיף: 3:0>00, 1>1101',
    maxSteps: 3000,
    defaultSteps: 300,
    run: (rule, start, steps) => {
      const [nStr, rest] = rule.split(':');
      const n = Number(nStr);
      if (!(n >= 1 && n <= 5) || !rest) return 'צריך לכתוב כמה איברים למחוק (1 עד 5), נקודתיים, וכללים';
      const m = parseMap(rest);
      if (typeof m === 'string') return m;
      const rules: number[][] = [];
      m.forEach((v, k) => (rules[k] = v));
      return runTag(rules, n, digits(start || '1'), steps);
    },
    examples: [
      { title: 'מערכת התגים של פוסט', text: 'מוחקים שלושה איברים בכל צעד. אמיל פוסט חקר אותה ב־1921, ועד היום לא ברור אם היא תמיד נעצרת.', rule: '3:0>00, 1>1101', start: '1001001', steps: 600 },
      { title: 'מחיקה של שניים', text: 'גדילה לא סדירה.', rule: '2:0>1, 1>110', start: '1', steps: 400 },
    ],
  },
  {
    id: 'ctag',
    title: 'מערכת תגים מחזורית',
    pages: '95–96',
    intro: 'יש רשימה של גושים שמשתמשים בהם בתורות. בכל צעד מוחקים את האיבר הראשון; אם הוא היה שחור, מוסיפים לסוף את הגוש התורן.',
    colors: () => 2,
    hasStart: true,
    startHint: 'רצף התחלה, למשל 1',
    ruleHint: 'גושים מופרדים בפסיקים, למשל 11, 10',
    maxSteps: 3000,
    defaultSteps: 300,
    run: (rule, start, steps) => {
      const blocks = rule.split(/[,;\n]+/).map((b) => digits(b.trim(), 1)).filter((b) => b.length || true);
      if (!blocks.length) return 'אין גושים';
      return runCyclicTag(blocks, digits(start || '1', 1), steps);
    },
    examples: [
      { title: 'שני גושים', text: 'מתחילים מאיבר שחור יחיד.', rule: '11, 10', start: '1', steps: 300 },
      { title: 'גדילה מקוננת', text: 'גושים אחרים, התנהגות אחרת.', rule: '1, 101', start: '1', steps: 500 },
      { title: 'שלושה גושים', text: 'נסו לשנות את הגושים.', rule: '011, 10, 101', start: '1', steps: 600 },
    ],
  },
  {
    id: 'reg',
    title: 'מכונת אוגרים',
    pages: '97–100',
    intro: 'כמו מחשב פשוט מאוד: כמה אוגרים שכל אחד מחזיק מספר, ותוכנית של שתי פקודות בלבד. I r מוסיף 1 לאוגר r. D r j: אם באוגר r יש יותר מאפס, מפחיתים 1 וקופצים להוראה j; אחרת ממשיכים להוראה הבאה. אחרי ההוראה האחרונה חוזרים להתחלה.',
    colors: () => 5,
    hasStart: false,
    ruleHint: 'הוראות מופרדות בנקודה־פסיק: I1; D2 1; ...',
    maxSteps: 3000,
    defaultSteps: 200,
    run: (rule, _s, steps) => {
      const prog = parseRegProgram(rule);
      if (typeof prog === 'string') return prog;
      return runRegister(prog, steps);
    },
    examples: [
      { title: 'שש הוראות', text: 'האוגרים עולים ויורדים בגלים שהולכים וגדלים.', rule: 'I2; D1 1; I1; D2 3; I1; D1 2', steps: 1500, start: '' },
      { title: 'שמונה הוראות', text: 'תוכנית שנמצאה בחיפוש בין תוכניות אקראיות.', rule: 'D2 1; I2; D1 2; I1; D2 4; D1 7; D2 2; D2 1', steps: 1500, start: '' },
    ],
  },
  {
    id: 'cont',
    title: 'אוטומט תאי רציף',
    pages: '155–160',
    intro: 'כל תא מחזיק רמת אפור, מספר ממשי בין 0 ל־1, במקום צבע אחד מתוך כמה. הערך החדש הוא החלק השברי של a כפול הממוצע של התא ושני שכניו, ועוד b.',
    colors: () => 254,
    hasStart: false,
    ruleHint: 'a,b — למשל 1.5,0',
    maxSteps: 2000,
    defaultSteps: 200,
    run: (rule, _s, steps) => {
      const [a, b] = rule.split(',').map(Number);
      if (!Number.isFinite(a) || !Number.isFinite(b ?? 0)) return 'צריך לכתוב שני מספרים: a,b';
      return runContinuous(a, b ?? 0, steps);
    },
    examples: [
      { title: 'ממוצע בלבד', text: 'הערך החדש הוא הממוצע. כמו דיפוזיה: הכתם מתפשט ונחלש.', rule: '1,0', start: '', steps: 100, page: '156' },
      { title: 'כפול 3/2', text: 'הממוצע כפול 3/2, והחלק השברי. מתא אחד מתקבלת מורכבות ניכרת.', rule: '1.5,0', start: '', steps: 300, page: '157' },
      { title: 'ועוד 1/4', text: 'מוסיפים 1/4 לממוצע. הרקע חוזר כל 4 צעדים, אבל התבנית עצמה נראית אקראית.', rule: '1,0.25', start: '', steps: 300, page: '158' },
    ],
  },
];

export function findKind(id: string | null): Kind {
  return KINDS.find((k) => k.id === id) ?? KINDS[0];
}
