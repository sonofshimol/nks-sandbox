<script lang="ts">
  // 2D Life-like automata on the GPU: Game of Life and the B/S family,
  // Generations (Brian's Brain), Larger than Life and WireWorld.
  import { onMount, untrack } from 'svelte';
  import { formatRule, fromWolframCode, maxCount, NAMED_RULES, parseRule, wolframCode, type LifeRule } from '../../engine/life';
  import { colorsFor } from '../../engine/palette';
  import { PATTERNS } from '../../engine/patterns';
  import { mulberry32, randomSeed } from '../../engine/random';
  import { boundingBox, crop, parseRLE, writeRLE } from '../../engine/rle';
  import { media } from '../../lib/media.svelte';
  import { palettes } from '../../lib/palettes.svelte';
  import { downloadBlob, gridPNG } from '../../render/cellImage';
  import { LifeGL } from '../../render/lifeGL';
  import ColorText from '../../ui/ColorText.svelte';
  import CommonTools from '../../ui/CommonTools.svelte';
  import FloatingPanel from '../../ui/FloatingPanel.svelte';
  import PalettePicker from '../../ui/PalettePicker.svelte';
  import { attachPanZoom, zoomAt, type PanZoomOptions, type View } from '../../ui/panzoom';
  import Shell from '../../ui/Shell.svelte';
  import type { SystemViewProps } from '../types';
  import { describeLifeRule } from './describe';
  import { SIZES, SPEEDS, type LifeInit, type LifeParams } from './params';

  let { params, setParams }: SystemViewProps<LifeParams> = $props();

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let overlay: HTMLCanvasElement;
  let gl = $state.raw<LifeGL | null>(null);
  let glError = $state('');

  let running = $state(false);
  let gen = $state(0);
  let population = $state<number | null>(null);
  let tool = $state<'move' | 'draw' | 'erase'>('move');
  let drawState = $state(1);
  let rulesOpen = $state(false);
  let rleOpen = $state(false);
  let rleText = $state('');
  let rleError = $state('');
  let ruleText = $state('');
  let ruleError = $state('');
  let info = $state<null | { x: number; y: number; text: string; cells: [number, number][] }>(null);
  let historySize = $state(0);
  let prevValid = false; // the other ping-pong texture holds the previous generation
  let edited = false;

  const rule = $derived<LifeRule>(parseRule(params.rule) ?? parseRule('B3/S23')!);
  const colors = $derived(colorsFor(palettes.current, Math.max(2, rule.states)));
  const description = $derived(describeLifeRule(rule));
  const wcode = $derived(wolframCode(rule));
  const named = $derived(NAMED_RULES.find((r) => formatRule(parseRule(r.rule)!) === formatRule(rule)));

  $effect(() => {
    ruleText = formatRule(rule);
    ruleError = '';
  });

  // ---- view ----
  let cw = 0;
  let ch = 0;
  let dpr = 1;
  const view: View = { scale: 1, ox: 0, oy: 0 };
  let bg = '#ffffff';

  const pz: PanZoomOptions = {
    view,
    minScale: () => Math.min(cw / (gl?.W ?? 1), ch / (gl?.H ?? 1)) * 0.25,
    maxScale: () => 80,
    onChange: () => invalidate(),
    onTap: (px, py) => {
      const c = cellAt(px, py);
      if (c) showInfo(c.x, c.y);
      else info = null;
    },
    onDrawStart: (px, py) => {
      if (tool === 'move') return false;
      const c = cellAt(px, py);
      if (c) paint(c.x, c.y);
      last = c;
      return true;
    },
    onDrawMove: (px, py) => {
      const c = cellAt(px, py);
      if (!c) return;
      if (last) line(last.x, last.y, c.x, c.y);
      else paint(c.x, c.y);
      last = c;
    },
    onDrawEnd: () => {
      last = null;
      updatePopulation();
    },
  };
  let last: { x: number; y: number } | null = null;

  function cellAt(px: number, py: number) {
    if (!gl) return null;
    const x = Math.floor((px - view.ox) / view.scale);
    const y = Math.floor((py - view.oy) / view.scale);
    return x >= 0 && y >= 0 && x < gl.W && y < gl.H ? { x, y } : null;
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
      draw();
    });
  }

  function draw() {
    if (!gl) return;
    const px = view.scale * dpr;
    gl.draw({
      scale: view.scale,
      ox: view.ox,
      oy: view.oy,
      dpr,
      grid: palettes.current.grid,
      gridAlpha: px >= 4 ? Math.min(1, (px - 4) / 8) : 0,
      bg,
      age: params.age,
    });
    drawOverlay();
  }

  function drawOverlay() {
    const ctx = overlay.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (!info) return;
    const css = getComputedStyle(host);
    const box = (x: number, y: number, color: string, lw: number) => {
      const s = Math.max(view.scale, 6);
      const cx = view.ox + (x + 0.5) * view.scale;
      const cy = view.oy + (y + 0.5) * view.scale;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = lw + 2;
      ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
    };
    for (const [x, y] of info.cells) box(x, y, css.getPropertyValue('--highlight-neighbors').trim(), 1.5);
    box(info.x, info.y, css.getPropertyValue('--highlight').trim(), 3);
  }

  // ---- grid setup ----
  function initialCells(init: LifeInit, N: number): { cells: Uint8Array; rule?: string } {
    const cells = new Uint8Array(N * N);
    if (init.kind === 'random') {
      const rnd = mulberry32(init.seed);
      for (let i = 0; i < cells.length; i++) if (rnd() < init.density) cells[i] = 1;
      return { cells };
    }
    if (init.kind === 'empty') return { cells };
    if (init.kind === 'single') {
      cells[Math.floor(N / 2) * N + Math.floor(N / 2)] = 1;
      return { cells };
    }
    let rle = '';
    let r: string | undefined;
    if (init.kind === 'pattern') {
      const p = PATTERNS.find((p) => p.id === init.id);
      if (!p) return { cells };
      rle = p.rle;
      r = p.rule;
    } else rle = init.rle;
    const p = parseRLE(rle);
    const ox = Math.floor((N - p.width) / 2);
    const oy = Math.floor((N - p.height) / 2);
    for (let y = 0; y < p.height; y++)
      for (let x = 0; x < p.width; x++) {
        const X = ox + x;
        const Y = oy + y;
        if (X >= 0 && Y >= 0 && X < N && Y < N) cells[Y * N + X] = p.cells[y * p.width + x];
      }
    return { cells, rule: r ?? p.rule };
  }

  let skipInit = false;
  function rebuild() {
    if (!gl) return;
    const { cells } = initialCells(params.init, params.size);
    const sizeChanged = gl.W !== params.size;
    gl.setSize(params.size, params.size, cells);
    gen = 0;
    prevValid = false;
    edited = false;
    info = null;
    historySize = 0;
    updatePopulation();
    if (sizeChanged) fit();
    else invalidate();
  }

  // Re-create the grid when the size or initial condition change.
  $effect(() => {
    void params.size;
    void JSON.stringify(params.init);
    if (skipInit) {
      skipInit = false;
      return;
    }
    untrack(rebuild);
  });

  $effect(() => {
    const r = rule;
    if (!gl) return;
    gl.setRule(r);
    untrack(invalidate);
  });
  $effect(() => {
    const w = params.wrap;
    if (gl) gl.wrap = w;
  });
  $effect(() => {
    const c = colors;
    void palettes.current.grid;
    void params.age;
    if (!gl) return;
    gl.setPalette(c);
    untrack(invalidate);
  });

  // ---- running ----
  let lastTime = 0;
  let acc = 0;
  function tick(t: number) {
    if (!running || !gl) return;
    const dt = Math.min(0.1, (t - lastTime) / 1000);
    lastTime = t;
    acc += dt * SPEEDS[params.speed];
    const n = Math.min(64, Math.floor(acc));
    if (n > 0) {
      acc -= n;
      gl.snapshot(gen);
      gl.step(n);
      gen += n;
      prevValid = n === 1;
      historySize = gl.historySize;
    }
    draw();
    requestAnimationFrame(tick);
  }

  function setRunning(v: boolean) {
    if (v === running) return;
    if (v && gen === 0 && edited) captureStart();
    running = v;
    if (v) {
      info = null;
      population = null;
      lastTime = performance.now();
      acc = 1; // first step right away
      requestAnimationFrame(tick);
    } else updatePopulation();
  }

  function stepOnce() {
    if (!gl) return;
    if (running) setRunning(false);
    if (gen === 0 && edited) captureStart();
    gl.snapshot(gen);
    gl.step(1);
    gen++;
    prevValid = true;
    historySize = gl.historySize;
    refreshInfo();
    updatePopulation();
    invalidate();
  }

  function back() {
    if (!gl) return;
    if (running) setRunning(false);
    const g = gl.back();
    if (g === null) return;
    gen = g;
    prevValid = false;
    historySize = gl.historySize;
    refreshInfo();
    updatePopulation();
    invalidate();
  }

  function updatePopulation() {
    if (!gl || running) return;
    if (gl.W * gl.H > 1024 * 1024) {
      population = null;
      return;
    }
    const all = gl.readAll();
    let n = 0;
    for (let i = 0; i < all.length; i++) if (all[i] === 1) n++;
    population = n;
  }

  /** Keep a drawn starting pattern in the URL so it can be shared (if it is small enough). */
  function captureStart() {
    if (!gl) return;
    const all = gl.readAll();
    const box = boundingBox(all, gl.W, gl.H);
    if (!box) return;
    const rle = writeRLE({ width: box.w, height: box.h, cells: crop(all, gl.W, box) }).split('\n').slice(1).join('');
    if (rle.length > 2500) return;
    skipInit = true;
    edited = false;
    setParams({ ...params, init: { kind: 'rle', rle } });
  }

  // ---- drawing ----
  function paint(x: number, y: number) {
    if (!gl) return;
    const v = tool === 'erase' ? 0 : drawState;
    gl.write(x, y, 1, 1, Uint8Array.of(v));
    edited = true;
    prevValid = false;
    invalidate();
  }
  function line(x0: number, y0: number, x1: number, y1: number) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      paint(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  // ---- clicking a cell: which rule produced it ----
  function neighborhood(x: number, y: number, previous: boolean) {
    const R = rule.family === 'wireworld' ? 1 : rule.range;
    const N = gl!.W;
    const M = gl!.H;
    const near = x - R < 0 || y - R < 0 || x + R >= N || y + R >= M;
    const data = near ? gl!.read(0, 0, N, M, previous) : gl!.read(x - R, y - R, 2 * R + 1, 2 * R + 1, previous);
    const at = (dx: number, dy: number) => {
      if (!near) return data[(dy + R) * (2 * R + 1) + dx + R];
      let X = x + dx;
      let Y = y + dy;
      if (params.wrap) {
        X = (X + N) % N;
        Y = (Y + M) % M;
      } else if (X < 0 || Y < 0 || X >= N || Y >= M) return 0;
      return data[Y * N + X];
    };
    let alive = 0;
    const cells: [number, number][] = [];
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        if (rule.vonNeumann && Math.abs(dx) + Math.abs(dy) > R) continue;
        if (!dx && !dy && !rule.center) continue;
        cells.push([(x + dx + N) % N, (y + dy + M) % M]);
        if (at(dx, dy) === (rule.family === 'wireworld' ? 1 : 1)) alive++;
      }
    return { self: at(0, 0), alive, cells };
  }

  function outcome(self: number, alive: number): { next: number; why: string } {
    if (rule.family === 'wireworld') {
      if (self === 1) return { next: 2, why: 'ראש אלקטרון הופך לזנב' };
      if (self === 2) return { next: 3, why: 'זנב חוזר להיות חוט' };
      if (self === 3)
        return alive === 1 || alive === 2
          ? { next: 1, why: `חוט עם ${alive} ראשים לידו הופך לראש` }
          : { next: 3, why: `חוט עם ${alive} ראשים לידו נשאר חוט` };
      return { next: 0, why: 'ריק נשאר ריק' };
    }
    if (self === 0) return rule.birth[alive] ? { next: 1, why: `נולד (B${alive})` } : { next: 0, why: 'לא נולד' };
    if (self === 1)
      return rule.survive[alive]
        ? { next: 1, why: `שרד (S${alive})` }
        : { next: rule.states > 2 ? 2 : 0, why: rule.states > 2 ? 'התחיל לגסוס' : 'מת' };
    return { next: (self + 1) % rule.states, why: 'ממשיך לגסוס' };
  }

  const STATE_NAMES = ['ריק', 'חי'];
  const stateName = (s: number) =>
    rule.family === 'wireworld' ? ['ריק', 'ראש', 'זנב', 'חוט'][s] : (STATE_NAMES[s] ?? `גוסס (${s})`);

  function showInfo(x: number, y: number) {
    if (!gl) return;
    if (info && info.x === x && info.y === y) {
      info = null;
      invalidate();
      return;
    }
    if (prevValid && gen > 0) {
      const p = neighborhood(x, y, true);
      const now = gl.read(x, y, 1, 1)[0];
      const o = outcome(p.self, p.alive);
      info = {
        x,
        y,
        cells: p.cells,
        text: `בדור הקודם התא היה {${p.self}} ${stateName(p.self)}, עם ${p.alive} ${rule.family === 'wireworld' ? 'ראשים' : 'שכנים חיים'}: ${o.why}, ולכן עכשיו הוא {${now}} ${stateName(now)}.`,
      };
    } else {
      const p = neighborhood(x, y, false);
      const o = outcome(p.self, p.alive);
      info = {
        x,
        y,
        cells: p.cells,
        text: `עכשיו התא {${p.self}} ${stateName(p.self)}, עם ${p.alive} ${rule.family === 'wireworld' ? 'ראשים' : 'שכנים חיים'}. בדור הבא: ${o.why}, והוא יהיה {${o.next}} ${stateName(o.next)}.`,
      };
    }
    invalidate();
  }
  function refreshInfo() {
    if (!info) return;
    const { x, y } = info;
    info = null;
    showInfo(x, y);
  }

  // ---- rules ----
  function setRule(r: LifeRule) {
    setParams({ ...params, rule: formatRule(r) });
  }
  function toggle(kind: 'birth' | 'survive', i: number) {
    const r: LifeRule = { ...rule, birth: [...rule.birth], survive: [...rule.survive] };
    r[kind][i] = !r[kind][i];
    setRule(r);
  }
  function applyRuleText() {
    const r = parseRule(ruleText);
    if (!r) {
      ruleError = 'לא הצלחתי לקרוא את הכלל. דוגמאות: B3/S23, B2/S/C3, R5,C0,M1,S34..58,B34..45,NM';
      return;
    }
    ruleError = '';
    setRule(r);
  }
  function setStates(n: number) {
    const r: LifeRule = { ...rule, states: Math.max(2, Math.min(16, n)) };
    if (r.family === 'life' && r.states > 2) r.family = 'generations';
    if (r.family === 'generations' && r.states === 2) r.family = 'life';
    setRule(r);
  }
  function setRange(R: number) {
    const m = maxCount(R, rule.vonNeumann, rule.center);
    const scale = (a: boolean[]) => Array.from({ length: m + 1 }, (_, i) => a[Math.round((i * (a.length - 1)) / m)] ?? false);
    setRule({ ...rule, family: R > 1 ? 'ltl' : rule.states > 2 ? 'generations' : 'life', range: R, birth: scale(rule.birth), survive: scale(rule.survive) });
  }
  function setSpan(kind: 'birth' | 'survive', lo: number, hi: number) {
    const arr = rule[kind].map((_, i) => i >= lo && i <= hi);
    setRule({ ...rule, [kind]: arr });
  }
  function setCenter(center: boolean) {
    const len = maxCount(rule.range, rule.vonNeumann, center) + 1;
    const fit = (a: boolean[]) => Array.from({ length: len }, (_, i) => a[i] ?? false);
    setRule({ ...rule, center, birth: fit(rule.birth), survive: fit(rule.survive) });
  }
  function interval(a: boolean[]): [number, number] {
    const first = a.indexOf(true);
    const last = a.lastIndexOf(true);
    return first < 0 ? [0, -1] : [first, last];
  }

  // ---- start & patterns ----
  function randomFill(density?: number) {
    const d = density ?? (params.init.kind === 'random' ? params.init.density : 0.3);
    setParams({ ...params, init: { kind: 'random', density: d, seed: randomSeed() } });
  }
  /** Random outer totalistic code (empty stays empty), grown from a single cell. */
  function randomCode(five: boolean) {
    const bits = five ? 10 : 18;
    const code = Math.floor(Math.random() * 2 ** bits) & ~1;
    setParams({ ...params, rule: formatRule(fromWolframCode(code, five)), init: { kind: 'single' }, size: Math.max(params.size, 256) });
  }

  function loadPattern(id: string) {
    const p = PATTERNS.find((p) => p.id === id)!;
    setParams({ ...params, init: { kind: 'pattern', id }, rule: p.rule });
    running = false;
  }
  function importRLE() {
    try {
      const p = parseRLE(rleText);
      if (!p.cells.some((v) => v)) {
        rleError = 'לא נמצאו תאים חיים בטקסט';
        return;
      }
      const body = rleText.split('\n').filter((l) => !l.startsWith('#') && !/^x\s*=/.test(l.trim())).join('');
      const size = SIZES.find((s) => s >= Math.max(p.width, p.height) * 2) ?? SIZES[SIZES.length - 1];
      const r = p.rule && parseRule(p.rule) ? p.rule : params.rule;
      rleError = '';
      rleOpen = false;
      setParams({ ...params, rule: r, size: Math.max(params.size, size), init: body.length < 2500 ? { kind: 'rle', rle: body } : { kind: 'rle', rle: writeRLE(p).split('\n').slice(1).join('') } });
    } catch {
      rleError = 'הטקסט לא נראה כמו RLE';
    }
  }
  function exportRLE() {
    if (!gl) return;
    const all = gl.readAll();
    const box = boundingBox(all, gl.W, gl.H);
    rleText = box ? writeRLE({ width: box.w, height: box.h, cells: crop(all, gl.W, box), rule: formatRule(rule) }) : '';
    rleError = box ? '' : 'הרשת ריקה';
    rleOpen = true;
  }
  async function onRLEFile(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!f) return;
    rleText = await f.text();
    importRLE();
  }

  async function exportPNG() {
    if (!gl) return;
    const blob = await gridPNG(gl.readAll(), gl.W, gl.H, colors, palettes.current.grid, '#ffffff');
    if (blob) downloadBlob(blob, 'life.png');
  }

  // ---- lifecycle ----
  onMount(() => {
    try {
      gl = new LifeGL(canvas);
    } catch (e) {
      glError = 'הדפדפן הזה לא תומך ב־WebGL2, ולכן אי אפשר להריץ כאן את הסימולציה הדו־ממדית.';
      return;
    }
    gl.setRule(rule);
    gl.setPalette(colors);
    gl.wrap = params.wrap;
    rebuild();
    bg = getComputedStyle(host).getPropertyValue('--bg').trim() || '#ffffff';
    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      const first = !cw;
      cw = r.width;
      ch = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const c of [canvas, overlay]) {
        c.width = Math.round(cw * dpr);
        c.height = Math.round(ch * dpr);
      }
      if (first) fit();
      else invalidate();
    });
    ro.observe(host);
    const detach = attachPanZoom(overlay, pz);

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.closest?.('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space') setRunning(!running);
      else if (e.code === 'KeyS') stepOnce();
      else if (e.code === 'KeyB') back();
      else if (e.code === 'KeyR') rulesOpen = !rulesOpen;
      else if (e.code === 'KeyD') tool = 'draw';
      else if (e.code === 'KeyE') tool = 'erase';
      else if (e.code === 'KeyM') tool = 'move';
      else if (e.code === 'KeyF') fit();
      else if (e.code === 'KeyN') randomFill();
      else if (e.key === 'Escape') {
        info = null;
        rulesOpen = false;
        invalidate();
      } else return;
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

  const shortcuts: [string, string][] = [
    ['רווח', 'הפעלה / עצירה'],
    ['S', 'צעד אחד'],
    ['B', 'צעד אחורה'],
    ['R', 'כללי העדכון'],
    ['M / D / E', 'הזזה / ציור / מחיקה'],
    ['N', 'מילוי אקראי חדש'],
    ['F', 'התאמה למסך'],
  ];
