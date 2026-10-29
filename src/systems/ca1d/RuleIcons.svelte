<script lang="ts">
  // The rule as icons, as in the book: the neighborhood on top, the new color
  // of the middle cell below. Clicking the bottom cell cycles its color.
  // Always left-to-right (like the book), also inside the RTL interface.
  import { neighborhoodCells, neighborhoodSize, type Rule1D } from '../../engine/ca1d';
  import { luminance } from '../../engine/palette';

  interface Props {
    rule: Rule1D;
    colors: string[];
    grid: string | null;
    large?: boolean;
    editable?: boolean;
    onChange?: (table: Uint8Array) => void;
    /** Table index to emphasize (e.g. the one that produced a clicked cell). */
    active?: number | null;
    /** Locked entries (kept by random changes); shown with a lock when onToggleLock is given. */
    locks?: ReadonlySet<number>;
    onToggleLock?: (i: number) => void;
  }

  let { rule, colors, grid, large = false, editable = true, onChange, active = null, locks, onToggleLock }: Props = $props();

  const n = $derived(neighborhoodSize(rule.r));
  const count = $derived(rule.table.length);
  // Cell size shrinks as the table grows, so everything stays visible.
  const cell = $derived.by(() => {
    const base = large ? 26 : 8;
    const fit = count * n > 160 ? 0.45 : count * n > 60 ? 0.7 : 1;
    return Math.max(large ? 9 : 4, Math.round(base * fit));
  });
  const order = $derived(Array.from({ length: count }, (_, i) => count - 1 - i));
  const line = $derived(grid ?? 'rgba(0,0,0,0.35)');

  function cycle(i: number) {
    if (!editable || !onChange) return;
    const t = rule.table.slice();
    t[i] = (t[i] + 1) % rule.k;
    onChange(t);
  }

  function textOn(c: string) {
    return luminance(c) > 0.4 ? '#1b2330' : '#ffffff';
  }
</script>

<div class="icons ltr" class:large style:--cell="{cell}px" style:--line={line}>
  {#each order as i (i)}
    <div class="icon" class:active={active === i} class:locked={locks?.has(i)}>
      {#if rule.totalistic}
        <div class="sum" title="סכום הצבעים בשכנות">{i}</div>
      {:else}
        <div class="top">
          {#each neighborhoodCells(i, rule.k, rule.r) as c, j (j)}
            <span class="c" style:background={colors[c]}></span>
          {/each}
        </div>
      {/if}
      <button
        class="c out"
        style:background={colors[rule.table[i]]}
        style:color={textOn(colors[rule.table[i]])}
        disabled={!editable}
        onclick={() => cycle(i)}
        aria-label={`${rule.totalistic ? `סכום ${i}` : neighborhoodCells(i, rule.k, rule.r).join('')} נותן צבע ${rule.table[i]}${editable ? '. לחיצה משנה' : ''}`}
      >
        {#if large && rule.k > 2}{rule.table[i]}{/if}
      </button>
      {#if onToggleLock}
        <button
          class="lock"
          aria-pressed={locks?.has(i) ?? false}
          onclick={() => onToggleLock(i)}
          title={locks?.has(i) ? 'נעול: לא משתנה בהגרלה' : 'פתוח: משתנה בהגרלה'}
          aria-label={locks?.has(i) ? 'שחרור הנעילה' : 'נעילה'}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            {#if locks?.has(i)}
              <path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" stroke-width="1.8" />
            {:else}
              <path d="M4.5 7V5a3.5 3.5 0 0 1 6.6-1.6" fill="none" stroke="currentColor" stroke-width="1.8" />
            {/if}
            <rect x="2.5" y="7" width="11" height="8" rx="1.5" fill="currentColor" />
          </svg>
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .icons {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--cell) * 0.45) calc(var(--cell) * 0.35);
    justify-content: center;
  }
  .icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3px;
    border-radius: 6px;
  }
  .icon.locked {
    background: var(--accent-4-soft);
  }
  .lock {
    margin-top: 3px;
    border: 0;
    background: transparent;
    padding: 2px;
    color: var(--border);
    line-height: 0;
    border-radius: 4px;
  }
  .lock:hover {
    color: var(--text-muted);
  }
  .lock[aria-pressed='true'] {
    color: var(--accent-4);
  }
  .icon.active {
    background: var(--accent-3-soft);
    outline: 2px solid var(--highlight);
  }
  .top {
    display: flex;
  }
  .c {
    width: var(--cell);
    height: var(--cell);
    box-shadow: inset 0 0 0 1px var(--line);
    display: block;
  }
  .top .c + .c {
    margin-inline-start: -1px;
  }
  .out {
    border: 0;
    padding: 0;
    margin-top: calc(var(--cell) * 0.25);
    font-size: calc(var(--cell) * 0.55);
    font-weight: 700;
    line-height: var(--cell);
  }
  .out:not(:disabled):hover {
    outline: 2px solid var(--accent-2);
    outline-offset: 1px;
  }
  .out:disabled {
    cursor: default;
  }
  .sum {
    min-width: calc(var(--cell) * 1.4);
    height: var(--cell);
    padding: 0 4px;
    border-radius: 4px;
    background: var(--surface-3);
    font-size: calc(var(--cell) * 0.6);
    font-weight: 700;
    line-height: var(--cell);
    text-align: center;
  }
</style>
