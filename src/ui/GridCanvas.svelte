<script lang="ts" module>
  export interface Highlight {
    x: number;
    y: number;
    neighbors: [number, number][];
  }
  export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    width?: number;
  }
</script>

<script lang="ts">
  // A zoomable, pannable view of a grid of cells (1D spacetime, or any 2D grid
  // drawn on the CPU). Grid lines fade out as cells get small. Optional text
  // labels inside cells when zoomed in, and outlined boxes (e.g. found words).
  import { onMount } from 'svelte';
  import { luminance } from '../engine/palette';
  import { cellImage, maskImage } from '../render/cellImage';
  import { attachPanZoom, zoomAt, type PanZoomOptions, type View } from './panzoom';

  interface Props {
    cells: Uint8Array;
    width: number;
    height: number;
    colors: string[];
    grid: string | null;
    highlight?: Highlight | null;
    boxes?: Box[];
    /** Text drawn inside a cell when cells are large enough. */
    labelAt?: ((x: number, y: number) => string) | null;
    labelFont?: string;
    onCellClick?: (x: number, y: number) => void;
  }

  let {
    cells,
    width,
    height,
    colors,
    grid,
    highlight = null,
    boxes = [],
    labelAt = null,
    labelFont = '700 {size}px system-ui, sans-serif',
    onCellClick,
  }: Props = $props();

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let cw = 0;
  let ch = 0;
  let dpr = 1;
  const view: View = { scale: 1, ox: 0, oy: 0 };
  let bg = '#ffffff';
  let fittedFor = '';

  let image: HTMLCanvasElement | null = null;
  let mask: HTMLCanvasElement | null = null;

  const fitScale = () => Math.min(cw / width, ch / height);

  const pz: PanZoomOptions = {
    view,
    minScale: () => Math.min(fitScale() * 0.5, 1),
    maxScale: () => 80,
    onChange: () => invalidate(),
    onTap: (px, py) => {
      const x = Math.floor((px - view.ox) / view.scale);
      const y = Math.floor((py - view.oy) / view.scale);
      if (x >= 0 && y >= 0 && x < width && y < height) onCellClick?.(x, y);
    },
  };

  export function fit() {
    if (!cw || !ch) return;
    view.scale = fitScale() * 0.98;
    view.ox = (cw - width * view.scale) / 2;
    view.oy = Math.max(4, (ch - height * view.scale) / 2);
    invalidate();
  }

  export function zoomBy(f: number) {
    zoomAt(pz, f, cw / 2, ch / 2);
  }

  $effect(() => {
    image = cellImage(cells, width, height, colors);
    mask = maskImage(cells, width, height, bg);
    const key = `${width}x${height}`;
    if (key !== fittedFor && cw) {
      fittedFor = key;
      fit();
    }
    invalidate();
  });

  $effect(() => {
    void grid;
    void highlight;
    void boxes;
    void labelAt;
    invalidate();
  });

  let frame = 0;
  function invalidate() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  }

  function draw() {
    if (!canvas || !image) return;
    const { scale, ox, oy } = view;
    const ctx = canvas.getContext('2d')!;
    const css = getComputedStyle(host);
    const newBg = css.getPropertyValue('--bg').trim() || '#ffffff';
    if (newBg !== bg) {
      bg = newBg;
      mask = maskImage(cells, width, height, bg);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, ox, oy, width * scale, height * scale);

    const x0 = Math.max(0, Math.floor(-ox / scale));
    const x1 = Math.min(width, Math.ceil((cw - ox) / scale));
    const y0 = Math.max(0, Math.floor(-oy / scale));
    const y1 = Math.min(height, Math.ceil((ch - oy) / scale));
    const px = scale * dpr;

    if (grid && px >= 4) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (px - 4) / 8);
      ctx.strokeStyle = grid;
      ctx.lineWidth = Math.max(1, Math.min(2, px * 0.06)) / dpr;
      const snap = (v: number) => (Math.round(v * dpr) + 0.5) / dpr;
      ctx.beginPath();
      for (let x = x0; x <= x1; x++) {
        const sx = snap(ox + x * scale);
        ctx.moveTo(sx, oy + y0 * scale);
        ctx.lineTo(sx, oy + y1 * scale);
      }
      for (let y = y0; y <= y1; y++) {
        const sy = snap(oy + y * scale);
        ctx.moveTo(ox + x0 * scale, sy);
        ctx.lineTo(ox + x1 * scale, sy);
      }
      ctx.stroke();
      ctx.restore();
    }
    if (mask) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(mask, ox, oy, width * scale, height * scale);
    }

    if (labelAt && scale >= 13 && (x1 - x0) * (y1 - y0) < 20000) {
      ctx.save();
      ctx.font = labelFont.replace('{size}', String(Math.round(scale * 0.62)));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const t = labelAt(x, y);
          if (!t) continue;
          const v = cells[y * width + x];
          ctx.fillStyle = luminance(colors[v] ?? '#ffffff') > 0.35 ? '#1b2330' : '#ffffff';
          ctx.fillText(t, ox + (x + 0.5) * scale, oy + (y + 0.54) * scale);
        }
      ctx.restore();
    }

    for (const b of boxes) {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width ?? 2;
      const inset = Math.min(2, scale * 0.12);
      ctx.strokeRect(ox + b.x * scale + inset, oy + b.y * scale + inset, b.w * scale - 2 * inset, b.h * scale - 2 * inset);
    }

    if (highlight) {
      const box = (x: number, y: number, color: string, lw: number) => {
        const s = Math.max(scale, 7);
        const cx = ox + (x + 0.5) * scale;
        const cy = oy + (y + 0.5) * scale;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = lw + 2;
        ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
      };
      for (const [x, y] of highlight.neighbors) box(x, y, css.getPropertyValue('--highlight-neighbors').trim() || '#2463c7', 2);
      box(highlight.x, highlight.y, css.getPropertyValue('--highlight').trim() || '#e8590c', 3);
    }
  }

  onMount(() => {
    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      const first = !cw;
      cw = r.width;
      ch = r.height;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      if (first || fittedFor !== `${width}x${height}`) {
        fittedFor = `${width}x${height}`;
        fit();
      }
      invalidate();
    });
    ro.observe(host);
    const detach = attachPanZoom(canvas, pz);
    return () => {
      ro.disconnect();
      detach();
      cancelAnimationFrame(frame);
    };
  });
</script>

<div class="host" bind:this={host}>
  <canvas
    bind:this={canvas}
    ondblclick={fit}
    aria-label="תצוגת התאים: גרירה להזזה, גלגלת או צביטה לזום, לחיצה על תא להצגת הכלל שיצר אותו"
  ></canvas>
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
