<script lang="ts" module>
  export interface AntParams {
    rule: string;
    ants: number;
    size: number;
    speed: number;
  }
  export const ANT_SPEEDS = [1, 5, 20, 100, 500, 2000, 10000];
  export const antDefaults = (): AntParams => ({ rule: 'RL', ants: 1, size: 200, speed: 3 });
  export function antFromQuery(q: URLSearchParams): AntParams {
    const d = antDefaults();
    const n = (k: string, def: number, lo: number, hi: number) => (q.has(k) ? Math.min(hi, Math.max(lo, Math.round(Number(q.get(k)) || def))) : def);
    return {
      rule: /^[LRNUlrnu]{2,12}$/.test(q.get('rule') ?? '') ? q.get('rule')!.toUpperCase() : d.rule,
      ants: n('ants', d.ants, 1, 5),
      size: n('n', d.size, 50, 600),
      speed: n('speed', d.speed, 0, ANT_SPEEDS.length - 1),
    };
  }
  export function antToQuery(p: AntParams): Record<string, string> {
    const q: Record<string, string> = { rule: p.rule };
    if (p.ants !== 1) q.ants = String(p.ants);
    if (p.size !== 200) q.n = String(p.size);
    if (p.speed !== 3) q.speed = String(p.speed);
    return q;
  }
</script>

<script lang="ts">
  // 2D Turing machines: an "ant" walks on a grid, turning by the color under it.
  import { onMount, untrack } from 'svelte';
  import { AntWorld, parseTurns } from '../../engine/ant';
  import { colorsFor } from '../../engine/palette';
  import { palettes } from '../../lib/palettes.svelte';
  import { downloadBlob, gridPNG } from '../../render/cellImage';
  import CommonTools from '../../ui/CommonTools.svelte';
  import FloatingPanel from '../../ui/FloatingPanel.svelte';
  import GridCanvas, { type Box } from '../../ui/GridCanvas.svelte';
  import PalettePicker from '../../ui/PalettePicker.svelte';
  import Shell from '../../ui/Shell.svelte';
  import type { SystemViewProps } from '../types';

  let { params, setParams }: SystemViewProps<AntParams> = $props();

  let world = $state.raw<AntWorld | null>(null);
  let version = $state(0);
  let running = $state(false);
  let rulesOpen = $state(false);
  let ruleText = $state('');

  const turns = $derived(parseTurns(params.rule) ?? [1, 3]);
  const colors = $derived(colorsFor(palettes.current, turns.length));
  const TURN_NAMES = ['ישר', 'ימינה', 'אחורה', 'שמאלה'];
  const TURN_ICONS = ['↑', '↱', '↓', '↰'];

  function reset() {
    world = new AntWorld(params.size, params.size, turns, params.ants);
    untrack(() => version++);
  }
  $effect(() => {
    ruleText = params.rule;
    void [params.size, params.ants, turns];
    untrack(reset);
  });

  const cells = $derived.by(() => {
    void version;
    return world ? world.cells.slice() : new Uint8Array(1);
  });
  const stepCount = $derived.by(() => {
    void version;
    return world?.steps ?? 0;
  });
  const boxes = $derived.by((): Box[] => {
    void version;
    return world ? world.ants.map((a) => ({ x: a.x, y: a.y, w: 1, h: 1, color: '#e8590c', width: 3 })) : [];
  });

  function loop() {
    if (!running || !world) return;
    world.step(ANT_SPEEDS[params.speed]);
    version++;
    requestAnimationFrame(loop);
  }
  function setRunning(v: boolean) {
    running = v;
    if (v) requestAnimationFrame(loop);
  }
  function cycle(i: number) {
    const t = [...turns];
    t[i] = (t[i] + 1) % 4;
    setParams({ ...params, rule: t.map((x) => 'NRUL'[x]).join('') });
  }

  async function exportPNG() {
    if (!world) return;
    const b = await gridPNG(world.cells, world.W, world.H, colors, palettes.current.grid, '#ffffff');
    if (b) downloadBlob(b, `ant-${params.rule}.png`);
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey) return;
      if (e.code === 'Space') setRunning(!running);
      else if (e.code === 'KeyR') rulesOpen = !rulesOpen;
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      running = false;
      window.removeEventListener('keydown', onKey);
    };
  });

  const EXAMPLES = [
    { rule: 'RL', text: 'הנמלה של לנגטון: אחרי כ־10,000 צעדים של כאוס היא מתחילה לבנות "כביש" חזרתי לאין סוף.' },
    { rule: 'RLR', text: 'גדלה בצורה סימטרית וכאוטית.' },
    { rule: 'LLRR', text: 'בונה צורה סימטרית שגדלה.' },
    { rule: 'LRRRRRLLR', text: 'ממלאת ריבוע שהולך וגדל.' },
    { rule: 'RRLLLRLLLRRR', text: 'משולש שגדל.' },
  ];
