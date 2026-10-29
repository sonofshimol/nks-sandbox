<script lang="ts">
  // The letters automaton ("spellular automaton"): a pyramid of Hebrew letters
  // whose symmetric rule evolves by hill climbing to spell as many words as possible.
  // Rows are read right to left, so the grid is drawn mirrored (index 0 on the right).
  import { onMount, untrack } from 'svelte';
  import { MASKED } from '../../engine/ca1d';
  import {
    displayLetter,
    displayWord,
    key,
    keyCells,
    LettersWorld,
    loadWords,
    N,
    SYMBOLS,
    type FoundWord,
  } from '../../engine/letters';
  import { palettes } from '../../lib/palettes.svelte';
  import { load, save } from '../../lib/storage';
  import { downloadBlob, gridPNG } from '../../render/cellImage';
  import CommonTools from '../../ui/CommonTools.svelte';
  import FloatingPanel from '../../ui/FloatingPanel.svelte';
  import GridCanvas, { type Box, type Highlight } from '../../ui/GridCanvas.svelte';
  import Shell from '../../ui/Shell.svelte';
  import type { SystemViewProps } from '../types';
  import { LETTER_COLORS, type LettersParams } from './params';

  let { params, setParams }: SystemViewProps<LettersParams> = $props();

  const DICT_KEY = 'ca.letters.dict';

  let words = $state<Set<string> | null>(null);
  let dictName = $state('המילון המובנה');
  let world = $state<LettersWorld | null>(null);
  let version = $state(0); // bumped whenever the world changes
  let running = $state(false);
  let rulesOpen = $state(false);
  let selectedWord = $state<string | null>(null);
  let selCell = $state(-1); // index into world.grid
  let lastState = '';
  let canvasRef = $state<GridCanvas>();

  onMount(() => {
    (async () => {
      const own = load<{ name: string; text: string } | null>(DICT_KEY, null);
      if (own) {
        words = loadWords(own.text);
        dictName = own.name;
      } else {
        words = loadWords((await import('./words-he.txt?raw')).default);
      }
    })();
    return () => (running = false);
  });

  // Build a new world when the shape, size or dictionary change.
  $effect(() => {
    const shape = params.shape;
    const size = params.size;
    const dict = words;
    if (!dict) return;
    untrack(() => build(shape, size, dict));
  });

  function build(shape: 'pyr' | 'rect', size: number, dict: Set<string>) {
    const w = new LettersWorld(
      { shape, size, minLen: params.minLen, whole: params.whole },
      dict,
    );
    w.lockSeed = params.lockSeed;
    w.fresh(params.seedText);
    if (params.state) w.decode(params.state);
    lastState = params.state;
    world = w;
    selCell = -1;
    selectedWord = null;
    bump();
  }

  // Options that only need a re-score.
  $effect(() => {
    const w = world;
    if (!w) return;
    w.config.minLen = params.minLen;
    w.config.whole = params.whole;
    w.lockSeed = params.lockSeed;
    w.evaluate();
    bump();
  });

  // A state pasted into the URL (or from a favorite) while the world exists.
  $effect(() => {
    const s = params.state;
    if (!world || running || s === lastState) return;
    lastState = s;
    if (s) world.decode(s);
    bump();
  });

  // Bump without reading `version` in the calling effect (that would loop).
  function bump() {
    untrack(() => version++);
  }

  function saveState() {
    if (!world) return;
    lastState = world.encode();
    setParams({ ...params, state: lastState });
  }

  function loop() {
    if (!running || !world) return;
    const t0 = performance.now();
    while (performance.now() - t0 < 14) world.step();
    bump();
    requestAnimationFrame(loop);
  }

  function setRunning(v: boolean) {
    running = v;
    if (v) requestAnimationFrame(loop);
    else saveState();
  }

  function fresh() {
    if (!world) return;
    world.fresh(params.seedText);
    selCell = -1;
    selectedWord = null;
    bump();
    if (!running) saveState();
  }

  function setSeedText(text: string) {
    if (!world) return;
    world.setSeedText(text);
    world.gen = 0;
    world.evaluate();
    lastState = world.encode();
    setParams({ ...params, seedText: text, state: lastState });
  }

  function editRule(k: number, v: number) {
    if (!world) return;
    world.rule[k] = v;
    world.evaluate();
    bump();
    if (!running) saveState();
  }

  // ---- derived display data ----
  const view = $derived.by(() => {
    void version;
    const w = world;
    if (!w) return null;
    const { W, H, grid, active } = w;
    const cells = new Uint8Array(W * H);
    for (let r = 0; r < H; r++)
      for (let i = 0; i < W; i++) {
        const k = r * W + i;
        cells[r * W + (W - 1 - i)] = active[k] ? grid[k] : MASKED;
      }
    const map = new Map<string, string>();
    for (const f of w.found) {
      const e = map.get(f.word) ?? '';
      if (!e.includes(f.dir)) map.set(f.word, e + f.dir);
    }
    const list = [...map.entries()].sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0], 'he'));
    return { W, H, cells, found: [...w.found], list, gen: w.gen, best: Math.max(0, w.best) };
  });

  const boxes = $derived.by((): Box[] => {
    if (!view) return [];
    const { W } = view;
    const out: Box[] = [];
    const toBox = (f: FoundWord, color: string, width: number): Box => {
      const first = f.cells[0];
      const r = Math.floor(first / W);
      const st = first % W;
      const L = f.cells.length;
      return f.dir === 'r'
        ? { x: W - st - L, y: r, w: L, h: 1, color, width }
        : { x: W - 1 - st, y: r, w: 1, h: L, color, width };
    };
    for (const f of view.found) if (f.word !== selectedWord) out.push(toBox(f, f.dir === 'r' ? '#5b3a8c' : '#c2366a', 1.5));
    for (const f of view.found) if (f.word === selectedWord) out.push(toBox(f, '#111111', 3.5));
    return out;
  });

  const labelAt = $derived.by(() => {
    void version;
    const w = world;
    if (!w) return null;
    return (x: number, y: number) => {
      const i = w.W - 1 - x;
      const k = y * w.W + i;
      const v = w.grid[k];
      if (!w.active[k] || !v) return '';
      const next = i + 1 < w.W ? w.grid[k + 1] : 0;
      return displayLetter(v, next === 0);
    };
  });

  const highlight = $derived.by((): Highlight | null => {
    void version;
    if (!world || selCell < 0) return null;
    const W = world.W;
    const ps = world.parentsOf(selCell);
    const pos = (k: number): [number, number] => [W - 1 - (k % W), Math.floor(k / W)];
    const [x, y] = pos(selCell);
    return { x, y, neighbors: ps ? ps.filter((p) => p >= 0).map(pos) : [] };
  });

  const cellInfo = $derived.by(() => {
    void version;
    if (!world || selCell < 0) return null;
    const ps = world.parentsOf(selCell);
    if (!ps) return { first: true as const };
    const vals = ps.map((p) => (p < 0 ? 0 : world!.grid[p])) as [number, number, number];
    return { first: false as const, vals, out: world.grid[selCell], key: key(...vals) };
  });

  const rulesInUse = $derived.by(() => {
    void version;
    if (!world) return [];
    const hit = cellInfo && !cellInfo.first ? cellInfo.key : -1;
    return [...world.ruleUse.entries()]
      .sort((a, b) => Number(b[0] === hit) - Number(a[0] === hit) || b[1] - a[1])
      .map(([k, n]) => ({ k, n, cells: keyCells(k), out: world!.rule[k], hit: k === hit }));
  });

  function onCellClick(x: number, y: number) {
    if (!world) return;
    const k = y * world.W + (world.W - 1 - x);
    selCell = selCell === k || !world.active[k] ? -1 : k;
  }

  async function exportPNG() {
    if (!view) return;
    const blob = await gridPNG(view.cells, view.W, view.H, LETTER_COLORS, palettes.current.grid, '#ffffff');
    if (blob) downloadBlob(blob, 'letters.png');
  }

  async function onDictFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    const set = loadWords(text);
    if (set.size < 10) return;
    save(DICT_KEY, { name: file.name, text });
    dictName = file.name;
    words = set;
  }
  function resetDict() {
    save(DICT_KEY, null);
    dictName = 'המילון המובנה';
    import('./words-he.txt?raw').then((m) => (words = loadWords(m.default)));
  }

  const sym = (v: number) => (v ? SYMBOLS[v] : '');
