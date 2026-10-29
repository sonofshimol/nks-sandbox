import { describe, expect, it } from 'vitest';
import { formatRule, parseRule, stepCPU } from '../src/engine/life';
import { PATTERNS } from '../src/engine/patterns';
import { boundingBox, crop, parseRLE, writeRLE } from '../src/engine/rle';

function place(rle: string, W: number, H: number) {
  const p = parseRLE(rle);
  const grid = new Uint8Array(W * H);
  const ox = Math.floor((W - p.width) / 2);
  const oy = Math.floor((H - p.height) / 2);
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) grid[(oy + y) * W + ox + x] = p.cells[y * p.width + x];
  return grid;
}

function normalized(grid: Uint8Array, W: number, H: number) {
  const b = boundingBox(grid, W, H);
  return b ? { b, cells: Array.from(crop(grid, W, b)) } : null;
}

describe('rule notation', () => {
  it('parses and formats B/S, S/B, Generations and LtL', () => {
    expect(formatRule(parseRule('B3/S23')!)).toBe('B3/S23');
    expect(formatRule(parseRule('b36s23')!)).toBe('B36/S23');
    expect(formatRule(parseRule('23/3')!)).toBe('B3/S23');
    const bb = parseRule('B2/S/C3')!;
    expect(bb.family).toBe('generations');
    expect(bb.states).toBe(3);
    expect(formatRule(parseRule('/2/3')!)).toBe('B2/S/C3');
    const bosco = parseRule('R5,C0,M1,S34..58,B34..45,NM')!;
    expect(bosco.range).toBe(5);
    expect(bosco.center).toBe(true);
    expect(bosco.birth.length).toBe(122);
    expect(formatRule(bosco)).toBe('R5,C0,M1,S34..58,B34..45,NM');
    expect(parseRule('WireWorld')!.family).toBe('wireworld');
    expect(parseRule('hello')).toBeNull();
  });
});

describe('RLE', () => {
  it('reads the glider gun with header and rule', () => {
    const gun = PATTERNS.find((p) => p.id === 'gosper')!;
    const p = parseRLE(`x = 36, y = 9, rule = B3/S23\n${gun.rle}`);
    expect(p.width).toBe(36);
    expect(p.height).toBe(9);
    expect(p.rule).toBe('B3/S23');
    expect(p.cells.reduce((a, b) => a + b, 0)).toBe(36);
  });

  it('round-trips every library pattern without loss', () => {
    for (const lib of PATTERNS) {
      const p = parseRLE(lib.rle);
      const back = parseRLE(writeRLE({ ...p, rule: lib.rule }));
      expect(back.rule).toBe(lib.rule);
      expect(normalized(back.cells, back.width, back.height)).toEqual(normalized(p.cells, p.width, p.height));
    }
  });

  it('handles multi-state patterns and blank rows', () => {
    const p = parseRLE('x = 3, y = 4, rule = B2/S/C3\nA.B3$C2A!');
    expect(Array.from(p.cells)).toEqual([1, 0, 2, 0, 0, 0, 0, 0, 0, 3, 1, 1]);
    const back = parseRLE(writeRLE(p));
    expect(Array.from(back.cells)).toEqual(Array.from(p.cells));
  });
});

describe('Game of Life oscillators and spaceships', () => {
  for (const lib of PATTERNS.filter((p) => p.period)) {
    it(`${lib.id} has period ${lib.period}${lib.move ? ` and moves ${lib.move}` : ''}`, () => {
      const W = 40;
      const H = 40;
      const rule = parseRule(lib.rule)!;
      let g: Uint8Array = place(lib.rle, W, H);
      const start = normalized(g, W, H)!;
      for (let i = 1; i <= lib.period!; i++) {
        g = stepCPU(g, W, H, rule, false);
        const now = normalized(g, W, H)!;
        const same = JSON.stringify(now.cells) === JSON.stringify(start.cells);
        if (i < lib.period! && !lib.move) expect(same && now.b.x === start.b.x && now.b.y === start.b.y).toBe(false);
        if (i === lib.period!) {
          expect(now.cells).toEqual(start.cells);
          const [dx, dy] = lib.move ?? [0, 0];
          expect([now.b.x - start.b.x, now.b.y - start.b.y]).toEqual([dx, dy]);
        }
      }
    });
  }

  it('the Gosper gun fires a glider every 30 generations', () => {
    const W = 80;
    const H = 60;
    const rule = parseRule('B3/S23')!;
    let g: Uint8Array = place(PATTERNS.find((p) => p.id === 'gosper')!.rle, W, H);
    const pop = (a: Uint8Array) => a.reduce((s, v) => s + v, 0);
    const p0 = pop(g);
    for (let i = 0; i < 30; i++) g = stepCPU(g, W, H, rule, false);
    expect(pop(g)).toBe(p0 + 5);
  });

  it("Brian's Brain: alive cells always become dying, dying cells die", () => {
    const rule = parseRule('B2/S/C3')!;
    const g = new Uint8Array(25);
    g[12] = 1;
    g[13] = 2;
    const n = stepCPU(g, 5, 5, rule, false);
    expect(n[12]).toBe(2);
    expect(n[13]).toBe(0);
  });

  it('WireWorld: an electron travels along a wire', () => {
    const rule = parseRule('WireWorld')!;
    // tail, head, wire, wire on a row
    let g: Uint8Array = Uint8Array.from([2, 1, 3, 3, 3]);
    g = stepCPU(g, 5, 1, rule, false);
    expect(Array.from(g)).toEqual([3, 2, 1, 3, 3]);
  });
});
