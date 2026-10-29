<script lang="ts" module>
  export type NumKind = 'successive' | 'times' | 'plus' | 'threehalves' | 'collatz5' | 'reverse' | 'sieve' | 'seq' | 'pi' | 'sqrt';
  export interface NumbersParams {
    kind: NumKind;
    base: number;
    count: number;
    /** Multiplier / constant / starting number / square root argument / sequence id. */
    arg: string;
  }
  export const NUM_KINDS: { id: NumKind; title: string; page: string; text: string; arg?: string; argDefault: string; count: number }[] = [
    { id: 'successive', title: 'מספרים עוקבים', page: '117', text: 'כל שורה היא המספר הבא, כתוב בבסיס שבחרתם. בבסיס 2 מתקבלת תבנית מקוננת.', argDefault: '', count: 256 },
    { id: 'plus', title: 'הוספה של קבוע', page: '118', text: 'מתחילים ב־1 ומוסיפים בכל צעד את אותו מספר.', arg: 'הקבוע', argDefault: '7', count: 256 },
    { id: 'times', title: 'כפל חוזר', page: '119–120', text: 'מתחילים ב־1 וכופלים שוב ושוב. כפל ב־2 בבסיס 2 רק מזיז את הספרות, אבל כפל ב־3 נותן תבנית שנראית אקראית.', arg: 'הכופל', argDefault: '3', count: 300 },
    { id: 'threehalves', title: 'חזקות של 3/2', page: '121', text: 'החזקות העוקבות של 3/2 בבסיס 2, מיושרות לפי הנקודה הבינארית.', argDefault: '', count: 200 },
    { id: 'collatz5', title: 'זוגי: כפול 5/2, אי־זוגי: (n+1)/2', page: '123–124', text: 'כלל פשוט על מספרים שלמים: אם המספר זוגי כופלים ב־5/2, ואחרת מוסיפים 1 ומחלקים ב־2.', arg: 'מספר התחלה', argDefault: '6', count: 300 },
    { id: 'reverse', title: 'הפוך וחבר', page: '125–127', text: 'כותבים את המספר בבסיס 2 בסדר הפוך, ומחברים את התוצאה למספר המקורי.', arg: 'מספר התחלה', argDefault: '16', count: 300 },
    { id: 'sieve', title: 'הנפה של ראשוניים', page: '132', text: 'מתחילים מכל המספרים, ובכל שורה מוחקים את הכפולות של הראשוני הבא. מה שנשאר בסוף הם הראשוניים.', argDefault: '', count: 100 },
    { id: 'seq', title: 'סדרות רקורסיביות ועוד', page: '128–135', text: 'כל עמודה היא n, והגובה הוא ערך הסדרה. סדרות שמוגדרות בכלל פשוט על האיברים הקודמים.', arg: 'סדרה', argDefault: 'hofstadter', count: 400 },
    { id: 'pi', title: 'הספרות של π', page: '136–137', text: 'הספרות של π, מסודרות בשורות. אין בהן שום סדר שנראה לעין.', argDefault: '', count: 4000 },
    { id: 'sqrt', title: 'שורש ריבועי', page: '140', text: 'הספרות של שורש ריבועי של מספר שאינו ריבוע. גם הן נראות אקראיות.', arg: 'המספר', argDefault: '2', count: 4000 },
  ];
  export const numDefaults = (kind: NumKind = 'successive'): NumbersParams => {
    const k = NUM_KINDS.find((x) => x.id === kind)!;
    return { kind, base: 2, count: k.count, arg: k.argDefault };
  };
  export function numFromQuery(q: URLSearchParams): NumbersParams {
    const kind = (NUM_KINDS.find((k) => k.id === q.get('kind'))?.id ?? 'successive') as NumKind;
    const d = numDefaults(kind);
    const base = Number(q.get('base'));
    const count = Number(q.get('count'));
    return {
      kind,
      base: base >= 2 && base <= 16 ? Math.round(base) : 2,
      count: count >= 2 && count <= 20000 ? Math.round(count) : d.count,
      arg: q.get('arg') ?? d.arg,
    };
  }
  export function numToQuery(p: NumbersParams): Record<string, string> {
    const q: Record<string, string> = { kind: p.kind, base: String(p.base), count: String(p.count) };
    if (p.arg) q.arg = p.arg;
    return q;
  }
</script>