</script>

{#snippet runControls()}
  <div class="run">
    <button class="btn primary" onclick={() => setRunning(!running)} aria-label={running ? 'עצירה' : 'הפעלה'}>
      {running ? '❚❚ עצירה' : '▶ הפעלה'}
    </button>
    <button class="btn" onclick={stepOnce} title="צעד אחד (S)">צעד</button>
    <button class="btn" onclick={back} disabled={!historySize} title="צעד אחורה (B)">אחורה</button>
  </div>
{/snippet}

{#snippet tools()}
  <div class="segmented" role="radiogroup" aria-label="כלי">
    <button aria-pressed={tool === 'move'} onclick={() => (tool = 'move')}>הזזה</button>
    <button aria-pressed={tool === 'draw'} onclick={() => (tool = 'draw')}>ציור</button>
    <button aria-pressed={tool === 'erase'} onclick={() => (tool = 'erase')}>מחיקה</button>
  </div>
{/snippet}

{#snippet quick()}
  <div class="quickbar">
    {@render runControls()}
    {@render tools()}
    <button class="btn blue" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
  </div>
{/snippet}

{#snippet panel()}
  <section>
    {#if !media.mobile}{@render runControls()}{/if}
    <div class="stats">
      <span>דור <b>{gen.toLocaleString('he-IL')}</b></span>
      {#if population !== null}<span>חיים <b>{population.toLocaleString('he-IL')}</b></span>{/if}
    </div>
    <div class="field">
      <label for="speed">מהירות: {SPEEDS[params.speed]} דורות בשנייה</label>
      <input id="speed" type="range" min="0" max={SPEEDS.length - 1} step="1" value={params.speed}
        oninput={(e) => setParams({ ...params, speed: Number(e.currentTarget.value) })} />
    </div>
  </section>

  <section>
    <h3>כלל</h3>
    {#if !media.mobile}
      <button class="btn primary big" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
    {/if}
    <div class="row">
      <input class="ltr rule-input" type="text" bind:value={ruleText} onkeydown={(e) => e.key === 'Enter' && applyRuleText()} aria-label="הכלל בכתיב B/S" />
      <button class="btn small" onclick={applyRuleText}>החלה</button>
    </div>
    {#if ruleError}<span class="error">{ruleError}</span>{/if}
    <select onchange={(e) => e.currentTarget.value && setParams({ ...params, rule: e.currentTarget.value })} aria-label="כללים מוכרים">
      <option value="">כללים מוכרים…</option>
      {#each NAMED_RULES as r (r.name)}
        <option value={r.rule}>{r.name} ({r.rule})</option>
      {/each}
    </select>
    {#if named}<p class="hint"><b>{named.name}:</b> {named.text}</p>{/if}
  </section>

  <section>
    <h3>ציור</h3>
    {#if !media.mobile}{@render tools()}{/if}
    {#if rule.states > 2 && tool === 'draw'}
      <div class="row">
        <span class="field-label">מצב לציור:</span>
        {#each Array.from({ length: rule.states - 1 }, (_, i) => i + 1) as s (s)}
          <button class="color-pick" style:background={colors[s]} aria-pressed={drawState === s} aria-label={stateName(s)} onclick={() => (drawState = s)}></button>
        {/each}
      </div>
    {/if}
    <p class="hint">במצב "הזזה", לחיצה על תא מראה למה הוא חי או מת. בטלפון: אצבע אחת מציירת, שתיים מזיזות ומגדילות.</p>
  </section>

  <section>
    <h3>התחלה</h3>
    <div class="field">
      <label for="dens">צפיפות אקראית: {Math.round((params.init.kind === 'random' ? params.init.density : 0.3) * 100)}%</label>
      <input id="dens" type="range" min="0" max="1" step="0.01" value={params.init.kind === 'random' ? params.init.density : 0.3}
        onchange={(e) => randomFill(Number(e.currentTarget.value))} />
    </div>
    <div class="row">
      <button class="btn small orange" onclick={() => randomFill()}>מילוי אקראי</button>
      <button class="btn small" onclick={() => setParams({ ...params, init: { kind: 'empty' } })}>ניקוי</button>
      <button class="btn small" onclick={() => setParams({ ...params, init: { kind: 'single' } })}>תא יחיד</button>
      <button class="btn small" onclick={rebuild}>חזרה להתחלה</button>
    </div>
    <div class="row">
      <button class="btn small purple" onclick={() => randomCode(true)}>קוד אקראי, 5 שכנים</button>
      <button class="btn small purple" onclick={() => randomCode(false)}>קוד אקראי, 9 שכנים</button>
    </div>
    <p class="hint">כמו בפרק 5: כללים טוטליסטיים חיצוניים לפי קוד וולפרם, מתא שחור יחיד. משחק החיים הוא קוד 224 עם 9 שכנים.</p>
    <span class="field-label">תבניות</span>
    <ul class="patterns">
      {#each PATTERNS as p (p.id)}
        <li>
          <button onclick={() => loadPattern(p.id)} aria-pressed={params.init.kind === 'pattern' && params.init.id === p.id}>
            <span class="p-name">{p.name}</span>
            <span class="p-text">{p.text}</span>
          </button>
        </li>
      {/each}
    </ul>
    <div class="row">
      <button class="btn small blue" onclick={() => { rleText = ''; rleError = ''; rleOpen = true; }}>ייבוא RLE</button>
      <button class="btn small blue" onclick={exportRLE}>ייצוא RLE</button>
    </div>
  </section>

  <section>
    <h3>רשת</h3>
    <div class="field">
      <span class="field-label">גודל</span>
      <div class="segmented">
        {#each SIZES as s (s)}
          <button aria-pressed={params.size === s} onclick={() => setParams({ ...params, size: s })}>{s}</button>
        {/each}
      </div>
    </div>
    <label class="check"><input type="checkbox" checked={params.wrap} onchange={(e) => setParams({ ...params, wrap: e.currentTarget.checked })} /> קצוות מחוברים (טורוס): מה שיוצא מצד אחד נכנס מהצד השני</label>
  </section>

  <section>
    <h3>צבעים</h3>
    <PalettePicker k={Math.max(2, rule.states)} />
    <label class="check"><input type="checkbox" checked={params.age} onchange={(e) => setParams({ ...params, age: e.currentTarget.checked })} /> צביעה לפי גיל: תאים צעירים בצהוב, ותיקים בסגול</label>
  </section>

  <section>
    <CommonTools title={`משחק החיים: ${params.rule}`} onExportPNG={exportPNG} {shortcuts} />
  </section>
{/snippet}

{#snippet main()}
  <div class="stage" bind:this={host} class:drawing={tool !== 'move'}>
    <canvas bind:this={canvas} class="gl"></canvas>
    <canvas bind:this={overlay} class="ov" ondblclick={fit} aria-label="רשת התאים"></canvas>
    <div class="zoom">
      <button class="btn icon" onclick={() => zoomAt(pz, 1.5, cw / 2, ch / 2)} aria-label="התקרבות">+</button>
      <button class="btn icon" onclick={() => zoomAt(pz, 1 / 1.5, cw / 2, ch / 2)} aria-label="התרחקות">−</button>
      <button class="btn icon" onclick={fit} aria-label="התאמה למסך">⤢</button>
    </div>
    {#if glError}<p class="gl-error">{glError}</p>{/if}
  </div>
{/snippet}

{#snippet overlaySnippet()}
  {#if info}
    <div class="cell-info" role="status">
      <span><ColorText text={info.text} {colors} /></span>
      <button class="btn icon small" onclick={() => { info = null; invalidate(); }} aria-label="סגירה">✕</button>
    </div>
  {/if}
{/snippet}

<Shell title={named?.name ?? params.rule} subtitle="אוטומט דו־ממדי" {main} {panel} {quick} overlay={overlaySnippet} />

<FloatingPanel title="כללי העדכון" open={rulesOpen} onClose={() => (rulesOpen = false)} width={rule.range > 1 ? 560 : 520}>
  <div class="rules">
    <div class="rules-head">
      <span class="rule-name ltr">{formatRule(rule)}</span>
      {#if named}<span class="badge">{named.name}</span>{/if}
    </div>
    <p class="desc"><ColorText text={description} {colors} /></p>

    {#if rule.family === 'wireworld'}
      <div class="ww">
        {#each [[1, 2, 'תמיד'], [2, 3, 'תמיד'], [3, 1, '1 או 2 ראשים בשכנות'], [3, 3, 'אחרת']] as [a, b, when], i (i)}
          <div class="ww-row">
            <span class="cell" style:background={colors[a as number]}></span>
            <span>→</span>
            <span class="cell" style:background={colors[b as number]}></span>
            <span class="muted">{when}</span>
          </div>
        {/each}
      </div>
    {:else if rule.range === 1 && !rule.center}
      <table class="bs">
        <thead>
          <tr>
            <th>שכנים חיים</th>
            {#each rule.birth as _, i (i)}<th>{i}</th>{/each}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th><span class="cell" style:background={colors[0]}></span> → <span class="cell" style:background={colors[1]}></span> לידה B</th>
            {#each rule.birth as on, i (i)}
              <td><button class="tick birth" aria-pressed={on} onclick={() => toggle('birth', i)} aria-label={`לידה עם ${i} שכנים`}>{on ? '✓' : ''}</button></td>
            {/each}
          </tr>
          <tr>
            <th><span class="cell" style:background={colors[1]}></span> → <span class="cell" style:background={colors[1]}></span> הישרדות S</th>
            {#each rule.survive as on, i (i)}
              <td><button class="tick survive" aria-pressed={on} onclick={() => toggle('survive', i)} aria-label={`הישרדות עם ${i} שכנים`}>{on ? '✓' : ''}</button></td>
            {/each}
          </tr>
        </tbody>
      </table>
    {:else}
      {@const [b0, b1] = interval(rule.birth)}
      {@const [s0, s1] = interval(rule.survive)}
      {@const m = maxCount(rule.range, rule.vonNeumann, rule.center)}
      <div class="ltl">
        <label>לידה: מ־<input type="number" min="0" max={m} value={b0} onchange={(e) => setSpan('birth', Number(e.currentTarget.value), b1)} />
          עד <input type="number" min="0" max={m} value={b1} onchange={(e) => setSpan('birth', b0, Number(e.currentTarget.value))} /> שכנים</label>
        <label>הישרדות: מ־<input type="number" min="0" max={m} value={s0} onchange={(e) => setSpan('survive', Number(e.currentTarget.value), s1)} />
          עד <input type="number" min="0" max={m} value={s1} onchange={(e) => setSpan('survive', s0, Number(e.currentTarget.value))} /> שכנים</label>
        <label class="check"><input type="checkbox" checked={rule.center} onchange={(e) => setCenter(e.currentTarget.checked)} /> לספור גם את התא עצמו</label>
      </div>
    {/if}

    {#if wcode !== null}
      <div class="row">
        <label for="wcode">קוד וולפרם ({rule.vonNeumann ? '5' : '9'} שכנים, כולל התא):</label>
        <input id="wcode" class="ltr" type="number" min="0" style="width:110px" value={wcode}
          onchange={(e) => setRule(fromWolframCode(Number(e.currentTarget.value) || 0, rule.vonNeumann))} />
        <div class="segmented">
          <button aria-pressed={rule.vonNeumann} onclick={() => setRule(fromWolframCode(Math.min(wcode ?? 0, 1023), true))}>5</button>
          <button aria-pressed={!rule.vonNeumann} onclick={() => setRule(fromWolframCode(wcode ?? 0, false))}>9</button>
        </div>
      </div>
    {/if}
    {#if rule.family !== 'wireworld'}
      <div class="row">
        <label class="field">טווח (רדיוס)
          <input type="range" min="1" max="10" value={rule.range} onchange={(e) => setRange(Number(e.currentTarget.value))} />
        </label>
        <span class="badge">{rule.range}</span>
        <label class="field">מצבים
          <input type="number" min="2" max="16" value={rule.states} onchange={(e) => setStates(Number(e.currentTarget.value))} style="width:70px" />
        </label>
      </div>
      <p class="hint">טווח 1 ושני מצבים: משפחת משחק החיים. יותר מצבים: Generations. טווח גדול: Larger than Life.</p>
    {/if}
  </div>
</FloatingPanel>

<FloatingPanel title="RLE" open={rleOpen} onClose={() => (rleOpen = false)} width={520}>
  <div class="rle">
    <p class="hint">הפורמט של Golly ו־LifeWiki. אפשר להדביק כאן תבנית ולייבא, או להעתיק את מה שיש עכשיו ברשת.</p>
    <textarea class="ltr" rows="10" bind:value={rleText} spellcheck="false"></textarea>
    {#if rleError}<span class="error">{rleError}</span>{/if}
    <div class="row">
      <button class="btn small primary" onclick={importRLE}>ייבוא לרשת</button>
      <label class="btn small">קובץ…<input type="file" accept=".rle,.txt" hidden onchange={onRLEFile} /></label>
      <button class="btn small" onclick={() => navigator.clipboard.writeText(rleText)}>העתקה</button>
      <button class="btn small" onclick={() => downloadBlob(new Blob([rleText], { type: 'text/plain' }), 'pattern.rle')}>הורדה</button>
    </div>
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
    align-items: center;
  }
  .stats {
    display: flex;
    gap: 16px;
    font-size: 14px;
    color: var(--text-muted);
  }
  .stats b {
    color: var(--accent-4);
    font-size: 17px;
  }
  .hint {
    margin: 0;
    font-size: 12.5px;
    color: var(--text-muted);
  }
  .error {
    color: var(--accent-3);
    font-size: 13px;
    font-weight: 600;
  }
  .rule-input {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-weight: 700;
  }
  .color-pick {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 2px solid var(--border);
  }
  .color-pick[aria-pressed='true'] {
    border-color: var(--accent-2);
    box-shadow: 0 0 0 2px var(--accent-2-soft);
  }
  .patterns {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .patterns button {
    width: 100%;
    text-align: start;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
  }
  .patterns button:hover,
  .patterns button[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .p-name {
    font-weight: 600;
  }
  .p-text {
    font-size: 12.5px;
    color: var(--text-muted);
  }
  .stage {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .stage canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
  .ov {
    touch-action: none;
    cursor: grab;
  }
  .drawing .ov {
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
  .gl-error {
    position: absolute;
    inset: 40% 20px auto;
    text-align: center;
    color: var(--accent-3);
    font-weight: 600;
  }
  .cell-info {
    position: absolute;
    bottom: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    max-width: min(520px, calc(100% - 24px));
    font-size: 14px;
    line-height: 1.5;
  }
  .rules {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .rules-head {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .rule-name {
    font-size: 20px;
    font-weight: 800;
    color: var(--accent-strong);
    font-family: var(--font-mono);
  }
  .desc {
    margin: 0;
    font-size: 15px;
    line-height: 1.6;
  }
  .bs {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
  }
  .bs th,
  .bs td {
    padding: 3px;
    text-align: center;
  }
  .bs tbody th {
    text-align: start;
    white-space: nowrap;
    font-weight: 600;
  }
  .tick {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 2px solid var(--border);
    background: var(--surface);
    font-weight: 800;
    font-size: 16px;
  }
  .tick.birth[aria-pressed='true'] {
    background: var(--accent-2);
    border-color: var(--accent-2);
    color: #fff;
  }
  .tick.survive[aria-pressed='true'] {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .cell {
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
    vertical-align: -2px;
  }
  .ltl {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ltl input[type='number'] {
    width: 70px;
  }
  .ww {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ww-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .ww .cell {
    width: 22px;
    height: 22px;
  }
  .rle {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  textarea {
    width: 100%;
    font-family: var(--font-mono);
    font-size: 13px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px;
    background: var(--surface);
  }
</style>
