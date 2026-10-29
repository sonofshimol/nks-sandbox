<script lang="ts">
  // All 256 elementary rules as thumbnails, each from a single black cell.
  import { onMount } from 'svelte';
  import { codeToRule, infiniteWidth, run1D } from '../../engine/ca1d';
  import { cellImage } from '../../render/cellImage';

  interface Props {
    colors: string[];
    current: string;
    onPick: (code: number) => void;
  }
  let { colors, current, onPick }: Props = $props();

  const STEPS = 32;
  const W = infiniteWidth(1, 1, STEPS);
  const PX = 2;
  const canvases: HTMLCanvasElement[] = [];
  let filter = $state('');

  const codes = Array.from({ length: 256 }, (_, i) => i);
  const visible = $derived(
    filter.trim() === '' ? codes : codes.filter((c) => String(c).includes(filter.trim())),
  );

  function draw(code: number) {
    const canvas = canvases[code];
    if (!canvas) return;
    const init = new Uint8Array(W);
    init[STEPS] = 1;
    const st = run1D({ rule: codeToRule(BigInt(code), 2, 1, false), init, steps: STEPS, boundary: 'infinite' });
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cellImage(st.cells, st.width, st.height, colors), 0, 0, W * PX, (STEPS + 1) * PX);
  }

  $effect(() => {
    void colors;
    void visible;
    // Draw in small batches so opening the gallery stays snappy.
    let i = 0;
    let handle = 0;
    const list = visible;
    const batch = () => {
      for (let n = 0; n < 32 && i < list.length; n++, i++) draw(list[i]);
      if (i < list.length) handle = requestAnimationFrame(batch);
    };
    handle = requestAnimationFrame(batch);
    return () => cancelAnimationFrame(handle);
  });

  onMount(() => {
    setTimeout(() => document.querySelector(`[data-rule="${current}"]`)?.scrollIntoView({ block: 'center' }), 50);
  });
</script>

<div class="tools">
  <input type="text" inputmode="numeric" placeholder="חיפוש לפי מספר" bind:value={filter} />
  <span class="muted">כל 256 הכללים האלמנטריים, 32 צעדים מתא שחור יחיד (בספר: עמוד 55)</span>
</div>

<div class="grid">
  {#each visible as code (code)}
    <button class="thumb" class:current={String(code) === current} data-rule={code} onclick={() => onPick(code)}>
      <canvas bind:this={canvases[code]} width={W * PX} height={(STEPS + 1) * PX}></canvas>
      <span>כלל {code}</span>
    </button>
  {/each}
</div>

<style>
  .tools {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 12px;
    font-size: 13px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }
  .thumb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px;
    border: 1.5px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    font-size: 13px;
    font-weight: 600;
  }
  .thumb:hover {
    border-color: var(--accent-2);
  }
  .thumb.current {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  canvas {
    width: 100%;
    height: auto;
    image-rendering: pixelated;
  }
</style>