<script lang="ts">
  import {
    iterate,
    piDigits,
    plotSequence,
    powersOfThreeHalves,
    reverseAdd,
    SEQUENCES,
    sieve,
    sqrtDigits,
    successive,
    wrapDigits,
  } from '../../engine/numbers';
  import { colorsFor } from '../../engine/palette';
  import { NONE, type Picture } from '../../engine/programs';
  import { palettes } from '../../lib/palettes.svelte';
  import { downloadBlob, gridPNG } from '../../render/cellImage';
  import CommonTools from '../../ui/CommonTools.svelte';
  import GridCanvas from '../../ui/GridCanvas.svelte';
  import PalettePicker from '../../ui/PalettePicker.svelte';
  import Shell from '../../ui/Shell.svelte';
  import type { SystemViewProps } from '../types';

  let { params, setParams }: SystemViewProps<NumbersParams> = $props();
  let info = $state<string | null>(null);

  const kind = $derived(NUM_KINDS.find((k) => k.id === params.kind)!);
  const usesBase = $derived(!['threehalves', 'sieve', 'seq'].includes(params.kind));
  const big = (s: string, d: bigint) => {
    try {
      return /^\d+$/.test(s) ? BigInt(s) : d;
    } catch {
      return d;
    }
  };

  const pic = $derived.by((): Picture => {
    const { base, count, arg } = params;
    switch (params.kind) {
      case 'successive':
        return successive(base, count);
      case 'plus': {
        const c = big(arg, 7n);
        return iterate(base, count, (n) => n + c);
      }
      case 'times': {
        const m = big(arg, 3n);
        return iterate(base, Math.min(count, 2000), (n) => n * m);
      }
      case 'threehalves':
        return powersOfThreeHalves(Math.min(count, 1000));
      case 'collatz5':
        return iterate(base, Math.min(count, 3000), (n) => (n % 2n === 0n ? (5n * n) / 2n : (n + 1n) / 2n), big(arg, 6n));
      case 'reverse':
        return reverseAdd(base, Math.min(count, 2000), big(arg, 16n));
      case 'sieve':
        return sieve(Math.min(count, 2000));
      case 'seq':
        return plotSequence((SEQUENCES[arg] ?? SEQUENCES.hofstadter).f(Math.min(count, 3000)));
      case 'pi':
        return wrapDigits(piDigits(base, Math.min(count, 20000)), base === 2 ? 128 : 80);
      case 'sqrt':
        return wrapDigits(sqrtDigits(Number(arg) || 2, base, Math.min(count, 20000)), base === 2 ? 128 : 80);
    }
  });

  const nColors = $derived(params.kind === 'sieve' || params.kind === 'seq' || params.kind === 'threehalves' ? 2 : params.base);
  const colors = $derived(colorsFor(palettes.current, nColors));

  function onCellClick(x: number, y: number) {
    const v = pic.cells[y * pic.width + x];
    if (v === NONE) return (info = null);
    if (params.kind === 'sieve') info = `המספר ${x + 1}: ${v ? 'עדיין לא נמחק' : 'נמחק'}`;
    else if (params.kind === 'seq') info = `n = ${x + 1}`;
    else if (params.kind === 'pi' || params.kind === 'sqrt') info = `ספרה מספר ${y * pic.width + x}: ${v.toString(params.base)}`;
    else info = `שורה ${y + 1}, ספרה ${v.toString(params.base)}`;
  }

  async function exportPNG() {
    const b = await gridPNG(pic.cells, pic.width, pic.height, colors, palettes.current.grid, '#ffffff');
    if (b) downloadBlob(b, `${params.kind}.png`);
  }
</script>

{#snippet quick()}
  <div class="row">
    <select value={params.kind} onchange={(e) => setParams(numDefaults(e.currentTarget.value as NumKind))} aria-label="סוג">
      {#each NUM_KINDS as k (k.id)}<option value={k.id}>{k.title}</option>{/each}
    </select>
  </div>
{/snippet}

{#snippet panel()}
  <section>
    <div class="kinds">
      {#each NUM_KINDS as k (k.id)}
        <button aria-pressed={params.kind === k.id} onclick={() => setParams(numDefaults(k.id))}>{k.title}</button>
      {/each}
    </div>
    <div class="rulebox">
      <strong>הכלל</strong>
      <p>{kind.text} <span class="badge">עמ' {kind.page}</span></p>
    </div>
  </section>
  <section>
    {#if usesBase}
      <div class="field">
        <span class="field-label">בסיס</span>
        <div class="segmented">
          {#each [2, 3, 4, 5, 10] as b (b)}<button aria-pressed={params.base === b} onclick={() => setParams({ ...params, base: b })}>{b}</button>{/each}
        </div>
      </div>
    {/if}
    {#if kind.arg && params.kind !== 'seq'}
      <label class="field"><span>{kind.arg}</span>
        <input class="ltr" type="text" inputmode="numeric" value={params.arg} onchange={(e) => setParams({ ...params, arg: e.currentTarget.value })} />
      </label>
    {:else if params.kind === 'seq'}
      <select value={params.arg} onchange={(e) => setParams({ ...params, arg: e.currentTarget.value })}>
        {#each Object.entries(SEQUENCES) as [id, s] (id)}<option value={id}>{s.name}</option>{/each}
      </select>
    {/if}
    <label class="field"><span>כמות: {params.count}</span>
      <input type="range" min="10" max={params.kind === 'pi' || params.kind === 'sqrt' ? 20000 : 2000} step="10" value={params.count}
        onchange={(e) => setParams({ ...params, count: Number(e.currentTarget.value) })} /></label>
  </section>
  <section>
    <h3>צבעים</h3>
    <PalettePicker k={Math.min(nColors, 10)} />
  </section>
  <section>
    <CommonTools title={kind.title} onExportPNG={exportPNG} />
  </section>
{/snippet}

{#snippet main()}
  <GridCanvas cells={pic.cells} width={pic.width} height={pic.height} {colors} grid={palettes.current.grid} {onCellClick} />
{/snippet}

{#snippet overlay()}
  {#if info}
    <div class="cell-info" role="status">
      <span>{info}</span>
      <button class="btn icon small" onclick={() => (info = null)} aria-label="סגירה">✕</button>
    </div>
  {/if}
{/snippet}

<Shell title={kind.title} subtitle={`מערכות מבוססות מספרים · עמ' ${kind.page}`} {main} {panel} {quick} {overlay} />

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
  .rulebox {
    background: var(--accent-2-soft);
    border-radius: var(--radius-sm);
    padding: 10px;
  }
  .rulebox p {
    margin: 4px 0 0;
    font-size: 14px;
    line-height: 1.55;
  }
  .cell-info {
    position: absolute;
    bottom: 12px;
    right: 12px;
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
</style>
