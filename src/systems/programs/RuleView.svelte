<script lang="ts">
  // The rules of each kind of simple program, drawn in the simulation colors.
  // Mobile automata and Turing machines can be edited by clicking; the other
  // kinds show their rules and are edited as text below.
  import { mobileCode, mobileFromCode, neighborhoodsLabel, tmCode, tmFromCode, parseRegProgram } from './ruleTools';
  import type { KindId } from './kinds';

  interface Props {
    kind: KindId;
    rule: string;
    colors: string[];
    grid: string | null;
    onChange: (rule: string) => void;
  }
  let { kind, rule, colors, grid, onChange }: Props = $props();

  const line = $derived(grid ?? 'rgba(0,0,0,0.35)');
  const STATE_COLORS = ['#e8590c', '#2463c7', '#8a3ffc', '#1f8a4c', '#d6336c'];

  const syms = (s: string) => [...s.replace(/\s/g, '')].map((c) => (/[A-Za-z]/.test(c) ? c.toUpperCase().charCodeAt(0) - 65 : Number(c)));

  /** Pairs "a>b" of a map-style rule text. */
  function pairs(text: string): [string, string][] {
    return text
      .split(/[,;\n]+/)
      .map((p) => p.split(/->|→|>/).map((x) => x.trim()))
      .filter((p) => p.length === 2 && p[0] !== '') as [string, string][];
  }

  // ---- mobile automata ----
  const mobile = $derived(kind === 'mobile' ? mobileFromCode(Number(rule) || 0) : null);
  function mobileSet(n: number, color?: number, right?: boolean) {
    const r = mobileFromCode(Number(rule) || 0);
    if (color !== undefined) r.color[n] = color;
    if (right !== undefined) r.right[n] = right;
    onChange(String(mobileCode(r)));
  }

  // ---- Turing machines ----
  const tmParts = $derived(rule.split(',').map((x) => x.trim()));
  const tm = $derived(kind === 'tm' && /^\d+$/.test(tmParts[2] ?? '') ? tmFromCode(BigInt(tmParts[2]), Number(tmParts[0]) || 2, Number(tmParts[1]) || 2) : null);
  function tmSet(i: number, change: Partial<{ state: number; color: number; right: boolean }>) {
    if (!tm) return;
    const table = tm.table.map((e, j) => (j === i ? { ...e, ...change } : e));
    onChange(`${tm.states},${tm.colors},${tmCode({ ...tm, table })}`);
  }

  const reg = $derived(kind === 'reg' ? parseRegProgram(rule) : null);
</script>

