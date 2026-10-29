<script lang="ts" module>
  export interface Highlight {
    x: number;
    y: number;
    neighbors: [number, number][];
  }
</script>

<script lang="ts">
  // A zoomable, pannable view of a grid of cells (1D spacetime, or any 2D grid
  // drawn on the CPU). Wheel / drag on desktop, pinch / drag on touch.
  // Grid lines fade out as cells get small.
  import { onMount } from 'svelte';
  import { cellImage, maskImage } from '../render/cellImage';

  interface Props {
    cells: Uint8Array;
    width: number;
    height: number;
    colors: string[];
    grid: string | null;
    highlight?: Highlight | null;
    onCellClick?: (x: number, y: number) => void;
  }

  let { cells, width, height, colors, grid, highlight = null, onCellClick }: Props = $props();

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let cw = 0;
  let ch = 0;
  let dpr = 1;
  let scale = 1;
  let ox = 0;
  let oy = 0;
  let bg = '#ffffff';
  let fittedFor = '';

  let image: HTMLCanvasElement | null = null;
  let mask: HTMLCanvasElement | null = null;

  const MAX_SCALE = 80;
  const minScale = () => Math.min(fitScale() * 0.5, 1);

  function fitScale() {
    return Math.min(cw / width, ch / height);
  }

  export function fit() {
    if (!cw || !ch) return;
    scale = fitScale() * 0.98;
    ox = (cw - width * scale) / 2;
    oy = Math.max(4, (ch - height * scale) / 2);
    invalidate();
  }

  export function zoomBy(f: number, cx = cw / 2, cy = ch / 2) {
    const s = Math.min(MAX_SCALE, Math.max(minScale(), scale * f));
    ox = cx - ((cx - ox) * s) / scale;
    oy = cy - ((cy - oy) * s) / scale;
    scale = s;
    invalidate();
  }

  // Rebuild the cell image when the data or colors change.
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
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, ox, oy, width * scale, height * scale);

    const px = scale * dpr;
    if (grid && px >= 4) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (px - 4) / 8);
      ctx.strokeStyle = grid;
      ctx.lineWidth = Math.max(1, Math.min(2, px * 0.06)) / dpr;
      const x0 = Math.max(0, Math.floor(-ox / scale));
      const x1 = Math.min(width, Math.ceil((cw - ox) / scale));
      const y0 = Math.max(0, Math.floor(-oy / scale));
      const y1 = Math.min(height, Math.ceil((ch - oy) / scale));
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
      const css = getComputedStyle(host);
      for (const [x, y] of highlight.neighbors) box(x, y, css.getPropertyValue('--highlight-neighbors').trim() || '#2463c7', 2);
      box(highlight.x, highlight.y, css.getPropertyValue('--highlight').trim() || '#e8590c', 3);
    }
  }

  // ---- pointer interaction ----
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { x: number; y: number; ox: number; oy: number; moved: boolean; multi: boolean } | null = null;
  let pinch: { dist: number; wx: number; wy: number; scale: number } | null = null;

  function local(e: PointerEvent | WheelEvent | MouseEvent) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function pinchInfo() {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  function onPointerDown(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) {
      const p = local(e);
      drag = { x: p.x, y: p.y, ox, oy, moved: false, multi: false };
    } else if (pointers.size === 2) {
      const { dist, mx, my } = pinchInfo();
      pinch = { dist, wx: (mx - ox) / scale, wy: (my - oy) / scale, scale };
      if (drag) drag.multi = true;
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, local(e));
    if (pinch && pointers.size >= 2) {
      const { dist, mx, my } = pinchInfo();
      scale = Math.min(MAX_SCALE, Math.max(minScale(), (pinch.scale * dist) / Math.max(1, pinch.dist)));
      ox = mx - pinch.wx * scale;
      oy = my - pinch.wy * scale;
      invalidate();
    } else if (drag && pointers.size === 1) {
      const p = local(e);
      const dx = p.x - drag.x;
      const dy = p.y - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
      if (drag.moved) {
        ox = drag.ox + dx;
        oy = drag.oy + dy;
        invalidate();
      }
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) {
      // Continue as a drag with the remaining finger.
      const [p] = [...pointers.values()];
      drag = { x: p.x, y: p.y, ox, oy, moved: true, multi: true };
      return;
    }
    if (pointers.size === 0 && drag) {
      if (!drag.moved && !drag.multi && e.type === 'pointerup' && onCellClick) {
        const p = local(e);
        const x = Math.floor((p.x - ox) / scale);
        const y = Math.floor((p.y - oy) / scale);
        if (x >= 0 && y >= 0 && x < width && y < height) onCellClick(x, y);
      }
      drag = null;
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const p = local(e);
    zoomBy(Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
  }

  onMount(() => {
    bg = getComputedStyle(host).getPropertyValue('--bg').trim() || '#ffffff';
    mask = maskImage(cells, width, height, bg);
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
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(frame);
    };
  });
</script>

<div class="host" bind:this={host}>
  <canvas
    bind:this={canvas}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
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
