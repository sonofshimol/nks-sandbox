// Color palettes for cell states. Index = cell state; grid = color of the lines
// between cells, or null for no lines.

export interface Palette {
  id: string;
  name: string;
  colors: string[];
  grid: string | null;
  /**
   * Ramp palettes have two colors (state 0 and the last state); states in
   * between are interpolated, like the gray levels in the book.
   */
  ramp?: boolean;
  /** Built-in palettes cannot be deleted. */
  builtin?: boolean;
}

// Okabe–Ito: distinguishable for the common kinds of color blindness.
const OKABE_ITO = ['#0072b2', '#e69f00', '#009e73', '#d55e00', '#56b4e9', '#cc79a7', '#f0e442', '#000000'];

export const BUILTIN_PALETTES: Palette[] = [
  {
    id: 'green',
    name: 'ירוק',
    colors: ['#cfe9c8', '#1f6b3a'],
    grid: '#0b2e17',
    ramp: true,
    builtin: true,
  },
  {
    id: 'book',
    name: 'שחור על לבן',
    colors: ['#ffffff', '#000000'],
    grid: null,
    ramp: true,
    builtin: true,
  },
  {
    id: 'bright',
    name: 'צבעוני',
    colors: ['#ffffff', ...OKABE_ITO],
    grid: '#e3e6ec',
    builtin: true,
  },
  {
    id: 'sea',
    name: 'ים',
    colors: ['#f2f8fc', '#0b4f8a', '#38a3d6', '#f2a541'],
    grid: '#c5dced',
    builtin: true,
  },
  {
    id: 'sunset',
    name: 'שקיעה',
    colors: ['#fff8ef', '#b2182b', '#f4a582', '#5e3c99'],
    grid: '#f1dcc8',
    builtin: true,
  },
];

export const DEFAULT_PALETTE_ID = 'green';

/**
 * Colors for k states. Palettes with too few colors are extended with
 * Okabe–Ito colors not already in use.
 */
export function colorsFor(p: Palette, k: number): string[] {
  if (p.ramp && p.colors.length >= 2) {
    const a = hexToRgb(p.colors[0]);
    const b = hexToRgb(p.colors[1]);
    return Array.from({ length: k }, (_, i) => {
      const t = k === 1 ? 0 : i / (k - 1);
      return rgbToHex(a.map((v, j) => v + (b[j] - v) * t) as [number, number, number]);
    });
  }
  const out = p.colors.slice(0, k);
  let i = 0;
  while (out.length < k) {
    const c = OKABE_ITO[i++ % OKABE_ITO.length];
    if (!out.includes(c) || i > OKABE_ITO.length) out.push(c);
  }
  return out;
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** Relative luminance (WCAG), for picking readable text on a cell color. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Compact URL form: "ffffff.000000~0b2e17" (grid after ~, "-" for none). */
export function encodePalette(p: Palette): string {
  const cs = p.colors.map((c) => c.replace('#', '').toLowerCase()).join('.');
  return `${cs}~${p.grid ? p.grid.replace('#', '').toLowerCase() : '-'}${p.ramp ? '~r' : ''}`;
}

export function decodePalette(s: string): Palette | null {
  const [cs, g, flags] = s.split('~');
  if (!cs) return null;
  const colors = cs.split('.').filter((c) => /^[0-9a-f]{6}$/i.test(c)).map((c) => '#' + c);
  if (colors.length < 2) return null;
  const grid = g && /^[0-9a-f]{6}$/i.test(g) ? '#' + g : null;
  return { id: 'custom', name: 'מותאמת', colors, grid, ramp: flags === 'r' };
}
