<script lang="ts" module>
  export interface NetParams {
    kind: 'multiway' | 'causal';
    rule: string;
    start: string;
    steps: number;
  }
  export const netDefaults = (kind: 'multiway' | 'causal' = 'multiway'): NetParams =>
    kind === 'multiway'
      ? { kind, rule: 'A>AB, B>A', start: 'A', steps: 6 }
      : { kind, rule: 'BA>AB, A>ABA', start: 'AB', steps: 120 };
  export function netFromQuery(q: URLSearchParams): NetParams {
    const kind = q.get('kind') === 'causal' ? 'causal' : 'multiway';
    const d = netDefaults(kind);
    const t = Number(q.get('t'));
    return { kind, rule: q.get('rule') ?? d.rule, start: q.get('start') ?? d.start, steps: t >= 1 && t <= 500 ? Math.round(t) : d.steps };
  }
  export const netToQuery = (p: NetParams): Record<string, string> => ({ kind: p.kind, rule: p.rule, start: p.start, t: String(p.steps) });
</script>

<script lang="ts">
  // Multiway systems and causal networks, drawn as graphs (SVG).
  import { causalNetwork, multiway } from '../../engine/graphs';
  import { colorsFor } from '../../engine/palette';
  import type { SeqRule } from '../../engine/programs';
  import { palettes } from '../../lib/palettes.svelte';
  import CommonTools from '../../ui/CommonTools.svelte';
  import FloatingPanel from '../../ui/FloatingPanel.svelte';
  import PalettePicker from '../../ui/PalettePicker.svelte';
  import Shell from '../../ui/Shell.svelte';
  import type { SystemViewProps } from '../types';

  let { params, setParams }: SystemViewProps<NetParams> = $props();
  let rulesOpen = $state(false);
  let ruleText = $state('');
  let startText = $state('');
  let zoom = $state(1);
  $effect(() => {
    ruleText = params.rule;
    startText = params.start;
  });

  const syms = (s: string) => [...s.trim().toUpperCase()].filter((c) => /[A-Z]/.test(c)).map((c) => c.charCodeAt(0) - 65);
  const rules = $derived<SeqRule[]>(
    params.rule
      .split(/[,;\n]+/)
      .map((p) => p.split(/->|→|>/))
      .filter((p) => p.length === 2)
      .map(([a, b]) => ({ from: syms(a), to: syms(b) }))
      .filter((r) => r.from.length > 0),
  );
  const colors = $derived(colorsFor(palettes.current, 3));
  const RULE_COLORS = ['#2463c7', '#e8590c', '#1f8a4c', '#8a3ffc', '#d6336c'];

  const mw = $derived(params.kind === 'multiway' ? multiway(rules, syms(params.start), Math.min(params.steps, 12)) : null);
  const cn = $derived(params.kind === 'causal' ? causalNetwork(rules, syms(params.start), params.steps) : null);

  // Layout
  const CELL = 9;
  const mwLayout = $derived.by(() => {
    if (!mw) return null;
    const rowH = 54;
    const maxLen = Math.max(...mw.layers.flat().map((s) => s.length));
    const nodeW = maxLen * CELL + 8;
    const widest = Math.max(...mw.layers.map((l) => l.length));
    const W = Math.max(300, widest * (nodeW + 10));
    const pos = mw.layers.map((l, t) => l.map((s, i) => ({ x: ((i + 0.5) / l.length) * W, y: 20 + t * rowH, s })));
    return { W, H: 30 + mw.layers.length * rowH, pos, nodeW };
  });

  const cnLayout = $derived.by(() => {
    if (!cn) return null;
    const layers: number[][] = [];
    cn.depth.forEach((d, i) => (layers[d] ??= []).push(i));
    const rowH = 28;
    const widest = Math.max(1, ...layers.map((l) => l.length));
    const W = Math.max(300, widest * 26);
    const xy: { x: number; y: number }[] = [];
    layers.forEach((l, d) => l.forEach((id, i) => (xy[id] = { x: ((i + 0.5) / l.length) * W, y: 16 + d * rowH })));
    return { W, H: 30 + layers.length * rowH, xy };
  });
</script>

