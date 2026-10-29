<script lang="ts">
  // Mobile automata, Turing machines, substitution and tag systems, register
  // machines and continuous CAs: everything that draws one row per step.
  import { onMount } from 'svelte';
  import { colorsFor, hexToRgb, rgbToHex } from '../../engine/palette';
  import { mobileCode, NONE, tmEntries, type Picture } from '../../engine/programs';
  import { mulberry32, randomSeed } from '../../engine/random';
  import { palettes } from '../../lib/palettes.svelte';
  import { downloadBlob, gridPNG } from '../../render/cellImage';
  import CommonTools from '../../ui/CommonTools.svelte';
  import FloatingPanel from '../../ui/FloatingPanel.svelte';
  import GridCanvas, { type Box } from '../../ui/GridCanvas.svelte';
  import PalettePicker from '../../ui/PalettePicker.svelte';
  import Shell from '../../ui/Shell.svelte';
  import type { SystemViewProps } from '../types';
  import { findKind, KINDS, type KindId } from './kinds';
  import { defaults, type ProgramsParams } from './params';
  import RuleView from './RuleView.svelte';

  let { params, setParams }: SystemViewProps<ProgramsParams> = $props();

  let rulesOpen = $state(false);
  let ruleText = $state('');
  let startText = $state('');
  let info = $state<string | null>(null);
  let canvasRef = $state<GridCanvas>();

  const kind = $derived(findKind(params.kind));
  const result = $derived(kind.run(params.rule, params.start, params.steps));
  const error = $derived(typeof result === 'string' ? result : '');
  const pic = $derived<Picture | null>(typeof result === 'string' ? null : result);
  const nColors = $derived(kind.colors(params.rule));
  const colors = $derived.by(() => {
    if (kind.id !== 'cont') return colorsFor(palettes.current, nColors);
    // Gray levels: a ramp between the first two palette colors.
    const [a, b] = colorsFor(palettes.current, 2).map(hexToRgb);
    return Array.from({ length: 254 }, (_, i) => rgbToHex(a.map((v, j) => v + ((b[j] - v) * i) / 253) as [number, number, number]));
  });

  $effect(() => {
    ruleText = params.rule;
    startText = params.start;
  });

  const STATE_COLORS = ['#e8590c', '#2463c7', '#8a3ffc', '#1f8a4c', '#d6336c'];
  const boxes = $derived.by((): Box[] => {
    if (!pic || pic.marks.length > 4000) return [];
    return pic.marks.map((m) => ({ x: m.x, y: m.y, w: 1, h: 1, color: STATE_COLORS[m.c % 5], width: 1.5 }));
  });

  function setKind(id: KindId) {
    setParams(defaults(id));
    info = null;
  }

  function randomRule() {
    const rnd = mulberry32(randomSeed());
    if (kind.id === 'mobile') {
      const color = Array.from({ length: 8 }, () => (rnd() < 0.5 ? 0 : 1));
      const right = Array.from({ length: 8 }, () => rnd() < 0.5);
      setParams({ ...params, rule: String(mobileCode({ color, right })) });
    } else if (kind.id === 'tm') {
      const [s, k] = params.rule.split(',').map(Number);
      const base = 2n * BigInt(s * k);
      let code = 0n;
      for (let i = 0; i < tmEntries(s, k); i++) code = code * base + BigInt(Math.floor(rnd() * Number(base)));
      setParams({ ...params, rule: `${s},${k},${code}` });
    } else if (kind.id === 'seq' || kind.id === 'subst') {
      const word = (min: number, max: number) =>
        Array.from({ length: min + Math.floor(rnd() * (max - min + 1)) }, () => (kind.id === 'seq' ? 'AB' : '01')[rnd() < 0.5 ? 0 : 1]).join('');
      const rule =
        kind.id === 'seq'
          ? Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => `${word(1, 3)}>${word(0, 4)}`).join(', ')
          : `0>${word(1, 3)}, 1>${word(1, 3)}`;
      setParams({ ...params, rule });
    } else if (kind.id === 'ctag') {
      const block = () => Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => (rnd() < 0.5 ? 0 : 1)).join('');
      setParams({ ...params, rule: Array.from({ length: 2 + Math.floor(rnd() * 2) }, block).join(', ') });
    } else if (kind.id === 'cont') {
      setParams({ ...params, rule: `${(1 + rnd() * 1.5).toFixed(2)},${(rnd() * 0.5).toFixed(2)}` });
    }
  }

  function setTMSize(s: number, k: number) {
    setParams({ ...params, rule: `${s},${k},0` });
    queueMicrotask(randomRule);
  }

  function onCellClick(x: number, y: number) {
    if (!pic) return;
    const v = pic.cells[y * pic.width + x];
    if (v === NONE) {
      info = null;
      return;
    }
    const parts = [`צעד ${kind.id === 'subst' ? '' : y}`.trim()];
    if (pic.rowInfo?.[y]) parts.push(pic.rowInfo[y]);
    const mark = pic.marks.find((m) => m.y === y);
    if (mark && kind.id === 'tm') parts.push(`הראש בעמודה ${mark.x}`);
    if (kind.id === 'cont') parts.push(`רמת אפור ${(v / 253).toFixed(3)}`);
    info = parts.join(' · ');
  }

  async function exportPNG() {
    if (!pic) return;
    const blob = await gridPNG(pic.cells, pic.width, pic.height, colors, palettes.current.grid, '#ffffff');
    if (blob) downloadBlob(blob, `${kind.id}.png`);
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyR') rulesOpen = !rulesOpen;
      else if (e.code === 'KeyN') randomRule();
      else if (e.code === 'KeyF') canvasRef?.fit();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const canRandom = $derived(['mobile', 'tm', 'seq', 'subst', 'ctag', 'cont'].includes(kind.id));
</script>

{#snippet quick()}
  <div class="quickbar">
    <select value={params.kind} onchange={(e) => setKind(e.currentTarget.value as KindId)} aria-label="סוג המערכת">
      {#each KINDS as k (k.id)}<option value={k.id}>{k.title}</option>{/each}
    </select>
    <button class="btn primary" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
    {#if canRandom}<button class="btn orange" onclick={randomRule}>אקראי</button>{/if}
  </div>
{/snippet}

{#snippet panel()}
  <section>
    <div class="kinds">
      {#each KINDS as k (k.id)}
        <button aria-pressed={params.kind === k.id} onclick={() => setKind(k.id)}>{k.title}</button>
      {/each}
    </div>
    <p class="intro">{kind.intro} {#if kind.pages}<span class="badge">עמ' {kind.pages}</span>{/if}</p>
    <button class="btn primary big" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
    {#if canRandom}<button class="btn orange" onclick={randomRule}>כלל אקראי</button>{/if}
  </section>

  <section>
    <h3>כלל והתחלה</h3>
    {#if kind.id === 'tm'}
      {@const [s, k] = params.rule.split(',').map(Number)}
      <div class="row">
        <span class="field-label">מצבים</span>
        <div class="segmented">
          {#each [1, 2, 3, 4] as n (n)}<button aria-pressed={s === n} onclick={() => setTMSize(n, k)}>{n}</button>{/each}
        </div>
        <span class="field-label">צבעים</span>
        <div class="segmented">
          {#each [2, 3] as n (n)}<button aria-pressed={k === n} onclick={() => setTMSize(s, n)}>{n}</button>{/each}
        </div>
      </div>
    {/if}
    <div class="field">
      <label for="rule">כלל ({kind.ruleHint})</label>
      <input id="rule" class="ltr mono" type="text" bind:value={ruleText} onchange={() => setParams({ ...params, rule: ruleText })} />
    </div>
    {#if kind.hasStart}
      <div class="field">
        <label for="start">{kind.startHint}</label>
        <input id="start" class="ltr mono" type="text" bind:value={startText} onchange={() => setParams({ ...params, start: startText })} />
      </div>
    {/if}
    {#if error}<p class="error">{error}</p>{/if}
    <div class="field">
      <label for="steps">צעדים: {params.steps}</label>
      <input id="steps" type="range" min="1" max={kind.maxSteps} value={params.steps}
        oninput={(e) => setParams({ ...params, steps: Number(e.currentTarget.value) })} />
    </div>
  </section>

  <section>
    <h3>דוגמאות</h3>
    <ul class="examples">
      {#each kind.examples as ex (ex.title)}
        <li>
          <button onclick={() => setParams({ kind: kind.id, rule: ex.rule, start: ex.start, steps: ex.steps })}>
            <span class="ex-title">{ex.title}</span>
            {#if ex.page}<span class="badge">עמ' {ex.page}</span>{/if}
            <span class="ex-text">{ex.text}</span>
          </button>
        </li>
      {/each}
    </ul>
  </section>

  <section>
    <h3>צבעים</h3>
    <PalettePicker k={Math.min(nColors, 8)} />
  </section>

  <section>
    <CommonTools title={`${kind.title}: ${params.rule}`} onExportPNG={exportPNG} />
  </section>
{/snippet}

{#snippet main()}
  {#if pic}
    <GridCanvas
      bind:this={canvasRef}
      cells={pic.cells}
      width={pic.width}
      height={pic.height}
      {colors}
      grid={palettes.current.grid}
      {boxes}
      {onCellClick}
    />
  {:else}
    <p class="error pad">{error}</p>
  {/if}
{/snippet}

{#snippet overlay()}
  {#if info}
    <div class="cell-info" role="status">
      <span>{info}</span>
      <button class="btn icon small" onclick={() => (info = null)} aria-label="סגירה">✕</button>
    </div>
  {/if}
{/snippet}

<Shell title={kind.title} subtitle={kind.pages ? `עמודים ${kind.pages} בספר` : ''} {main} {panel} {quick} {overlay} />

<FloatingPanel title="כללי העדכון" open={rulesOpen} onClose={() => (rulesOpen = false)} width={kind.id === 'tm' ? 460 : 560}>
  <div class="rules">
    <p class="intro">{kind.intro}</p>
    <RuleView kind={kind.id} rule={params.rule} {colors} grid={palettes.current.grid} onChange={(r) => setParams({ ...params, rule: r })} />
    <div class="row">
      <input class="ltr mono grow" type="text" bind:value={ruleText} onchange={() => setParams({ ...params, rule: ruleText })} aria-label="הכלל כטקסט" />
      {#if canRandom}<button class="btn small orange" onclick={randomRule}>אקראי</button>{/if}
    </div>
    {#if error}<p class="error">{error}</p>{/if}
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
  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .kinds button {
    border: 1.5px solid var(--border);
    background: var(--surface);
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 13px;
  }
  .kinds button[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-weight: 600;
  }
  .intro {
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
  }
  .big {
    min-height: 42px;
  }
  .mono {
    font-family: var(--font-mono);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .error {
    color: var(--accent-3);
    font-weight: 600;
    margin: 0;
  }
  .pad {
    padding: 20px;
  }
  .quickbar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .quickbar select {
    max-width: 46vw;
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
    font-size: 14px;
  }
</style>
