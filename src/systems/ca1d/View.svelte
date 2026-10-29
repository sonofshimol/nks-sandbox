<script lang="ts">
  import { onMount } from 'svelte';
  import {
    codeToRule,
    complementRule,
    infiniteWidth,
    maskPyramid,
    MASKED,
    mirrorRule,
    parseRuleDigits,
    randomizeRule,
    ruleCount,
    ruleDigits,
    ruleToCode,
    run1D,
    tableIndexFor,
    type Boundary,
    type Rule1D,
  } from '../../engine/ca1d';
  import { formatCells, makeRow, seedCells, trimCells } from '../../engine/init1d';
  import { colorsFor } from '../../engine/palette';
  import { randomSeed } from '../../engine/random';
  import { media } from '../../lib/media.svelte';
  import { palettes } from '../../lib/palettes.svelte';
  import { downloadBlob, gridPNG } from '../../render/cellImage';
  import ColorText from '../../ui/ColorText.svelte';
  import CommonTools from '../../ui/CommonTools.svelte';
  import FloatingPanel from '../../ui/FloatingPanel.svelte';
  import GridCanvas, { type Highlight } from '../../ui/GridCanvas.svelte';
  import Modal from '../../ui/Modal.svelte';
  import PolarCanvas from '../../ui/PolarCanvas.svelte';
  import PalettePicker from '../../ui/PalettePicker.svelte';
  import Shell from '../../ui/Shell.svelte';
  import type { SystemViewProps } from '../types';
  import { describeRule } from './describe';
  import { examples } from './examples';
  import Gallery from './Gallery.svelte';
  import {
    defaultCodeFor,
    familyName,
    LIMITS,
    ruleName,
    ruleOf,
    safeBigInt,
    type CA1DParams,
  } from './params';
  import RuleIcons from './RuleIcons.svelte';

  let { params, setParams }: SystemViewProps<CA1DParams> = $props();

  let rulesOpen = $state(false);
  let galleryOpen = $state(false);
  let selected = $state<{ x: number; t: number } | null>(null);
  let canvasRef = $state<GridCanvas | PolarCanvas>();
  let digitsText = $state('');
  let digitsError = $state('');

  const rule = $derived(ruleOf(params));
  const colors = $derived(colorsFor(palettes.current, params.k));
  const elementary = $derived(params.k === 2 && params.r === 1 && !params.totalistic);
  const description = $derived(describeRule(rule));
  const maxCode = $derived(ruleCount(params.k, params.r, params.totalistic) - 1n);
  const locks = $derived(new Set(params.locks));
  const digits = $derived(ruleDigits(rule));
  $effect(() => {
    digitsText = digits;
    digitsError = '';
  });

  function applyDigits() {
    const t = parseRuleDigits(digitsText, params.k, rule.table.length);
    if (typeof t === 'string') {
      digitsError = t;
      return;
    }
    digitsError = '';
    setTable(t);
  }

  /** Random rule that keeps the locked entries. */
  function randomize() {
    setParams({ ...params, code: ruleToCode(randomizeRule(rule, locks)).toString() });
  }

  function toggleLock(i: number) {
    const next = new Set(params.locks);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setParams({ ...params, locks: [...next].sort((a, b) => a - b) });
  }
  function setAllLocks(on: boolean) {
    setParams({ ...params, locks: on ? Array.from(rule.table, (_, i) => i) : [] });
  }

  // ---- simulation ----
  const sim = $derived.by(() => {
    const { k, r, init, boundary } = params;
    const infinite = boundary === 'infinite' && init.kind !== 'random';
    if (infinite) {
      const seed = seedCells(init, k);
      const maxSteps = Math.floor(Math.sqrt(LIMITS.maxCells / (2 * r))) - seed.length;
      const steps = Math.min(params.steps, Math.max(1, maxSteps));
      const W = infiniteWidth(seed.length, r, steps);
      const row = new Uint8Array(W);
      const start = r * steps;
      row.set(seed, start);
      const st = run1D({ rule, init: row, steps, boundary: 'infinite' });
      if (params.pyramid) maskPyramid(st, start, start + seed.length - 1, r);
      return { st, steps, infinite, start };
    }
    const W = params.width;
    const steps = Math.min(params.steps, Math.floor(LIMITS.maxCells / W));
    const b: Boundary = boundary === 'infinite' ? 'periodic' : boundary;
    const st = run1D({ rule, init: makeRow(init, W, k), steps, boundary: b });
    return { st, steps, infinite, start: 0 };
  });

  const truncated = $derived(sim.steps < params.steps);

  // ---- clicking a cell ----
  function neighborsOf(x: number, t: number): { cells: number[]; pos: [number, number][] } {
    const { width: W, cells: data } = sim.st;
    const cells: number[] = [];
    const pos: [number, number][] = [];
    for (let d = -params.r; d <= params.r; d++) {
      let nx = x + d;
      const periodic = params.boundary === 'periodic' || (params.boundary === 'infinite' && params.init.kind === 'random');
      if (periodic) nx = (nx + W) % W;
      if (nx < 0 || nx >= W) {
        cells.push(0);
        continue;
      }
      const v = data[(t - 1) * W + nx];
      cells.push(v === MASKED ? 0 : v);
      pos.push([nx, t - 1]);
    }
    return { cells, pos };
  }

  const highlight = $derived.by((): Highlight | null => {
    if (!selected || selected.t === 0 || selected.t >= sim.st.height || selected.x >= sim.st.width) return null;
    return { x: selected.x, y: selected.t, neighbors: neighborsOf(selected.x, selected.t).pos };
  });

  const selectedInfo = $derived.by(() => {
    if (!highlight || !selected) return null;
    const nb = neighborsOf(selected.x, selected.t);
    const index = tableIndexFor(rule, nb.cells);
    return { cells: nb.cells, index, out: rule.table[index], t: selected.t, x: selected.x };
  });

  function onCellClick(x: number, t: number) {
    if (t === 0) {
      editInitial(x);
      return;
    }
    selected = selected && selected.x === x && selected.t === t ? null : { x, t };
  }

  /** Clicking the first row edits the initial condition (switching to a drawn one). */
  function editInitial(x: number) {
    const { width: W, cells } = sim.st;
    const row = Uint8Array.from(cells.subarray(0, W), (v) => (v === MASKED ? 0 : v));
    row[x] = (row[x] + 1) % params.k;
    selected = null;
    if (sim.infinite) {
      setParams({ ...params, init: { kind: 'custom', cells: formatCells(trimCells(row)) } });
    } else {
      setParams({ ...params, init: { kind: 'custom', cells: formatCells(row) }, width: W });
    }
  }

  // ---- rule changes ----
  function setTable(table: Uint8Array) {
    const r: Rule1D = { ...rule, table };
    setParams({ ...params, code: ruleToCode(r).toString() });
  }
  function setCode(code: bigint) {
    const n = maxCode + 1n;
    setParams({ ...params, code: (((code % n) + n) % n).toString() });
  }
  function stepRule(d: number) {
    setCode(safeBigInt(params.code) + BigInt(d));
  }
  function setFamily(k: number, r: number, totalistic: boolean) {
    if (!familyAllowed(k, r, totalistic)) totalistic = true;
    const init = params.init.kind === 'single' ? { kind: 'single' as const, color: Math.min(params.init.color, k - 1) } : params.init;
    setParams({ ...params, k, r, totalistic, code: defaultCodeFor(k, r, totalistic), init, locks: [0] });
  }
  function familyAllowed(k: number, r: number, totalistic: boolean) {
    return totalistic || k ** (2 * r + 1) <= 1024;
  }

  function setInitKind(kind: 'single' | 'random' | 'custom') {
    if (kind === params.init.kind) return;
    if (kind === 'single') setParams({ ...params, init: { kind, color: 1 }, boundary: 'infinite' });
    else if (kind === 'random')
      setParams({
        ...params,
        init: { kind, density: 0.5, seed: randomSeed() },
        boundary: params.boundary === 'infinite' ? 'periodic' : params.boundary,
      });
    else {
      const W = sim.st.width;
      const row = Uint8Array.from(sim.st.cells.subarray(0, W), (v) => (v === MASKED ? 0 : v));
      setParams({ ...params, init: { kind, cells: formatCells(sim.infinite ? trimCells(row) : row) } });
    }
  }

  async function exportPNG() {
    const blob = await gridPNG(sim.st.cells, sim.st.width, sim.st.height, colors, palettes.current.grid, '#ffffff');
    if (blob) downloadBlob(blob, `${elementary ? 'rule' : 'code'}-${params.code}.png`);
  }

  // ---- keyboard ----
  const shortcuts: [string, string][] = [
    ['↑ / ↓', 'הכלל הבא / הקודם'],
    ['R', 'כללי העדכון'],
    ['G', 'גלריה'],
    ['N', 'כלל אקראי'],
    ['F', 'התאמה למסך'],
    ['Esc', 'סגירת חלון'],
  ];

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.closest?.('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowUp') stepRule(1);
      else if (e.key === 'ArrowDown') stepRule(-1);
      else if (e.code === 'KeyR') rulesOpen = !rulesOpen;
      else if (e.code === 'KeyG') galleryOpen = !galleryOpen;
      else if (e.code === 'KeyN') randomize();
      else if (e.code === 'KeyF') canvasRef?.fit();
      else if (e.key === 'Escape') {
        rulesOpen = false;
        selected = null;
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Close the cell info when the rule or layout changes.
  $effect(() => {
    void params.code;
    void sim.st.width;
    selected = null;
  });

</script>

{#snippet ruleStepper()}
  <div class="stepper ltr">
    <button class="btn icon" onclick={() => stepRule(-1)} aria-label="הכלל הקודם">−</button>
    <input
      class="code"
      type="text"
      inputmode="numeric"
      value={params.code}
      onchange={(e) => setCode(safeBigInt(e.currentTarget.value))}
      aria-label="מספר הכלל"
    />
    <button class="btn icon" onclick={() => stepRule(1)} aria-label="הכלל הבא">+</button>
  </div>
{/snippet}

{#snippet quick()}
  <div class="quickbar">
    {@render ruleStepper()}
    <button class="btn primary" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
    {#if elementary}<button class="btn blue" onclick={() => (galleryOpen = true)}>גלריה</button>{/if}
  </div>
{/snippet}

{#snippet panel()}
  <section>
    {#if !media.mobile}
      <div class="field">
        <span class="field-label">{elementary ? 'מספר הכלל' : 'קוד הכלל'}</span>
        {@render ruleStepper()}
      </div>
      <button class="btn primary big" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
    {/if}
    <button class="mini-rule" onclick={() => (rulesOpen = true)} aria-label="פתיחת כללי העדכון">
      <RuleIcons {rule} {colors} grid={palettes.current.grid} editable={false} />
    </button>
    <div class="row">
      {#if elementary}<button class="btn blue" onclick={() => (galleryOpen = true)}>גלריית 256 הכללים</button>{/if}
      <button class="btn orange" onclick={() => randomize()}>כלל אקראי</button>
    </div>
  </section>

  <section>
    <h3>סוג הכלל</h3>
    <div class="field">
      <span class="field-label">מספר צבעים</span>
      <div class="segmented">
        {#each LIMITS.k as k (k)}
          <button aria-pressed={params.k === k} onclick={() => setFamily(k, params.r, params.totalistic)}>{k}</button>
        {/each}
      </div>
    </div>
    <div class="field">
      <span class="field-label">טווח (שכנים מכל צד)</span>
      <div class="segmented">
        {#each LIMITS.r as r (r)}
          <button aria-pressed={params.r === r} onclick={() => setFamily(params.k, r, params.totalistic)}>{r}</button>
        {/each}
      </div>
    </div>
    <label class="check">
      <input
        type="checkbox"
        checked={params.totalistic}
        disabled={!familyAllowed(params.k, params.r, false)}
        onchange={(e) => setFamily(params.k, params.r, e.currentTarget.checked)}
      />
      טוטליסטי (רק סכום הצבעים בשכנות משנה)
    </label>
  </section>

  <section>
    <h3>תנאי התחלה</h3>
    <div class="segmented">
      <button aria-pressed={params.init.kind === 'single'} onclick={() => setInitKind('single')}>תא יחיד</button>
      <button aria-pressed={params.init.kind === 'random'} onclick={() => setInitKind('random')}>אקראי</button>
      <button aria-pressed={params.init.kind === 'custom'} onclick={() => setInitKind('custom')}>מצויר</button>
    </div>
    {#if params.init.kind === 'single' && params.k > 2}
      <div class="row">
        <span class="field-label">צבע התא:</span>
        {#each Array.from({ length: params.k - 1 }, (_, i) => i + 1) as c (c)}
          <button
            class="color-pick"
            style:background={colors[c]}
            aria-pressed={params.init.color === c}
            aria-label={`מצב ${c}`}
            onclick={() => setParams({ ...params, init: { kind: 'single', color: c } })}
          ></button>
        {/each}
      </div>
    {:else if params.init.kind === 'random'}
      {@const init = params.init}
      <div class="field">
        <label for="dens">צפיפות: {Math.round(init.density * 100)}%</label>
        <input
          id="dens"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={init.density}
          oninput={(e) => setParams({ ...params, init: { ...init, density: Number(e.currentTarget.value) } })}
        />
      </div>
      <button class="btn small" onclick={() => setParams({ ...params, init: { ...init, seed: randomSeed() } })}>הגרלה חדשה</button>
    {:else if params.init.kind === 'custom'}
      {@const init = params.init}
      <div class="field">
        <label for="cells">תאים (ספרות 0 עד {params.k - 1})</label>
        <input
          id="cells"
          class="ltr"
          type="text"
          inputmode="numeric"
          value={init.cells}
          onchange={(e) => setParams({ ...params, init: { kind: 'custom', cells: e.currentTarget.value.replace(/[^0-9]/g, '') || '1' } })}
        />
      </div>
    {/if}
    <p class="hint">טיפ: לחיצה על תא בשורה העליונה משנה את הצבע שלו.</p>
  </section>

  <section>
    <h3>צורה וגבולות</h3>
    <div class="field">
      <span class="field-label">צורה</span>
      <div class="segmented">
        <button aria-pressed={params.shape === 'grid'} onclick={() => setParams({ ...params, shape: 'grid' })}>שורות</button>
        <button
          aria-pressed={params.shape === 'ring'}
          onclick={() => setParams({ ...params, shape: 'ring', boundary: params.boundary === 'infinite' ? 'periodic' : params.boundary })}
        >טבעות</button>
      </div>
      {#if params.shape === 'ring'}
        <span class="hint">כל צעד הוא טבעת סביב הקודם, והטבעת מחולקת ל־{params.boundary === 'infinite' ? sim.st.width : params.width} חלקים שווים. בגבולות מחזוריים התא הראשון והאחרון בטבעת הם שכנים.</span>
        <label for="hole">חור במרכז: {Math.round(params.hole * 100)}%</label>
        <input id="hole" type="range" min="0" max="0.7" step="0.01" value={params.hole}
          oninput={(e) => setParams({ ...params, hole: Number(e.currentTarget.value) })} />
      {/if}
    </div>
    <div class="field">
      <span class="field-label">גבולות</span>
      <div class="segmented">
        {#if params.init.kind !== 'random'}
          <button aria-pressed={params.boundary === 'infinite'} onclick={() => setParams({ ...params, boundary: 'infinite' })}>אינסופי</button>
        {/if}
        <button aria-pressed={params.boundary === 'periodic'} onclick={() => setParams({ ...params, boundary: 'periodic' })}>מחזורי</button>
        <button aria-pressed={params.boundary === 'fixed'} onclick={() => setParams({ ...params, boundary: 'fixed' })}>קבוע</button>
      </div>
    </div>
    {#if params.boundary === 'infinite'}
      <label class="check">
        <input type="checkbox" checked={params.pyramid} onchange={(e) => setParams({ ...params, pyramid: e.currentTarget.checked })} />
        תצוגת פירמידה (רק התאים שהתבנית יכולה להגיע אליהם)
      </label>
    {:else}
      <div class="field">
        <label for="width">רוחב: {params.width} תאים</label>
        <input id="width" type="range" min="11" max={LIMITS.maxWidth} step="1" value={params.width}
          oninput={(e) => setParams({ ...params, width: Number(e.currentTarget.value) })} />
      </div>
    {/if}
    <div class="field">
      <label for="steps">צעדים: {params.steps}</label>
      <input id="steps" type="range" min="10" max={LIMITS.maxSteps} step="10" value={params.steps}
        oninput={(e) => setParams({ ...params, steps: Number(e.currentTarget.value) })} />
      {#if truncated}<span class="hint">מוצגים {sim.steps} צעדים, כדי שהתצוגה תישאר מהירה.</span>{/if}
    </div>
  </section>

  <section>
    <h3>צבעים</h3>
    <PalettePicker k={params.k} />
  </section>

  <section>
    <h3>דוגמאות</h3>
    <ul class="examples">
      {#each examples as ex (ex.id)}
        <li>
          <button onclick={() => setParams({ ...ex.params })}>
            <span class="ex-title">{ex.title}</span>
            {#if ex.page}<span class="badge">עמ' {ex.page}</span>{/if}
            <span class="ex-text">{ex.text}</span>
          </button>
        </li>
      {/each}
    </ul>
  </section>

  <section>
    <CommonTools title={`${ruleName(params)} (${familyName(params)})`} onExportPNG={exportPNG} {shortcuts} />
  </section>
{/snippet}

{#snippet main()}
  {#if params.shape === 'ring'}
    <PolarCanvas
      bind:this={canvasRef}
      cells={sim.st.cells}
      width={sim.st.width}
      height={sim.st.height}
      {colors}
      grid={palettes.current.grid}
      hole={params.hole}
      {highlight}
      {onCellClick}
    />
  {:else}
    <GridCanvas
      bind:this={canvasRef}
      cells={sim.st.cells}
      width={sim.st.width}
      height={sim.st.height}
      {colors}
      grid={palettes.current.grid}
      {highlight}
      {onCellClick}
    />
  {/if}
{/snippet}

{#snippet overlay()}
  {#if selectedInfo}
    <div class="cell-info" role="status">
      <div class="ci-text">
        <strong>צעד {selectedInfo.t}</strong>
        <span class="muted">התא נוצר מהשכנות:</span>
      </div>
      <div class="ci-icon ltr">
        <div class="ci-top">
          {#each selectedInfo.cells as c, i (i)}<span style:background={colors[c]}></span>{/each}
        </div>
        <span class="ci-arrow">↓</span>
        <span class="ci-out" style:background={colors[selectedInfo.out]}></span>
      </div>
      <button class="btn small blue" onclick={() => (rulesOpen = true)}>בכללי העדכון</button>
      <button class="btn icon small" onclick={() => (selected = null)} aria-label="סגירה">✕</button>
    </div>
  {/if}
{/snippet}

<Shell title={ruleName(params)} subtitle={familyName(params)} {main} {panel} {quick} {overlay} />

<FloatingPanel title="כללי העדכון" open={rulesOpen} onClose={() => (rulesOpen = false)} width={rule.table.length <= 8 ? 60 + rule.table.length * ((2 * params.r + 1) * 26 + 18) : 760}>
  <div class="rules">
    <div class="rules-head">
      <span class="rule-name">{ruleName(params)}</span>
      <span class="badge">{familyName(params)}</span>
    </div>
    <RuleIcons {rule} {colors} grid={palettes.current.grid} large onChange={setTable} active={selectedInfo?.index ?? null} {locks} onToggleLock={toggleLock} />
    <div class="row lock-tools">
      <span class="hint">🔒 תאים נעולים לא משתנים כשמגרילים כלל אקראי.</span>
      <button class="btn small" onclick={() => setAllLocks(true)}>נעילת הכל</button>
      <button class="btn small" onclick={() => setAllLocks(false)}>שחרור הכל</button>
    </div>
    <div class="digits">
      <label for="digits">כתיבה בבסיס {params.k}</label>
      <div class="row">
        <input
          id="digits"
          class="ltr mono-input"
          type="text"
          inputmode="numeric"
          spellcheck="false"
          bind:value={digitsText}
          onkeydown={(e) => e.key === 'Enter' && applyDigits()}
          onblur={applyDigits}
        />
        <button class="btn small" onclick={applyDigits}>החלה</button>
      </div>
      <span class="hint">
        ספרה לכל אייקון, באותו סדר משמאל לימין. קו | מסמן ציר סימטריה: אפשר לכתוב רק את החצי
        הראשון ואחריו | (למשל 33312| הופך ל־3331221333).
      </span>
      {#if digitsError}<span class="error">{digitsError}</span>{/if}
    </div>
    <p class="desc"><ColorText text={description} {colors} /></p>
    <p class="hint">לחיצה על התא התחתון של אייקון משנה את התוצאה, והמספר מתעדכן בהתאם.</p>
    <div class="row">
      {@render ruleStepper()}
      <button class="btn small orange" onclick={() => randomize()}>אקראי</button>
      {#if !params.totalistic}
        <button class="btn small" onclick={() => setTable(mirrorRule(rule).table)} title="החלפת שמאל וימין">תמונת מראה</button>
      {/if}
      <button class="btn small" onclick={() => setTable(complementRule(rule).table)} title="החלפת הצבעים זה בזה">היפוך צבעים</button>
    </div>
  </div>
</FloatingPanel>

<Modal title="גלריה" open={galleryOpen} onClose={() => (galleryOpen = false)}>
  <Gallery
    {colors}
    current={elementary ? params.code : ''}
    onPick={(code) => {
      setParams({ ...params, code: String(code) });
      galleryOpen = false;
    }}
  />
</Modal>

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
  .big {
    font-size: 16px;
    min-height: 44px;
  }
  .stepper {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .code {
    width: 110px;
    text-align: center;
    font-weight: 700;
    font-size: 16px;
    font-family: var(--font-mono);
  }
  .mini-rule {
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    padding: 8px;
    max-height: 160px;
    overflow: hidden;
  }
  .quickbar {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .quickbar .code {
    width: 76px;
  }
  .hint {
    margin: 0;
    font-size: 12.5px;
    color: var(--text-muted);
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
  .examples {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .examples button {
    width: 100%;
    text-align: start;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    padding: 8px 10px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 8px;
  }
  .examples button:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .ex-title {
    font-weight: 600;
  }
  .ex-text {
    grid-column: 1 / -1;
    font-size: 13px;
    color: var(--text-muted);
  }

  .rules {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .rules-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .rule-name {
    font-size: 22px;
    font-weight: 800;
    color: var(--accent-strong);
  }
  .desc {
    margin: 0;
    font-size: 16px;
    line-height: 1.6;
  }
  .digits {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
  }
  .digits label {
    font-weight: 600;
  }
  .mono-input {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-weight: 700;
    letter-spacing: 0.12em;
  }
  .error {
    color: var(--accent-3);
    font-size: 13px;
    font-weight: 600;
  }
  .lock-tools {
    justify-content: space-between;
  }

  .cell-info {
    position: absolute;
    bottom: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    max-width: calc(100% - 24px);
    flex-wrap: wrap;
  }
  .ci-text {
    display: flex;
    flex-direction: column;
    font-size: 13px;
  }
  .ci-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .ci-top {
    display: flex;
  }
  .ci-top span,
  .ci-out {
    width: 18px;
    height: 18px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
    display: block;
  }
  .ci-top span:nth-child(n) {
    outline: 2px solid var(--highlight-neighbors);
    outline-offset: -2px;
  }
  .ci-out {
    outline: 2px solid var(--highlight);
    outline-offset: -2px;
  }
  .ci-arrow {
    font-size: 11px;
    line-height: 1;
    color: var(--text-muted);
  }
</style>