</script>

{#snippet run()}
  <div class="row">
    <button class="btn primary" onclick={() => setRunning(!running)}>{running ? '❚❚ עצירה' : '▶ הפעלה'}</button>
    <button class="btn" onclick={() => { world?.step(1); version++; }}>צעד</button>
    <button class="btn" onclick={reset}>איפוס</button>
  </div>
{/snippet}

{#snippet quick()}
  <div class="row">
    {@render run()}
    <button class="btn blue" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
  </div>
{/snippet}

{#snippet panel()}
  <section>
    <p class="intro">
      מכונת טיורינג דו־ממדית: ה"ראש" הוא נמלה שהולכת על רשת. בכל צעד היא פונה לפי צבע התא שמתחתיה, מחליפה אותו לצבע
      הבא בתור, וזזה תא אחד קדימה.
    </p>
    {@render run()}
    <span class="muted">צעדים: {stepCount.toLocaleString('he-IL')}</span>
    <label class="field">
      <span>מהירות: {ANT_SPEEDS[params.speed]} צעדים לפריים</span>
      <input type="range" min="0" max={ANT_SPEEDS.length - 1} value={params.speed} oninput={(e) => setParams({ ...params, speed: Number(e.currentTarget.value) })} />
    </label>
    <button class="btn primary big" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
  </section>
  <section>
    <h3>הגדרות</h3>
    <label class="field"><span>מספר נמלים: {params.ants}</span>
      <input type="range" min="1" max="5" value={params.ants} onchange={(e) => setParams({ ...params, ants: Number(e.currentTarget.value) })} /></label>
    <label class="field"><span>גודל הרשת: {params.size}</span>
      <input type="range" min="50" max="600" step="10" value={params.size} onchange={(e) => setParams({ ...params, size: Number(e.currentTarget.value) })} /></label>
  </section>
  <section>
    <h3>דוגמאות</h3>
    {#each EXAMPLES as ex (ex.rule)}
      <button class="ex" onclick={() => setParams({ ...params, rule: ex.rule })}><b class="ltr">{ex.rule}</b> {ex.text}</button>
    {/each}
  </section>
  <section>
    <h3>צבעים</h3>
    <PalettePicker k={turns.length} />
  </section>
  <section>
    <CommonTools title={`נמלה ${params.rule}`} onExportPNG={exportPNG} />
  </section>
{/snippet}

{#snippet main()}
  {#if world}
    <GridCanvas {cells} width={world.W} height={world.H} {colors} grid={palettes.current.grid} {boxes} />
  {/if}
{/snippet}

<Shell title={`נמלה ${params.rule}`} subtitle="מכונת טיורינג דו־ממדית" {main} {panel} {quick} />

<FloatingPanel title="כללי העדכון" open={rulesOpen} onClose={() => (rulesOpen = false)} width={420}>
  <div class="rules">
    <p>לכל צבע: לאן הנמלה פונה כשהיא עומדת עליו. אחר כך התא מקבל את הצבע הבא בשורה (והאחרון חוזר לראשון). לחיצה משנה כיוון.</p>
    <div class="turns">
      {#each turns as t, i (i)}
        <button class="turn" onclick={() => cycle(i)}>
          <span class="sw" style:background={colors[i]}></span>
          <span class="icon">{TURN_ICONS[t]}</span>
          <span>{TURN_NAMES[t]}</span>
          <span class="muted">← <span class="sw small" style:background={colors[(i + 1) % turns.length]}></span></span>
        </button>
      {/each}
    </div>
    <div class="row">
      <input class="ltr" type="text" bind:value={ruleText} aria-label="הכלל כמחרוזת" />
      <button class="btn small" onclick={() => parseTurns(ruleText) && setParams({ ...params, rule: ruleText.toUpperCase() })}>החלה</button>
      <button class="btn small" onclick={() => setParams({ ...params, rule: params.rule + 'L' })} disabled={turns.length >= 12}>+ צבע</button>
      <button class="btn small" onclick={() => setParams({ ...params, rule: params.rule.slice(0, -1) })} disabled={turns.length <= 2}>− צבע</button>
    </div>
    <p class="hint">L = שמאלה, R = ימינה, N = ישר, U = אחורה.</p>
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
  .big {
    min-height: 42px;
  }
  .ex {
    text-align: start;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    padding: 6px 10px;
    font-size: 13px;
  }
  .ex:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .rules {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .rules p {
    margin: 0;
  }
  .turns {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .turn {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    padding: 6px 10px;
    font-size: 15px;
  }
  .sw {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
    display: inline-block;
  }
  .sw.small {
    width: 14px;
    height: 14px;
    vertical-align: -2px;
  }
  .icon {
    font-size: 22px;
    font-weight: 800;
    width: 24px;
    text-align: center;
  }
  .hint {
    font-size: 12.5px;
    color: var(--text-muted);
  }
</style>
