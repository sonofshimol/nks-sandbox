import { describe, expect, it } from 'vitest';
import { piDigits, sqrtDigits, SEQUENCES, sieve } from '../src/engine/numbers';
import { runCyclicTag, runSequential, runSubstitution, runTM, tmCode, tmFromCode } from '../src/engine/programs';

describe('numbers', () => {
  it('digits of pi and square roots', () => {
    expect(piDigits(10, 30).join('').slice(0, 31)).toBe('3141592653589793238462643383279');
    expect(piDigits(2, 20).join('').slice(0, 12)).toBe('110010010000');
    expect(sqrtDigits(2, 10, 15).join('')).toBe('1414213562373095');
  });
  it('Hofstadter Q sequence', () => {
    expect(SEQUENCES.hofstadter.f(12)).toEqual([1, 1, 2, 3, 3, 4, 5, 5, 6, 6, 6, 8]);
  });
  it('sieve leaves the primes', () => {
    const p = sieve(30);
    const last = Array.from(p.cells.subarray((p.height - 1) * 30, p.height * 30));
    const primes = last.map((v, i) => (v ? i + 1 : 0)).filter(Boolean);
    expect(primes).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  });
});

describe('simple programs', () => {
  it('Thue-Morse substitution', () => {
    const p = runSubstitution([[0, 1], [1, 0]], [0], 4);
    const last = Array.from(p.cells.subarray((p.height - 1) * p.width, p.height * p.width));
    expect(last.join('')).toBe('0110100110010110');
  });
  it('sequential substitution sorts with BA→AB', () => {
    const p = runSequential([{ from: [1, 0], to: [0, 1] }], [1, 0, 1, 0], 10);
    expect(p.used.length).toBe(3);
    expect(Array.from(p.cells.subarray((p.height - 1) * p.width, p.height * p.width))).toEqual([0, 0, 1, 1]);
  });
  it('cyclic tag system appends blocks', () => {
    const p = runCyclicTag([[1, 1], [1, 0]], [1], 1);
    expect(Array.from(p.cells.subarray(p.width, p.width + 2))).toEqual([1, 1]);
  });
  it('Turing machine codes round-trip', () => {
    const r = tmFromCode(123456n, 3, 2);
    expect(tmCode(r)).toBe(123456n);
    expect(runTM(r, 50).height).toBeGreaterThan(1);
  });
});
