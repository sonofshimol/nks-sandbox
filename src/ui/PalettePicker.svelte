<script lang="ts">
  // Choose a palette, edit the color of each state and of the grid lines,
  // and save your own palettes (kept in this browser).
  import { colorsFor } from '../engine/palette';
  import { palettes } from '../lib/palettes.svelte';

  interface Props {
    /** Number of states in the current system. */
    k: number;
  }
  let { k }: Props = $props();

  let editing = $state(false);
  let newName = $state('');

  const current = $derived(colorsFor(palettes.current, k));

  function setState(i: number, color: string) {
    const p = palettes.current;
    if (p.ramp && (i === 0 || i === k - 1)) {
      palettes.update({ colors: i === 0 ? [color, p.colors[1]] : [p.colors[0], color] });
    } else {
      const colors = colorsFor(p, Math.max(k, p.colors.length));
      colors[i] = color;
      palettes.update({ colors, ramp: false });
    }
  }

  function saveAs() {
    const name = newName.trim() || `ערכה ${palettes.saved.length + 1}`;
    palettes.saveAs(name);
    newName = '';
  }
</script>

<div class="chips" role="radiogroup" aria-label="ערכות צבעים">
  {#each palettes.all as p (p.id)}
    <button
      class="chip"
      role="radio"
      aria-checked={palettes.current.id === p.id}
      onclick={() => palettes.select(p.id)}
      title={p.name}
    >
      <span class="sw" style:background={p.grid ?? '#ffffff'}>
        {#each colorsFor(p, Math.min(Math.max(k, 2), 4)) as c, i (i)}
          <i style:background={c}></i>
        {/each}
      </span>
      <span>{p.name}</span>
    </button>
  {/each}
  {#if palettes.current.id === 'custom'}
    <button class="chip" role="radio" aria-checked="true">
      <span class="sw" style:background={palettes.current.grid ?? '#ffffff'}>
        {#each current.slice(0, 4) as c, i (i)}<i style:background={c}></i>{/each}
      </span>
      <span>מותאמת</span>
    </button>
  {/if}
</div>

<button class="btn small" onclick={() => (editing = !editing)} aria-expanded={editing}>
  {editing ? 'סיום עריכה' : 'עריכת צבעים'}
</button>

{#if editing}
  <div class="editor">
    {#each current as c, i (i)}
      <label class="color-row">
        <input type="color" value={c} oninput={(e) => setState(i, e.currentTarget.value)} />
        <span>מצב {i}{i === 0 ? ' (ריק)' : ''}</span>
      </label>
    {/each}
    <label class="color-row">
      <input
        type="checkbox"
        checked={palettes.current.grid !== null}
        onchange={(e) => palettes.update({ grid: e.currentTarget.checked ? '#888888' : null })}
      />
      <span>קווי רשת</span>
      {#if palettes.current.grid}
        <input type="color" value={palettes.current.grid} oninput={(e) => palettes.update({ grid: e.currentTarget.value })} />
      {/if}
    </label>
    <label class="color-row">
      <input
        type="checkbox"
        checked={!!palettes.current.ramp}
        onchange={(e) => palettes.update({ ramp: e.currentTarget.checked, colors: e.currentTarget.checked ? [current[0], current[k - 1]] : current })}
      />
      <span>מעבר הדרגתי בין הצבע הראשון לאחרון</span>
    </label>
    <div class="row">
      <input type="text" placeholder="שם לערכה" bind:value={newName} style="flex:1;min-width:0" />
      <button class="btn small primary" onclick={saveAs}>שמירה</button>
    </div>
    {#if !palettes.current.builtin && palettes.current.id !== 'custom'}
      <button class="btn small orange" onclick={() => palettes.remove(palettes.current.id)}>מחיקת הערכה "{palettes.current.name}"</button>
    {/if}
  </div>
{/if}

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 6px;
    border: 1.5px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    font-size: 13px;
  }
  .chip[aria-checked='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .sw {
    display: inline-flex;
    gap: 1px;
    padding: 1px;
    border-radius: 4px;
  }
  .sw i {
    width: 10px;
    height: 14px;
  }
  .editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
    padding: 10px;
    background: var(--surface-2);
    border-radius: var(--radius-sm);
  }
  .color-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
  input[type='color'] {
    width: 38px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: none;
  }
</style>
