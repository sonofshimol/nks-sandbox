// Parameters of the letters automaton and their URL form.

export interface LettersParams {
  shape: 'pyr' | 'rect';
  size: number;
  minLen: number;
  whole: boolean;
  lockSeed: boolean;
  /** Opening letter (pyramid) or first row (rectangle); empty = random. */
  seedText: string;
  /** Encoded seed + rule entries in use (LettersWorld.encode), or '' for a fresh random start. */
  state: string;
}

export function defaults(): LettersParams {
  return { shape: 'pyr', size: 1, minLen: 4, whole: false, lockSeed: false, seedText: '', state: '' };
}

export function fromQuery(q: URLSearchParams): LettersParams {
  const d = defaults();
  const size = Number(q.get('size'));
  const minLen = Number(q.get('min'));
  return {
    shape: q.get('shape') === 'rect' ? 'rect' : 'pyr',
    size: q.has('size') && [0, 1, 2].includes(size) ? size : d.size,
    minLen: q.has('min') && [3, 4, 5].includes(minLen) ? minLen : d.minLen,
    whole: q.get('whole') === '1',
    lockSeed: q.get('lockseed') === '1',
    seedText: q.get('s') ?? '',
    state: q.get('g') ?? '',
  };
}

export function toQuery(p: LettersParams): Record<string, string> {
  const q: Record<string, string> = {};
  if (p.shape !== 'pyr') q.shape = p.shape;
  if (p.size !== 1) q.size = String(p.size);
  if (p.minLen !== 4) q.min = String(p.minLen);
  if (p.whole) q.whole = '1';
  if (p.lockSeed) q.lockseed = '1';
  if (p.seedText) q.s = p.seedText;
  if (p.state) q.g = p.state;
  return q;
}

/**
 * One color per letter, easy to tell apart (based on Kelly's colors of maximum
 * contrast). Space is white. Letters are also written inside the cells when
 * zoomed in, so color is never the only cue.
 */
export const LETTER_COLORS = [
  '#ffffff', // space
  '#222222', // א
  '#f3c300', // ב
  '#875692', // ג
  '#f38400', // ד
  '#a1caf1', // ה
  '#be0032', // ו
  '#c2b280', // ז
  '#848482', // ח
  '#008856', // ט
  '#e68fac', // י
  '#0067a5', // כ
  '#f99379', // ל
  '#604e97', // מ
  '#17becf', // נ
  '#b3446c', // ס
  '#dcd300', // ע
  '#882d17', // פ
  '#8db600', // צ
  '#654522', // ק
  '#e25822', // ר
  '#2b3d26', // ש
  '#7fd4a8', // ת
];
