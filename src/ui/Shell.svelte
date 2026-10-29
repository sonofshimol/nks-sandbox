<script lang="ts">
  // Page layout: canvas plus controls. Desktop: side panel. Phone: full-screen
  // canvas with a bottom sheet (a quick bar when collapsed, all controls when open).
  import type { Snippet } from 'svelte';
  import { app } from '../lib/app.svelte';
  import { media } from '../lib/media.svelte';

  function goTo(id: string) {
    const first = app.systems[0]?.id;
    location.href = id === first ? './' : `?sys=${id}`;
  }

  interface Props {
    title: string;
    subtitle?: string;
    main: Snippet;
    panel: Snippet;
    quick: Snippet;
    overlay?: Snippet;
  }

  let { title, subtitle = '', main, panel, quick, overlay }: Props = $props();
  let sheetOpen = $state(false);
</script>

<div class="app" class:mobile={media.mobile}>
  <header>
    <a class="brand" href="./" aria-label="ארגז חול לאוטומטים תאיים: דף הבית">
      <img src="/icon.svg" alt="" width="26" height="26" />
      {#if !media.mobile}<span>ארגז חול לאוטומטים תאיים</span>{/if}
    </a>
    <select class="systems" value={app.systemId} onchange={(e) => goTo(e.currentTarget.value)} aria-label="בחירת מערכת">
      {#each app.systems as s (s.id)}
        <option value={s.id}>{s.title}{s.chapter ? ` (${s.chapter})` : ''}</option>
      {/each}
    </select>
    <div class="title">
      <strong>{title}</strong>
      {#if subtitle}<span class="muted">{subtitle}</span>{/if}
    </div>
  </header>

  <div class="body">
    {#if !media.mobile}
      <aside class="panel">{@render panel()}</aside>
    {/if}
    <main class="stage">
      {@render main()}
      {@render overlay?.()}
    </main>
  </div>

  {#if media.mobile}
    <section class="sheet" class:open={sheetOpen} aria-label="פקדים">
      <button class="handle" onclick={() => (sheetOpen = !sheetOpen)} aria-expanded={sheetOpen}>
        <span class="grip"></span>
        <span class="sr-only">{sheetOpen ? 'סגירת הפקדים' : 'פתיחת כל הפקדים'}</span>
      </button>
      <div class="quick">{@render quick()}</div>
      {#if sheetOpen}
        <div class="sheet-body">{@render panel()}</div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .app {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  header {
    height: var(--header-height);
    flex: none;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 14px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--accent-strong);
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
  }
  .systems {
    max-width: 240px;
    font-weight: 600;
    border-color: var(--accent);
    color: var(--accent-strong);
    background: var(--accent-soft);
  }
  .mobile .systems {
    max-width: 46vw;
  }
  .title {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .title .muted {
    font-size: 13px;
  }
  .body {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .panel {
    width: var(--panel-width);
    flex: none;
    overflow-y: auto;
    border-inline-end: 1px solid var(--border);
    background: var(--surface);
    padding: 14px;
  }
  .stage {
    position: relative;
    flex: 1;
    min-width: 0;
    background: var(--bg);
  }

  .mobile .stage {
    /* leave room for the collapsed sheet */
    margin-bottom: 64px;
  }
  .sheet {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 20;
    background: var(--surface);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 20px rgba(20, 30, 50, 0.14);
    padding: 0 12px calc(10px + env(safe-area-inset-bottom));
    max-height: 78vh;
    display: flex;
    flex-direction: column;
  }
  .handle {
    border: 0;
    background: transparent;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .grip {
    width: 44px;
    height: 5px;
    border-radius: 3px;
    background: var(--border);
  }
  .quick {
    flex: none;
  }
  .sheet-body {
    overflow-y: auto;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }
</style>