{#snippet cell(c: number, size = 22, extra = '')}
  <span class="c {extra}" style:background={colors[c] ?? '#ccc'} style:width="{size}px" style:height="{size}px" style:--line={line}></span>
{/snippet}

{#snippet seq(s: string, size = 20)}
  <span class="seq ltr">{#each syms(s) as c, i (i)}{@render cell(c, size)}{/each}{#if !syms(s).length}<span class="muted">(כלום)</span>{/if}</span>
{/snippet}

{#if kind === 'mobile' && mobile}
  <div class="icons ltr">
    {#each [7, 6, 5, 4, 3, 2, 1, 0] as n (n)}
      <div class="icon">
        <div class="top">
          {#each neighborhoodsLabel(n) as c, j (j)}
            {@render cell(c, 22, j === 1 ? 'active' : '')}
          {/each}
        </div>
        <button class="c out" style:background={colors[mobile.color[n]]} style:--line={line}
          onclick={() => mobileSet(n, 1 - mobile.color[n])} aria-label="צבע חדש לתא הפעיל"></button>
        <button class="dir" onclick={() => mobileSet(n, undefined, !mobile.right[n])} aria-label={mobile.right[n] ? 'זז ימינה' : 'זז שמאלה'}>
          {mobile.right[n] ? '→' : '←'}
        </button>
      </div>
    {/each}
  </div>
  <p class="hint">התא הפעיל מסומן במסגרת. למטה: הצבע החדש שלו, והכיוון שאליו הוא זז. לחיצה משנה.</p>
{:else if kind === 'tm' && tm}
  <table class="tm">
    <thead>
      <tr><th>מצב הראש</th><th>צבע מתחת</th><th></th><th>צבע חדש</th><th>מצב חדש</th><th>כיוון</th></tr>
    </thead>
    <tbody>
      {#each tm.table as e, i (i)}
        {@const s = Math.floor(i / tm.colors)}
        {@const c = i % tm.colors}
        <tr>
          <td><span class="state" style:background={STATE_COLORS[s % 5]}>{s + 1}</span></td>
          <td>{@render cell(c)}</td>
          <td>→</td>
          <td>
            <button class="c out" style:background={colors[e.color]} style:--line={line} onclick={() => tmSet(i, { color: (e.color + 1) % tm.colors })} aria-label="צבע חדש"></button>
          </td>
          <td>
            <button class="state" style:background={STATE_COLORS[e.state % 5]} onclick={() => tmSet(i, { state: (e.state + 1) % tm.states })} aria-label="מצב חדש">{e.state + 1}</button>
          </td>
          <td><button class="dir" onclick={() => tmSet(i, { right: !e.right })}>{e.right ? '→' : '←'}</button></td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="hint">הראש מסומן בתמונה במסגרת בצבע המצב שלו. לחיצה על תא בטבלה משנה אותו.</p>
{:else if kind === 'subst' || kind === 'seq'}
  <ol class="list">
    {#each pairs(rule) as [a, b], i (i)}
      <li>{@render seq(a)} <span class="arrow">→</span> {@render seq(b)}</li>
    {/each}
  </ol>
  {#if kind === 'seq'}<p class="hint">הסדר חשוב: בכל צעד משתמשים בהחלפה הראשונה ברשימה שאפשר לבצע.</p>{/if}
{:else if kind === 'subst2d'}
  {@const [n, rest] = [Number(rule.split(':')[0]) || 2, rule.split(':')[1] ?? '']}
  <div class="blocks">
    {#each pairs(rest) as [a, b], i (i)}
      <div class="block">
        {@render cell(syms(a)[0], 30)}
        <span class="arrow">→</span>
        <span class="grid ltr" style:grid-template-columns="repeat({n}, 1fr)">
          {#each syms(b) as c, j (j)}{@render cell(c, Math.round(30 / n * 1.4))}{/each}
        </span>
      </div>
    {/each}
  </div>
{:else if kind === 'tag'}
  {@const [n, rest] = [rule.split(':')[0], rule.split(':')[1] ?? '']}
  <p>בכל צעד מוחקים <b>{n}</b> איברים מההתחלה, ומוסיפים לסוף לפי האיבר הראשון שנמחק:</p>
  <ul class="list">
    {#each pairs(rest) as [a, b], i (i)}
      <li>ראשון {@render seq(a)} <span class="arrow">←</span> מוסיפים {@render seq(b)}</li>
    {/each}
  </ul>
{:else if kind === 'ctag'}
  <p>הגושים, לפי התור:</p>
  <ol class="list">
    {#each rule.split(/[,;\n]+/) as b, i (i)}
      <li>{@render seq(b.trim())}</li>
    {/each}
  </ol>
  <p class="hint">אם האיבר הראשון שחור, מוסיפים לסוף את הגוש התורן. בכל מקרה מוחקים את האיבר הראשון ועוברים לגוש הבא.</p>
{:else if kind === 'reg'}
  {#if typeof reg === 'string'}
    <p class="error">{reg}</p>
  {:else if reg}
    <ol class="list">
      {#each reg as ins, i (i)}
        <li>
          {#if ins.op === 'I'}
            <span class="op inc">I{ins.r + 1}</span> מוסיפים 1 לאוגר {ins.r + 1}
          {:else}
            <span class="op dec">D{ins.r + 1} {ins.j + 1}</span> אם אוגר {ins.r + 1} גדול מ־0: מפחיתים 1 וקופצים להוראה {ins.j + 1}
          {/if}
        </li>
      {/each}
    </ol>
    <p class="hint">בתמונה: משמאל, איזו הוראה מתבצעת בכל צעד. מימין, ערכי האוגרים כפסים.</p>
  {/if}
{:else if kind === 'cont'}
  {@const [a, b] = rule.split(',').map(Number)}
  <p class="formula ltr">new = frac({a} × average(left, self, right) + {b || 0})</p>
  <div class="ramp" style:background="linear-gradient(to left, {colors[colors.length - 1]}, {colors[0]})"></div>
  <p class="hint">מ־0 (משמאל) עד 1 (מימין). frac הוא החלק השברי: מה שאחרי הנקודה העשרונית.</p>
{/if}

<style>
  .icons {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
  }
  .icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .top,
  .seq {
    display: inline-flex;
    vertical-align: middle;
  }
  .c {
    display: inline-block;
    box-shadow: inset 0 0 0 1px var(--line);
    border: 0;
    padding: 0;
  }
  .c.active {
    outline: 3px solid var(--highlight);
    outline-offset: -3px;
  }
  .out {
    width: 22px;
    height: 22px;
    cursor: pointer;
  }
  .out:hover {
    outline: 2px solid var(--accent-2);
  }
  .dir {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 6px;
    font-weight: 800;
    padding: 0 6px;
    line-height: 1.4;
  }
  .tm {
    border-collapse: collapse;
    font-size: 13px;
  }
  .tm td,
  .tm th {
    padding: 3px 6px;
    text-align: center;
  }
  .state {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    color: #fff;
    font-weight: 800;
    border: 0;
  }
  .list {
    margin: 0;
    padding-inline-start: 22px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .arrow {
    font-weight: 800;
    margin: 0 6px;
    color: var(--text-muted);
  }
  .blocks {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
  }
  .block {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .grid {
    display: inline-grid;
  }
  .op {
    font-family: var(--font-mono);
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
  }
  .op.inc {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }
  .op.dec {
    background: var(--accent-2-soft);
    color: var(--accent-2);
  }
  .formula {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 15px;
  }
  .ramp {
    height: 18px;
    border-radius: 4px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  }
  .hint {
    font-size: 12.5px;
    color: var(--text-muted);
    margin: 8px 0 0;
  }
  .error {
    color: var(--accent-3);
  }
</style>
