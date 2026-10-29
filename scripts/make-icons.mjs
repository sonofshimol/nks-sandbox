// Generates the app icons (rule 30 from a single cell, in the green palette):
// public/icon.svg, public/icon-192.png, public/icon-512.png. No dependencies.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const STEPS = 15;
const W = 2 * STEPS + 1;
const rows = [];
let row = new Array(W).fill(0);
row[STEPS] = 1;
for (let t = 0; t <= STEPS; t++) {
  rows.push(row);
  row = row.map((_, x) => {
    const l = row[x - 1] ?? 0, c = row[x], r = row[x + 1] ?? 0;
    return (30 >> ((l << 2) | (c << 1) | r)) & 1;
  });
}

const BG = [0xcf, 0xe9, 0xc8];
const FG = [0x1f, 0x6b, 0x3a];
const EDGE = [0x0b, 0x2e, 0x17];

// ---- SVG ----
const cell = 1;
let rects = '';
rows.forEach((r, y) => r.forEach((v, x) => {
  if (v) rects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}"/>`;
}));
const pad = 3;
const size = W + 2 * pad;
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad - (W - STEPS - 1) / 2} ${size} ${size}" shape-rendering="crispEdges">
<rect x="${-pad}" y="${-pad - (W - STEPS - 1) / 2}" width="${size}" height="${size}" rx="6" fill="${hex(BG)}"/>
<g fill="${hex(FG)}">${rects}</g>
</svg>
`;
writeFileSync('public/icon.svg', svg);

// ---- PNG ----
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(px) {
  // Maskable-safe: the pattern stays inside the central 70%.
  const raw = Buffer.alloc((px * 3 + 1) * px);
  const inner = px * 0.7;
  const cs = inner / W;
  const x0 = (px - W * cs) / 2;
  const y0 = (px - (STEPS + 1) * cs) / 2;
  for (let y = 0; y < px; y++) {
    raw[y * (px * 3 + 1)] = 0;
    for (let x = 0; x < px; x++) {
      const cx = Math.floor((x - x0) / cs);
      const cy = Math.floor((y - y0) / cs);
      let c = BG;
      if (cy >= 0 && cy <= STEPS && cx >= 0 && cx < W && rows[cy][cx]) {
        const fx = (x - x0) / cs - cx;
        const fy = (y - y0) / cs - cy;
        c = px >= 192 && (fx < 0.08 || fy < 0.08) ? EDGE : FG;
      }
      raw.set(c, y * (px * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
writeFileSync('public/icon-192.png', png(192));
writeFileSync('public/icon-512.png', png(512));
console.log('icons written');
