<script lang="ts">
  // Lenia and SmoothLife: continuous-valued 2D automata on the GPU.
  import { onMount, untrack } from 'svelte';
  import { growth, kernelCore, smoothTransition } from '../../engine/lenia';
  import { colorsFor } from '../../engine/palette';
  import { mulberry32, randomSeed } from '../../engine/random';
  import { palettes } from '../../lib/palettes.svelte';
  import { downloadBlob } from '../../render/cellImage';
  import { LeniaGL } from '../../render/leniaGL';
  import CommonTools from '../../ui/CommonTools.svelte';
  import FloatingPanel from '../../ui/FloatingPanel.svelte';
  import PalettePicker from '../../ui/PalettePicker.svelte';
  import { attachPanZoom, zoomAt, type PanZoomOptions, type View } from '../../ui/panzoom';
  import Shell from '../../ui/Shell.svelte';
  import type { SystemViewProps } from '../types';
  import { defaults, SIZES, SPEEDS, type LeniaViewParams } from './params';

  let { params, setParams }: SystemViewProps<LeniaViewParams> = $props();

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let gl = $state.raw<LeniaGL | null>(null);
  let glError = $state('');
  let running = $state(false);
  let gen = $state(0);
  let rulesOpen = $state(false);
  let tool = $state<'move' | 'draw' | 'erase'>('move');

  const MAPS = {
    viridis: ['#ffffff', '#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'],
    fire: ['#ffffff', '#ffe08a', '#ff9f43', '#e8590c', '#a61e4d', '#3b0a2a'],
  };
  const ramp = $derived(params.colorMap === 'palette' ? colorsFor({ ...palettes.current, ramp: true }, 2) : MAPS[params.colorMap]);

  // ---- view ----
  let cw = 0;
  let ch = 0;
  let dpr = 1;
  const view: View = { scale: 1, ox: 0, oy: 0 };
  const pz: PanZoomOptions = {
    view,
    minScale: () => Math.min(cw, ch) / (gl?.W ?? 256) / 4,
    maxScale: () => 40,
    onChange: () => invalidate(),
    onDrawStart: (px, py) => {
      if (tool === 'move') return false;
      paintAt(px, py);
      return true;
    },
    onDrawMove: (px, py) => paintAt(px, py),
  };

  function paintAt(px: number, py: number) {
    if (!gl) return;
    const x = (px - view.ox) / view.scale;
    const y = (py - view.oy) / view.scale;
    gl.brush(x, y, params.R * 0.8, tool === 'erase' ? -1 : 0.9);
    invalidate();
  }

  function fit() {
    if (!gl || !cw) return;
    view.scale = Math.min(cw / gl.W, ch / gl.H) * 0.98;
    view.ox = (cw - gl.W * view.scale) / 2;
    view.oy = (ch - gl.H * view.scale) / 2;
    invalidate();
  }

  let frame = 0;
  function invalidate() {
    if (frame || running) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      gl?.draw(view.scale, view.ox, view.oy, dpr, getComputedStyle(host).getPropertyValue('--bg').trim() || '#ffffff');
    });
  }

  function initial(): Float32Array {
    const N = params.size;
    const a = new Float32Array(N * N);
    const rnd = mulberry32(params.seed);
    const side = Math.max(4, Math.round(params.R * (params.mode === 'lenia' ? 2 : 2.5)));
    const count = Math.max(1, Math.round((params.density * N * N) / (side * side)));
    for (let k = 0; k < count; k++) {
      const x0 = Math.floor(rnd() * N);
      const y0 = Math.floor(rnd() * N);
      for (let y = 0; y < side; y++)
        for (let x = 0; x < side; x++) a[((y0 + y) % N) * N + ((x0 + x) % N)] = params.mode === 'lenia' ? rnd() : rnd() < 0.5 ? 1 : 0;
    }
    return a;
  }

  function rebuild() {
    if (!gl) return;
    const sizeChanged = gl.W !== params.size;
    gl.setSize(params.size, params.size, initial());
    gen = 0;
    if (sizeChanged) fit();
    else invalidate();
  }

  $effect(() => {
    void [params.size, params.seed, params.density, params.mode];
    untrack(rebuild);
  });
  $effect(() => {
    const p = { ...params };
    if (!gl) return;
    gl.setParams(p);
  });
  $effect(() => {
    const r = ramp;
    if (!gl) return;
    gl.setRamp(r);
    untrack(invalidate);
  });

  let lastTime = 0;
  let acc = 0;
  function tick(t: number) {
    if (!running || !gl) return;
    const dt = Math.min(0.1, (t - lastTime) / 1000);
    lastTime = t;
    acc += dt * SPEEDS[params.speed];
    const n = Math.min(8, Math.floor(acc));
    if (n > 0) {
      acc -= n;
      gl.step(n);
      gen += n;
    }
    gl.draw(view.scale, view.ox, view.oy, dpr, getComputedStyle(host).getPropertyValue('--bg').trim() || '#ffffff');
    requestAnimationFrame(tick);
  }
  function setRunning(v: boolean) {
    running = v;
    if (v) {
      lastTime = performance.now();
      acc = 1;
      requestAnimationFrame(tick);
    }
  }
  function stepOnce() {
    if (!gl) return;
    running = false;
    gl.step(1);
    gen++;
    invalidate();
  }

  async function exportPNG() {
    canvas.toBlob((b) => b && downloadBlob(b, `${params.mode}.png`), 'image/png');
  }

  onMount(() => {
    try {
      gl = new LeniaGL(canvas);
    } catch (e) {
      glError =
        (e as Error).message === 'float'
          ? 'הדפדפן הזה לא תומך בחישוב במספרים ממשיים על כרטיס המסך, ולכן Lenia לא יכולה לרוץ כאן.'
          : 'הדפדפן הזה לא תומך ב־WebGL2.';
      return;
    }
    gl.setParams(params);
    gl.setRamp(ramp);
    rebuild();
    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      const first = !cw;
      cw = r.width;
      ch = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      if (first) fit();
      else invalidate();
    });
    ro.observe(host);
    const detach = attachPanZoom(canvas, pz);
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space') setRunning(!running);
      else if (e.code === 'KeyS') stepOnce();
      else if (e.code === 'KeyR') rulesOpen = !rulesOpen;
      else if (e.code === 'KeyN') setParams({ ...params, seed: randomSeed() });
      else if (e.code === 'KeyF') fit();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      running = false;
      ro.disconnect();
      detach();
      window.removeEventListener('keydown', onKey);
      gl?.destroy();
    };
  });

  // ---- graphs for the rules window ----
  const GW = 320;
  const GH = 120;
  const growthPath = $derived.by(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 200; i++) {
      const u = (i / 200) * 0.5;
      const g = params.mode === 'lenia' ? growth(u, params.mu, params.sigma) : 2 * smoothTransition(u, 0, params) - 1;
      pts.push(`${(i / 200) * GW},${GH / 2 - (g * GH) / 2.2}`);
    }
    return 'M' + pts.join('L');
  });
  const survivePath = $derived.by(() => {
    if (params.mode !== 'smooth') return '';
    const pts: string[] = [];
    for (let i = 0; i <= 200; i++) {
      const g = 2 * smoothTransition((i / 200) * 0.5, 1, params) - 1;
      pts.push(`${(i / 200) * GW},${GH / 2 - (g * GH) / 2.2}`);
    }
    return 'M' + pts.join('L');
  });
  const kernelPath = $derived.by(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 200; i++) {
      const r = i / 200;
      const k = params.mode === 'lenia' ? kernelCore(r) : r < 1 / 3 ? 0.5 : 1;
      pts.push(`${r * GW},${GH - 8 - k * (GH - 16)}`);
    }
    return 'M' + pts.join('L');
  });

  const set = (k: keyof LeniaViewParams, v: number) => setParams({ ...params, [k]: v });
