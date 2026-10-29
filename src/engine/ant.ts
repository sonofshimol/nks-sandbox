// Two-dimensional Turing machines on a square grid ("ants"). The rule is a
// string with one turn per color: L (left), R (right), N (no turn), U (U-turn).
// At each step the ant turns according to the color under it, changes that
// cell to the next color, and moves forward one cell. "RL" is Langton's ant.

export interface Ant {
  x: number;
  y: number;
  /** 0 up, 1 right, 2 down, 3 left */
  dir: number;
}

export function parseTurns(rule: string): number[] | null {
  const turns = [...rule.toUpperCase()].map((c) => ({ N: 0, R: 1, U: 2, L: 3 })[c]);
  if (turns.length < 2 || turns.length > 12 || turns.some((t) => t === undefined)) return null;
  return turns as number[];
}

export class AntWorld {
  cells: Uint8Array;
  ants: Ant[];
  steps = 0;

  constructor(
    public W: number,
    public H: number,
    public turns: number[],
    count = 1,
  ) {
    this.cells = new Uint8Array(W * H);
    this.ants = [];
    for (let i = 0; i < count; i++)
      this.ants.push({ x: Math.floor(W / 2) + (i - Math.floor(count / 2)) * 6, y: Math.floor(H / 2), dir: 0 });
  }

  step(n = 1) {
    const { W, H, cells, turns } = this;
    const k = turns.length;
    for (let s = 0; s < n; s++) {
      for (const a of this.ants) {
        const i = a.y * W + a.x;
        const c = cells[i];
        a.dir = (a.dir + turns[c]) & 3;
        cells[i] = (c + 1) % k;
        if (a.dir === 0) a.y = (a.y - 1 + H) % H;
        else if (a.dir === 1) a.x = (a.x + 1) % W;
        else if (a.dir === 2) a.y = (a.y + 1) % H;
        else a.x = (a.x - 1 + W) % W;
      }
      this.steps++;
    }
  }
}
