// Run Length Encoded patterns, as used by Golly and LifeWiki.
//   x = 3, y = 3, rule = B3/S23
//   bo$2bo$3o!
// Two-state: b = dead, o = alive. Multi-state: . = 0, A = 1, B = 2, ... X = 24.
// A number before a tag repeats it; $ ends a row; ! ends the pattern.

export interface Pattern {
  width: number;
  height: number;
  /** Row-major states. */
  cells: Uint8Array;
  rule?: string;
  name?: string;
  comments?: string[];
}

export function parseRLE(text: string): Pattern {
  const lines = text.split(/\r?\n/);
  let width = 0;
  let height = 0;
  let rule: string | undefined;
  let name: string | undefined;
  const comments: string[] = [];
  const body: string[] = [];
  let headerSeen = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      if (/^#N/.test(line)) name = line.slice(2).trim();
      else if (/^#[Cc]/.test(line)) comments.push(line.slice(2).trim());
      continue;
    }
    if (!headerSeen && /^x\s*=/.test(line)) {
      headerSeen = true;
      const x = /x\s*=\s*(\d+)/.exec(line);
      const y = /y\s*=\s*(\d+)/.exec(line);
      const r = /rule\s*=\s*([^\s]+)/.exec(line);
      width = x ? Number(x[1]) : 0;
      height = y ? Number(y[1]) : 0;
      rule = r?.[1];
      continue;
    }
    body.push(line);
    if (line.includes('!')) break;
  }

  // Decode into rows first; the header size may be missing or wrong.
  const rows: number[][] = [[]];
  let count = '';
  const src = body.join('');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '!') break;
    if (/\d/.test(c)) {
      count += c;
      continue;
    }
    const n = count ? Number(count) : 1;
    count = '';
    if (c === '$') {
      for (let k = 0; k < n; k++) rows.push([]);
      continue;
    }
    let state: number;
    if (c === 'b' || c === '.') state = 0;
    else if (c === 'o') state = 1;
    else if (c >= 'A' && c <= 'X') state = c.charCodeAt(0) - 64;
    else if (c >= 'p' && c <= 'y' && i + 1 < src.length) {
      // Multi-char states (pA..yO) for >24 states; fold to the last state we support.
      const next = src[++i];
      state = 24 + (c.charCodeAt(0) - 112) * 24 + (next.charCodeAt(0) - 64);
    } else continue;
    const row = rows[rows.length - 1];
    for (let k = 0; k < n; k++) row.push(state);
  }
  while (rows.length > 1 && rows[rows.length - 1].length === 0 && rows.length > height) rows.pop();
  const w = Math.max(width, ...rows.map((r) => r.length));
  const h = Math.max(height, rows.length);
  const cells = new Uint8Array(w * h);
  rows.forEach((r, y) => r.forEach((v, x) => (cells[y * w + x] = Math.min(255, v))));
  return { width: w, height: h, cells, rule, name, comments };
}

function tag(state: number, twoState: boolean): string {
  if (twoState) return state ? 'o' : 'b';
  return state === 0 ? '.' : String.fromCharCode(64 + state);
}

/** Encode a pattern; lines are wrapped at 70 characters like Golly. */
export function writeRLE(p: Pattern): string {
  const { width: W, height: H, cells } = p;
  let maxState = 0;
  for (const v of cells) if (v > maxState) maxState = v;
  const two = maxState <= 1;
  const out: string[] = [];
  let pendingRows = 0;
  for (let y = 0; y < H; y++) {
    // Trim trailing dead cells of the row.
    let end = W;
    while (end > 0 && cells[y * W + end - 1] === 0) end--;
    if (end === 0) {
      pendingRows++;
      continue;
    }
    if (y > 0) {
      const n = pendingRows + 1;
      out.push(n > 1 ? `${n}$` : '$');
    }
    pendingRows = 0;
    let x = 0;
    while (x < end) {
      const v = cells[y * W + x];
      let n = 1;
      while (x + n < end && cells[y * W + x + n] === v) n++;
      out.push((n > 1 ? n : '') + tag(v, two));
      x += n;
    }
  }
  out.push('!');
  // Wrap lines
  const lines: string[] = [];
  let line = '';
  for (const t of out) {
    if (line.length + t.length > 70) {
      lines.push(line);
      line = '';
    }
    line += t;
  }
  lines.push(line);
  const header = `x = ${W}, y = ${H}${p.rule ? `, rule = ${p.rule}` : ''}`;
  const head = p.name ? [`#N ${p.name}`] : [];
  return [...head, header, ...lines].join('\n');
}

/** Smallest box around the non-zero cells of a grid, or null if empty. */
export function boundingBox(cells: Uint8Array, W: number, H: number) {
  let x0 = W,
    y0 = H,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (cells[y * W + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function crop(cells: Uint8Array, W: number, box: { x: number; y: number; w: number; h: number }): Uint8Array {
  const out = new Uint8Array(box.w * box.h);
  for (let y = 0; y < box.h; y++) out.set(cells.subarray((box.y + y) * W + box.x, (box.y + y) * W + box.x + box.w), y * box.w);
  return out;
}