</script>

{#snippet slider(label: string, key: 'mu' | 'sigma' | 'T' | 'R' | 'b1' | 'b2' | 'd1' | 'd2' | 'dt', min: number, max: number, step: number)}
  <label class="slider">
    <span>{label}: <b class="ltr">{params[key]}</b></span>
    <input type="range" {min} {max} {step} value={params[key]} oninput={(e) => set(key, Number(e.currentTarget.value))} />
  </label>
{/snippet}

{#snippet run()}
  <div class="run">
    <button class="btn primary" onclick={() => setRunning(!running)}>{running ? '❚❚ עצירה' : '▶ הפעלה'}</button>
    <button class="btn" onclick={stepOnce}>צעד</button>
    <button class="btn orange" onclick={() => setParams({ ...params, seed: randomSeed() })}>התחלה חדשה</button>
  </div>
{/snippet}

{#snippet tools()}
  <div class="segmented">
    <button aria-pressed={tool === 'move'} onclick={() => (tool = 'move')}>הזזה</button>
    <button aria-pressed={tool === 'draw'} onclick={() => (tool = 'draw')}>ציור</button>
    <button aria-pressed={tool === 'erase'} onclick={() => (tool = 'erase')}>מחיקה</button>
  </div>
{/snippet}

{#snippet quick()}
  <div class="quickbar">
    {@render run()}
    {@render tools()}
    <button class="btn blue" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
  </div>
{/snippet}

{#snippet panel()}
  <section>
    <div class="segmented">
      <button aria-pressed={params.mode === 'lenia'} onclick={() => setParams(defaults('lenia'))}>Lenia</button>
      <button aria-pressed={params.mode === 'smooth'} onclick={() => setParams(defaults('smooth'))}>SmoothLife</button>
    </div>
    <p class="intro">
      {#if params.mode === 'lenia'}
        Lenia (ברט צ'אן, 2019): כל תא מחזיק ערך רציף בין 0 ל־1. סוכמים את הסביבה במשקל של טבעת חלקה, ופונקציית הגדילה
        קובעת אם הערך יעלה או ירד. נוצרים "יצורים" שזזים, כמו ה־Orbium.
      {:else}
        SmoothLife (שטפן רפלר, 2011): גרסה רציפה של משחק החיים. במקום 8 שכנים סופרים מילוי של דיסק פנימי ושל טבעת סביבו,
        והלידה וההישרדות קורות בתחומים רכים.
      {/if}
    </p>
    {@render run()}
    <span class="muted">צעד {gen.toLocaleString('he-IL')}</span>
    <label class="slider">
      <span>מהירות: {SPEEDS[params.speed]} צעדים בשנייה</span>
      <input type="range" min="0" max={SPEEDS.length - 1} value={params.speed} oninput={(e) => set('speed', Number(e.currentTarget.value))} />
    </label>
    <button class="btn primary big" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
  </section>
  <section>
    <h3>ציור והתחלה</h3>
    {@render tools()}
    <label class="slider">
      <span>כמה מהרשת מכוסה בהתחלה: {Math.round(params.density * 100)}%</span>
      <input type="range" min="0.02" max="0.6" step="0.01" value={params.density} onchange={(e) => set('density', Number(e.currentTarget.value))} />
    </label>
    <div class="field">
      <span class="field-label">גודל</span>
      <div class="segmented">
        {#each SIZES as s (s)}<button aria-pressed={params.size === s} onclick={() => set('size', s)}>{s}</button>{/each}
      </div>
    </div>
  </section>
  <section>
    <h3>צבעים</h3>
    <div class="segmented">
      <button aria-pressed={params.colorMap === 'viridis'} onclick={() => setParams({ ...params, colorMap: 'viridis' })}>וירידיס</button>
      <button aria-pressed={params.colorMap === 'fire'} onclick={() => setParams({ ...params, colorMap: 'fire' })}>אש</button>
      <button aria-pressed={params.colorMap === 'palette'} onclick={() => setParams({ ...params, colorMap: 'palette' })}>מהערכה</button>
    </div>
    {#if params.colorMap === 'palette'}<PalettePicker k={2} />{/if}
  </section>
  <section>
    <CommonTools title={params.mode === 'lenia' ? 'Lenia' : 'SmoothLife'} onExportPNG={exportPNG} />
  </section>
{/snippet}

{#snippet main()}
  <div class="stage" bind:this={host}>
    <canvas bind:this={canvas} ondblclick={fit} class:drawing={tool !== 'move'} aria-label="רשת רציפה"></canvas>
    <div class="zoom">
      <button class="btn icon" onclick={() => zoomAt(pz, 1.5, cw / 2, ch / 2)} aria-label="התקרבות">+</button>
      <button class="btn icon" onclick={() => zoomAt(pz, 1 / 1.5, cw / 2, ch / 2)} aria-label="התרחקות">−</button>
      <button class="btn icon" onclick={fit} aria-label="התאמה למסך">⤢</button>
    </div>
    {#if glError}<p class="gl-error">{glError}</p>{/if}
  </div>
{/snippet}

<Shell title={params.mode === 'lenia' ? 'Lenia' : 'SmoothLife'} subtitle="אוטומט תאי רציף" {main} {panel} {quick} />

<FloatingPanel title="כללי העדכון" open={rulesOpen} onClose={() => (rulesOpen = false)} width={400}>
  <div class="rules">
    <div class="graph">
      <span class="g-title">{params.mode === 'lenia' ? 'הגרעין: משקל השכנים לפי המרחק' : 'דיסק פנימי וטבעת חיצונית'}</span>
      <svg viewBox="0 0 {GW} {GH}" class="ltr">
        <line x1="0" y1={GH - 8} x2={GW} y2={GH - 8} class="axis" />
        <path d={kernelPath} class="curve k" />
        <text x="2" y={GH - 10} class="lbl">0</text>
        <text x={GW - 30} y={GH - 10} class="lbl">R={params.R}</text>
      </svg>
    </div>
    <div class="graph">
      <span class="g-title">פונקציית הגדילה: כמה הערך עולה (+) או יורד (−) לפי סכום הסביבה</span>
      <svg viewBox="0 0 {GW} {GH}" class="ltr">
        <line x1="0" y1={GH / 2} x2={GW} y2={GH / 2} class="axis" />
        <path d={growthPath} class="curve g" />
        {#if survivePath}<path d={survivePath} class="curve s" />{/if}
        <text x="2" y="12" class="lbl">+1</text>
        <text x="2" y={GH - 4} class="lbl">−1</text>
        <text x={GW - 26} y={GH / 2 - 4} class="lbl">0.5</text>
      </svg>
      {#if params.mode === 'smooth'}<span class="hint"><span class="swatch" style="background:#2463c7"></span> תא ריק (לידה) · <span class="swatch" style="background:#1f8a4c"></span> תא מלא (הישרדות)</span>{/if}
    </div>
    {#if params.mode === 'lenia'}
      <p class="desc">ערך חדש = ערך + G(U)/T, כאשר U הוא הממוצע המשוקלל בטבעת. G חיובי כש־U קרוב ל־μ, ושלילי אחרת.</p>
      {@render slider('μ (מרכז הגדילה)', 'mu', 0.05, 0.4, 0.001)}
      {@render slider('σ (רוחב)', 'sigma', 0.003, 0.08, 0.001)}
      {@render slider('T (כמה צעדים ליחידת זמן)', 'T', 1, 30, 1)}
      {@render slider('R (רדיוס)', 'R', 4, 25, 1)}
    {:else}
      <p class="desc">תא ריק נולד כשמילוי הטבעת בין b1 ל־b2; תא מלא שורד כשהמילוי בין d1 ל־d2. הכל במעברים רכים.</p>
      {@render slider('b1', 'b1', 0.1, 0.5, 0.001)}
      {@render slider('b2', 'b2', 0.1, 0.6, 0.001)}
      {@render slider('d1', 'd1', 0.1, 0.6, 0.001)}
      {@render slider('d2', 'd2', 0.1, 0.7, 0.001)}
      {@render slider('dt (גודל צעד)', 'dt', 0.02, 1, 0.01)}
      {@render slider('R (רדיוס חיצוני)', 'R', 6, 25, 1)}
    {/if}
    <button class="btn small" onclick={() => setParams({ ...defaults(params.mode), size: params.size, seed: params.seed })}>חזרה לערכי ברירת המחדל</button>
  </div>
</FloatingPanel>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  section:last-child {
    border-bottom: 0;
  }
  h3 {
    margin: 0;
    font-size: 15px;
    color: var(--accent-strong);
  }
  .intro {
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
  }
  .run {
    display: flex;
    gap: 6px;
  }
  .run .primary {
    flex: 1;
  }
  .big {
    min-height: 42px;
  }
  .quickbar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .slider {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
  }
  .stage {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    cursor: grab;
  }
  canvas.drawing {
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
  .gl-error {
    position: absolute;
    inset: 40% 20px auto;
    text-align: center;
    color: var(--accent-3);
    font-weight: 600;
  }
  .rules {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .graph {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .g-title {
    font-size: 13px;
    font-weight: 600;
  }
  svg {
    width: 100%;
    background: var(--surface-2);
    border-radius: 8px;
  }
  .axis {
    stroke: var(--border);
    stroke-width: 1;
  }
  .curve {
    fill: none;
    stroke-width: 2.5;
  }
  .curve.k {
    stroke: var(--accent-4);
  }
  .curve.g {
    stroke: var(--accent-2);
  }
  .curve.s {
    stroke: var(--accent);
  }
  .lbl {
    font-size: 10px;
    fill: var(--text-muted);
  }
  .desc {
    margin: 0;
    font-size: 14px;
  }
  .hint {
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
