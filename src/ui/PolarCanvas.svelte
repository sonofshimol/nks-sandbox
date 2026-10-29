<script lang="ts">
  // Ring view of a spacetime: row t is the ring at radius t (from the hole
  // outwards), and its W cells divide the ring into equal sectors, clockwise
  // from the top. With periodic boundaries the ring closes on itself exactly.
  //
  // Rendering maps every screen pixel back to (t, x). That is too slow to redo
  // on every frame of a pan or pinch, so while the view moves we stretch the last
  // exact render, and redraw exactly once it stops.
  import { onMount } from 'svelte';
  import { colorLUT } from '../render/cellImage';
  import { MASKED } from '../engine/ca1d';
  import type { Highlight } from './GridCanvas.svelte';
  import { attachPanZoom, zoomAt, type PanZoomOptions, type View } from './panzoom';

  interface Props {
    cells: Uint8Array;
    width: number;
    height: number;
    colors: string[];
    grid: string | null;
    /** Radius of the hole, as a fraction of the outer radius. */
    hole: number;
    highlight?: Highlight | null;
    onCellClick?: (x: number, y: number) => void;
  }

  let { cells, width, height, colors, grid, hole, highlight = null, onCellClick }: Props = $props();

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let cw = 0;
  let ch = 0;
  let dpr = 1;
  const view: View = { scale: 1, ox: 0, oy: 0 };
  let bg = '#ffffff';

  // Last exact render and the view it was made for.
  const exact = document.createElement('canvas');
  let exactView: View | null = null;
  let exactTimer = 0;

  const TAU = Math.PI * 2;
  // The middle cell of each ring (where a single seed starts) sits at the top.
  const ROT = Math.PI;

  const pz: PanZoomOptions = {
    view,
    minScale: () => Math.min(cw, ch) / 8,
    maxScale: () => Math.min(cw, ch) * 400,
    onChange: () => {
      invalidate();
      scheduleExact();
    },
    onTap: (px, py) => {
      const c = cellAt(px, py);
      if (c) onCellClick?.(c.x, c.t);
    },
  };

  function cellAt(px: number, py: number): { x: number; t: number } | null {
    const wx = (px - view.ox) / view.scale;
    const wy = (py - view.oy) / view.scale;
    const rho = Math.hypot(wx, wy);
    const pos = ((rho - hole) / (1 - hole)) * height;
    if (rho > 1 || pos < 0) return null;
    let th = Math.atan2(wx, -wy) + ROT;
    if (th >= TAU) th -= TAU;
    if (th < 0) th += TAU;
    return { t: Math.min(height - 1, Math.floor(pos)), x: Math.min(width - 1, Math.floor((th / TAU) * width)) };
  }

  export function fit() {
    if (!cw || !ch) return;
    view.scale = (Math.min(cw, ch) / 2) * 0.96;
    view.ox = cw / 2;
    view.oy = ch / 2;
    renderExact();
  }

  export function zoomBy(f: number) {
    zoomAt(pz, f, cw / 2, ch / 2);
  }

  $effect(() => {
    void cells;
    void colors;
    void hole;
    void width;
    void height;
    renderExact();
  });

  $effect(() => {
    void grid;
    void highlight;
    invalidate();
  });

  function scheduleExact() {
    clearTimeout(exactTimer);
    exactTimer = window.setTimeout(renderExact, 120);
  }

  /** Map every device pixel to its cell. */
  function renderExact() {
    if (!cw) return;
    const W = Math.round(cw * dpr);
    const H = Math.round(ch * dpr);
    exact.width = W;
    exact.height = H;
    const ctx = exact.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    const out = new Uint32Array(img.data.buffer);
    const lut = colorLUT(colors);
    const s = view.scale * dpr;
    const cx = view.ox * dpr;
    const cy = view.oy * dpr;
    const ringScale = height / (1 - hole);
    const sector = width / TAU;
    for (let py = 0; py < H; py++) {
      const wy = (py + 0.5 - cy) / s;
      const row = py * W;
      for (let px = 0; px < W; px++) {
        const wx = (px + 0.5 - cx) / s;
        const rho = Math.sqrt(wx * wx + wy * wy);
        if (rho > 1 || rho < hole) continue;
        const t = Math.min(height - 1, ((rho - hole) * ringScale) | 0);
        let th = Math.atan2(wx, -wy) + ROT;
        if (th >= TAU) th -= TAU;
        if (th < 0) th += TAU;
        const x = Math.min(width - 1, (th * sector) | 0);
        const v = cells[t * width + x];
        if (v !== MASKED) out[row + px] = lut[v];
      }
    }
    ctx.putImageData(img, 0, 0);
    exactView = { ...view };
    invalidate();
  }

  let frame = 0;
  function invalidate() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  }

  function draw() {
    if (!canvas || !exactView) return;
    const ctx = canvas.getContext('2d')!;
    const css = getComputedStyle(host);
    bg = css.getPropertyValue('--bg').trim() || '#ffffff';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    // Stretch the last exact render to the current view.
    const k = view.scale / exactView.scale;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(exact, view.ox - exactView.ox * k, view.oy - exactView.oy * k, cw * k, ch * k);

    const { scale, ox, oy } = view;
    const ring = (scale * (1 - hole)) / height; // ring thickness in CSS px
    const rOf = (t: number) => (hole + ((1 - hole) * t) / height) * scale;

    if (grid && ring * dpr >= 4) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (ring * dpr - 4) / 8);
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1 / dpr;
      // Only rings that cross the screen.
      const far = Math.hypot(Math.max(ox, cw - ox), Math.max(oy, ch - oy));
      ctx.beginPath();
      for (let t = 0; t <= height; t++) {
        const r = rOf(t);
        if (r > far + 2) break;
        ctx.moveTo(ox + r, oy);
        ctx.arc(ox, oy, r, 0, TAU);
      }
      // Spokes, from where sectors are wide enough.
      const sectorPx = (r: number) => (r * TAU) / width;
      const r1 = rOf(height);
      if (sectorPx(r1) * dpr >= 4) {
        const r0 = Math.max(rOf(0), (6 / dpr / TAU) * width);
        for (let x = 0; x < width; x++) {
          const a = (x / width) * TAU - Math.PI / 2 - ROT;
          ctx.moveTo(ox + Math.cos(a) * r0, oy + Math.sin(a) * r0);
          ctx.lineTo(ox + Math.cos(a) * r1, oy + Math.sin(a) * r1);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    if (highlight) {
      const sectorBox = (x: number, t: number, color: string, lw: number) => {
        const a0 = (x / width) * TAU - Math.PI / 2 - ROT;
        const a1 = ((x + 1) / width) * TAU - Math.PI / 2 - ROT;
        const ri = rOf(t);
        const ro = Math.max(rOf(t + 1), ri + 4);
        ctx.beginPath();
        ctx.arc(ox, oy, ro, a0, a1);
        ctx.arc(ox, oy, ri, a1, a0, true);
        ctx.closePath();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = lw + 2;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.stroke();
      };
      for (const [x, t] of highlight.neighbors) sectorBox(x, t, css.getPropertyValue('--highlight-neighbors').trim() || '#2463c7', 2);
      sectorBox(highlight.x, highlight.y, css.getPropertyValue('--highlight').trim() || '#e8590c', 3);
    }
  }

  onMount(() => {
    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      cw = r.width;
      ch = r.height;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      fit();
    });
    ro.observe(host);
    const detach = attachPanZoom(canvas, pz);
    return () => {
      ro.disconnect();
      detach();
      cancelAnimationFrame(frame);
      clearTimeout(exactTimer);
    };
  });
</script>

<div class="host" bind:this={host}>
  <canvas bind:this={canvas} ondblclick={fit} aria-label="תצוגה מעגלית: כל צעד הוא טבעת סביב הקודם"></canvas>
  <div class="zoom">
    <button class="btn icon" onclick={() => zoomBy(1.5)} title="התקרבות" aria-label="התקרבות">+</button>
    <button class="btn icon" onclick={() => zoomBy(1 / 1.5)} title="התרחקות" aria-label="התרחקות">−</button>
    <button class="btn icon" onclick={fit} title="התאמה למסך (F)" aria-label="התאמה למסך">⤢</button>
  </div>
</div>

<style>
  .host {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: crosshair;
  }
  .zoom {
    position: absolute;
    top: 10px;
    left: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .zoom .btn {
    box-shadow: var(--shadow-sm);
    font-size: 18px;
    line-height: 1;
  }
</style>