</script>

{#snippet letterCell(v: number, size = 26)}
  <span
    class="lc"
    style:background={LETTER_COLORS[v]}
    style:color={v === 0 || ['#f3c300', '#a1caf1', '#c2b280', '#dcd300', '#f99379', '#e68fac', '#7fd4a8', '#8db600', '#17becf'].includes(LETTER_COLORS[v]) ? '#1b2330' : '#fff'}
    style:width="{size}px"
    style:height="{size}px"
    style:font-size="{Math.round(size * 0.62)}px">{sym(v)}</span>
{/snippet}

{#snippet controls()}
  <div class="row">
    <button class="btn primary grow" onclick={() => setRunning(!running)}>{running ? 'עצירה' : 'הפעלת אבולוציה'}</button>
    <button class="btn" onclick={fresh}>התחלה מחדש</button>
  </div>
{/snippet}

{#snippet quick()}
  <div class="quickbar">
    {@render controls()}
    <button class="btn blue" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
  </div>
{/snippet}

{#snippet panel()}
  <section>
    {@render controls()}
    <button class="btn blue big" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
    {#if view}
      <div class="stats">
        <div><b>{view.gen.toLocaleString('he-IL')}</b><small>דורות</small></div>
        <div><b>{view.best.toLocaleString('he-IL')}</b><small>ניקוד</small></div>
        <div><b>{view.list.length}</b><small>מילים</small></div>
        <div><b>{view.list.length ? displayWord(view.list[0][0]) : '–'}</b><small>הארוכה ביותר</small></div>
      </div>
    {/if}
    <p class="hint">
      בכל דור משתנות שתיים או שלוש כניסות בכלל, ולפעמים גם אות הפתיחה. אם הניקוד לא ירד, השינוי נשאר.
      כל מילה שונה נספרת פעם אחת, ומילה ארוכה יותר באות אחת שווה כפליים.
    </p>
  </section>

  <section>
    <h3>מילים שנמצאו</h3>
    <p class="hint"><span class="swatch" style="background:#5b3a8c"></span> בשורה, מימין לשמאל · <span class="swatch" style="background:#c2366a"></span> בעמודה, מלמעלה למטה</p>
    {#if view && view.list.length}
      <div class="words">
        {#each view.list as [w, d] (w)}
          <button
            class="word {d.length > 1 ? 'rc' : d}"
            aria-pressed={selectedWord === w}
            onclick={() => (selectedWord = selectedWord === w ? null : w)}>{displayWord(w)}</button>
        {/each}
      </div>
    {:else}
      <p class="muted">עוד אין מילים. {view?.gen ? 'תנו לאבולוציה עוד זמן.' : 'הפעילו את האבולוציה.'}</p>
    {/if}
  </section>

  <section>
    <h3>התחלה וצורה</h3>
    <div class="field">
      <label for="seed">{params.shape === 'pyr' ? 'אות פותחת' : 'שורה ראשונה'}</label>
      <input
        id="seed"
        type="text"
        maxlength="40"
        placeholder={params.shape === 'pyr' ? 'למשל: ש (ריק: אקראי)' : 'למשל: שלום עולם'}
        value={params.seedText}
        onchange={(e) => setSeedText(e.currentTarget.value)}
      />
    </div>
    <div class="segmented">
      <button aria-pressed={params.shape === 'pyr'} onclick={() => setParams({ ...params, shape: 'pyr', state: '' })}>פירמידה</button>
      <button aria-pressed={params.shape === 'rect'} onclick={() => setParams({ ...params, shape: 'rect', state: '' })}>מלבן</button>
    </div>
    <div class="segmented">
      {#each ['קטן', 'בינוני', 'גדול'] as label, i (i)}
        <button aria-pressed={params.size === i} onclick={() => setParams({ ...params, size: i, state: '' })}>{label}</button>
      {/each}
    </div>
    <div class="field">
      <span class="field-label">אורך מילה מינימלי</span>
      <div class="segmented">
        {#each [3, 4, 5] as n (n)}
          <button aria-pressed={params.minLen === n} onclick={() => setParams({ ...params, minLen: n })}>{n}</button>
        {/each}
      </div>
    </div>
    <label class="check"><input type="checkbox" checked={params.lockSeed} onchange={(e) => setParams({ ...params, lockSeed: e.currentTarget.checked })} /> ההתחלה קבועה (האבולוציה לא משנה אותה)</label>
    <label class="check"><input type="checkbox" checked={params.whole} onchange={(e) => setParams({ ...params, whole: e.currentTarget.checked })} /> רק מילים שמוקפות ברווח</label>
  </section>

  <section>
    <h3>צבעי האותיות</h3>
    <div class="legend">
      {#each SYMBOLS as _, v (v)}
        <span class="legend-item">{@render letterCell(v, 20)}{#if v === 0}<small>רווח</small>{/if}</span>
      {/each}
    </div>
  </section>

  <section>
    <h3>מילון</h3>
    <p class="hint">
      עכשיו: {dictName}{words ? ` (${words.size.toLocaleString('he-IL')} מילים)` : ''}. אפשר לטעון קובץ טקסט עם מילה בכל שורה,
      למשל רשימת המילים של Hspell. הקובץ נשמר רק בדפדפן הזה. אותיות סופיות נחשבות כמו רגילות.
    </p>
    <div class="row">
      <label class="btn small blue">
        טעינת מילון
        <input type="file" accept=".txt,text/plain" onchange={onDictFile} hidden />
      </label>
      {#if dictName !== 'המילון המובנה'}<button class="btn small" onclick={resetDict}>חזרה למילון המובנה</button>{/if}
    </div>
  </section>

  <section>
    <CommonTools title="אוטומט האותיות" onExportPNG={exportPNG} />
  </section>
{/snippet}

{#snippet main()}
  {#if view}
    <GridCanvas
      bind:this={canvasRef}
      cells={view.cells}
      width={view.W}
      height={view.H}
      colors={LETTER_COLORS}
      grid={palettes.current.grid ?? '#c7d2d8'}
      {boxes}
      {labelAt}
      labelFont={'700 {size}px "Frank Ruhl Libre", "David", serif'}
      {highlight}
      {onCellClick}
    />
  {:else}
    <p class="loading">טוען מילון…</p>
  {/if}
{/snippet}

{#snippet overlay()}
  {#if cellInfo}
    <div class="cell-info" role="status">
      {#if cellInfo.first}
        <span>זו {params.shape === 'pyr' ? 'אות הפתיחה' : 'השורה הראשונה'}. ממנה צומח כל השאר.</span>
      {:else}
        <span class="muted">מעליה:</span>
        <span class="trip">{#each [...cellInfo.vals].reverse() as v, i (i)}{@render letterCell(v, 22)}{/each}</span>
        <span class="muted">לכן כאן:</span>
        {@render letterCell(cellInfo.out, 22)}
        <button class="btn small blue" onclick={() => (rulesOpen = true)}>בכללי העדכון</button>
      {/if}
      <button class="btn icon small" onclick={() => (selCell = -1)} aria-label="סגירה">✕</button>
    </div>
  {/if}
{/snippet}

<Shell title="אוטומט האותיות" subtitle="22 אותיות ורווח, כלל סימטרי" {main} {panel} {quick} {overlay} />

<FloatingPanel title="כללי העדכון" open={rulesOpen} onClose={() => (rulesOpen = false)} width={560}>
  <p class="hint">
    רק הכללים שפועלים עכשיו ברשת. שלוש האותיות למעלה (מימין לשמאל) קובעות את האות שמתחתן, והמספר אומר כמה פעמים
    הכלל הופעל. כל כלל תקף גם בהיפוך ימין־שמאל. אפשר לשנות את התוצאה ישירות.
  </p>
  <div class="rules">
    {#each rulesInUse as r (r.k)}
      <div class="rule" class:hit={r.hit}>
        <div class="trip">{#each [...r.cells].reverse() as v, i (i)}{@render letterCell(v, 24)}{/each}</div>
        <select
          class="out"
          style:background={LETTER_COLORS[r.out]}
          value={r.out}
          onchange={(e) => editRule(r.k, Number(e.currentTarget.value))}
          aria-label="התוצאה"
        >
          {#each Array.from({ length: N }, (_, i) => i) as v (v)}
            <option value={v}>{v ? SYMBOLS[v] : 'רווח'}</option>
          {/each}
        </select>
        <small>{r.n}</small>
      </div>
    {/each}
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
  .grow {
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
  .hint {
    margin: 0;
    font-size: 12.5px;
    color: var(--text-muted);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    text-align: center;
  }
  .stats b {
    display: block;
    font-size: 19px;
    color: var(--accent-4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stats small {
    color: var(--text-muted);
    font-size: 12px;
  }
  .words {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .word {
    padding: 2px 10px;
    border-radius: 999px;
    border: 1.5px solid var(--border);
    background: var(--surface);
    font: 700 16px 'Frank Ruhl Libre', 'David', serif;
  }
  .word.r {
    border-color: #5b3a8c;
    color: #5b3a8c;
  }
  .word.c {
    border-color: #c2366a;
    color: #c2366a;
  }
  .word.rc {
    border-color: #5b3a8c;
    color: #c2366a;
  }
  .word[aria-pressed='true'] {
    background: #111;
    color: #fff;
    border-color: #111;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .lc {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
    font-family: 'Frank Ruhl Libre', 'David', serif;
    font-weight: 700;
    line-height: 1;
  }
  .trip {
    display: inline-flex;
    gap: 2px;
  }
  .rules {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  .rule {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .rule.hit {
    border-color: var(--highlight);
    box-shadow: 0 0 0 2px var(--highlight);
  }
  .rule small {
    font-size: 11px;
    color: var(--text-muted);
  }
  .out {
    min-height: 26px;
    width: 52px;
    padding: 0 4px;
    font: 700 15px 'Frank Ruhl Libre', serif;
    color: #fff;
    text-shadow: 0 0 2px #000;
  }
  .loading {
    padding: 20px;
    color: var(--text-muted);
  }
  .cell-info {
    position: absolute;
    bottom: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    max-width: calc(100% - 24px);
    flex-wrap: wrap;
    font-size: 14px;
  }
</style>