{#snippet strip(s: string, x: number, y: number)}
  <g transform="translate({x - (s.length * CELL) / 2}, {y - CELL / 2})">
    {#each [...s] as c, i (i)}
      <rect x={i * CELL} y="0" width={CELL} height={CELL} fill={colors[(c.charCodeAt(0) - 65) % 3]} stroke="rgba(0,0,0,0.35)" stroke-width="0.6" />
    {/each}
  </g>
{/snippet}

{#snippet panel()}
  <section>
    <div class="segmented">
      <button aria-pressed={params.kind === 'multiway'} onclick={() => setParams(netDefaults('multiway'))}>מערכת רב־מסלולית</button>
      <button aria-pressed={params.kind === 'causal'} onclick={() => setParams(netDefaults('causal'))}>רשת סיבתית</button>
    </div>
    <p class="intro">
      {#if params.kind === 'multiway'}
        כמו מערכת החלפה סדרתית, אבל בכל צעד מבצעים <b>כל</b> החלפה אפשרית, בכל מקום. כל מחרוזת מתפצלת לכמה, וכך נוצר גרף
        של כל ההיסטוריות האפשריות. מחרוזות שכבר הופיעו לא מצוירות שוב.
      {:else}
        מריצים מערכת החלפה סדרתית. כל החלפה היא "אירוע", ומחברים חץ מאירוע לאירוע מאוחר יותר אם השני השתמש באיברים שהראשון
        יצר. הרשת שמתקבלת מראה מה גרם למה, בלי תלות בסדר שבו האירועים בוצעו.
      {/if}
    </p>
    <button class="btn primary big" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
  </section>
  <section>
    <label class="field"><span>החלפות (A בהיר, B כהה)</span>
      <input class="ltr" type="text" bind:value={ruleText} onchange={() => setParams({ ...params, rule: ruleText })} /></label>
    <label class="field"><span>מחרוזת התחלה</span>
      <input class="ltr" type="text" bind:value={startText} onchange={() => setParams({ ...params, start: startText })} /></label>
    <label class="field"><span>צעדים: {params.steps}</span>
      <input type="range" min="1" max={params.kind === 'multiway' ? 12 : 500} value={params.steps} oninput={(e) => setParams({ ...params, steps: Number(e.currentTarget.value) })} /></label>
    <label class="field"><span>זום</span><input type="range" min="0.3" max="3" step="0.05" bind:value={zoom} /></label>
    {#if mw?.truncated}<p class="hint">הגרף גדול מדי, אז חלק ממנו לא מוצג.</p>{/if}
  </section>
  <section>
    <h3>צבעים</h3>
    <PalettePicker k={2} />
  </section>
  <section><CommonTools title={params.kind === 'multiway' ? 'מערכת רב־מסלולית' : 'רשת סיבתית'} /></section>
{/snippet}

{#snippet quick()}
  <div class="row">
    <button class="btn primary" onclick={() => (rulesOpen = !rulesOpen)}>כללי העדכון</button>
    <input type="range" min="0.3" max="3" step="0.05" bind:value={zoom} aria-label="זום" />
  </div>
{/snippet}

{#snippet main()}
  <div class="scroll">
    {#if mwLayout && mw}
      <svg width={mwLayout.W * zoom} height={mwLayout.H * zoom} viewBox="0 0 {mwLayout.W} {mwLayout.H}" class="ltr">
        {#each mw.edges as e, i (i)}
          {@const a = mwLayout.pos[e.from[0]][e.from[1]]}
          {@const b = mwLayout.pos[e.to[0]][e.to[1]]}
          <line x1={a.x} y1={a.y + 6} x2={b.x} y2={b.y - 6} class="edge" />
        {/each}
        {#each mwLayout.pos as layer, t (t)}
          {#each layer as n, i (i)}{@render strip(n.s, n.x, n.y)}{/each}
        {/each}
      </svg>
    {:else if cnLayout && cn}
      <svg width={cnLayout.W * zoom} height={cnLayout.H * zoom} viewBox="0 0 {cnLayout.W} {cnLayout.H}" class="ltr">
        {#each cn.edges as [a, b], i (i)}
          <line x1={cnLayout.xy[a].x} y1={cnLayout.xy[a].y} x2={cnLayout.xy[b].x} y2={cnLayout.xy[b].y} class="edge" />
        {/each}
        {#each cnLayout.xy as p, i (i)}
          <circle cx={p.x} cy={p.y} r="5" fill={RULE_COLORS[cn.rule[i] % 5]} stroke="#fff" stroke-width="1.5" />
        {/each}
      </svg>
    {/if}
  </div>
{/snippet}

<Shell title={params.kind === 'multiway' ? 'מערכת רב־מסלולית' : 'רשת סיבתית'} subtitle="רשתות" {main} {panel} {quick} />

<FloatingPanel title="כללי העדכון" open={rulesOpen} onClose={() => (rulesOpen = false)} width={420}>
  <ol class="rules">
    {#each rules as r, i (i)}
      <li>
        {#if params.kind === 'causal'}<span class="dot" style:background={RULE_COLORS[i % 5]}></span>{/if}
        <span class="ltr seq">{#each r.from as c, j (j)}<span class="c" style:background={colors[c % 3]}></span>{/each}</span>
        →
        <span class="ltr seq">{#each r.to as c, j (j)}<span class="c" style:background={colors[c % 3]}></span>{/each}{#if !r.to.length}<span class="muted">(כלום)</span>{/if}</span>
      </li>
    {/each}
  </ol>
  {#if params.kind === 'causal'}<p class="hint">כל נקודה ברשת צבועה לפי ההחלפה שבוצעה בה.</p>{/if}
  <input class="ltr" type="text" bind:value={ruleText} onchange={() => setParams({ ...params, rule: ruleText })} aria-label="ההחלפות כטקסט" style="width:100%" />
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
  .scroll {
    position: absolute;
    inset: 0;
    overflow: auto;
    padding: 16px;
    direction: ltr;
  }
  svg {
    display: block;
    margin: 0 auto;
  }
  .edge {
    stroke: var(--text-muted);
    stroke-width: 1;
    opacity: 0.6;
  }
  .rules {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-inline-start: 20px;
  }
  .seq {
    display: inline-flex;
    vertical-align: middle;
  }
  .c {
    width: 18px;
    height: 18px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
  }
  .dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-inline-end: 6px;
  }
  .hint {
    font-size: 12.5px;
    color: var(--text-muted);
  }
</style>
