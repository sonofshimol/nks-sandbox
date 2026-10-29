import { describe, expect, it } from 'vitest';
import { codeToRule, parseRuleDigits, randomizeRule, ruleDigits, ruleToCode } from '../src/engine/ca1d';
import { LettersWorld, loadWords } from '../src/engine/letters';
import { mulberry32 } from '../src/engine/random';

describe('rule digits', () => {
  it('reads base-2 totalistic digits (most significant first)', () => {
    const t = parseRuleDigits('0110', 2, 4);
    expect(t).toBeInstanceOf(Uint8Array);
    expect(ruleToCode({ k: 2, r: 1, totalistic: true, table: t as Uint8Array })).toBe(6n);
  });

  it('expands a half followed by | into a palindrome', () => {
    const full = parseRuleDigits('33312|21333', 4, 10) as Uint8Array;
    const half = parseRuleDigits('33312|', 4, 10) as Uint8Array;
    expect(Array.from(half)).toEqual(Array.from(full));
    // odd length: the middle digit is shared
    const odd = parseRuleDigits('1202|', 3, 7) as Uint8Array;
    expect(Array.from(odd).reverse().join('')).toBe('1202021');
  });

  it('pads short input and rejects bad digits', () => {
    expect(Array.from(parseRuleDigits('11110', 2, 8) as Uint8Array).reverse().join('')).toBe('00011110');
    expect(typeof parseRuleDigits('0120', 2, 4)).toBe('string');
    expect(typeof parseRuleDigits('123456789', 2, 8)).toBe('string');
  });

  it('writes palindromes with a symmetry bar and round-trips', () => {
    const rule = { k: 4, r: 1, totalistic: true, table: parseRuleDigits('33312|', 4, 10) as Uint8Array };
    expect(ruleDigits(rule)).toBe('33312|21333');
    expect(ruleDigits(codeToRule(30n, 2, 1, false))).toBe('00011110');
  });

  it('random changes keep locked entries', () => {
    const rule = codeToRule(1599n, 3, 1, true);
    const locked = new Set([0, 2, 5]);
    for (let s = 0; s < 20; s++) {
      const r = randomizeRule(rule, locked, mulberry32(s));
      for (const i of locked) expect(r.table[i]).toBe(rule.table[i]);
    }
  });
});

describe('letters automaton', () => {
  const words = loadWords('שלום\nעולם\nבית\nספר\nאהבה\nמים\nיום');

  it('normalizes final letters in the dictionary', () => {
    expect(words.has('שלומ')).toBe(true);
    expect(words.has('עולמ')).toBe(true);
  });

  it('the rule is symmetric and evolution never lowers the score', () => {
    const w = new LettersWorld({ shape: 'pyr', size: 0, minLen: 3, whole: false }, words, mulberry32(1));
    w.fresh('ש');
    let best = w.best;
    for (let i = 0; i < 300; i++) {
      w.step();
      expect(w.best).toBeGreaterThanOrEqual(best);
      best = w.best;
    }
  });

  it('encode/decode restores the same grid', () => {
    const a = new LettersWorld({ shape: 'pyr', size: 1, minLen: 3, whole: false }, words, mulberry32(2));
    a.fresh('');
    for (let i = 0; i < 200; i++) a.step();
    const b = new LettersWorld({ shape: 'pyr', size: 1, minLen: 3, whole: false }, words, mulberry32(99));
    b.fresh('');
    expect(b.decode(a.encode())).toBe(true);
    expect(Array.from(b.grid)).toEqual(Array.from(a.grid));
  });
});
