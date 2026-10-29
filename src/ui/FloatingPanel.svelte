<script lang="ts">
  // A non-modal floating window on desktop (draggable by its title, so the
  // simulation stays visible while editing), and a bottom sheet on phones.
  import type { Snippet } from 'svelte';
  import { media } from '../lib/media.svelte';

  interface Props {
    title: string;
    open: boolean;
    onClose: () => void;
    children: Snippet;
    width?: number;
  }

  let { title, open, onClose, children, width = 460 }: Props = $props();

  let x = $state(24);
  let y = $state(70);
  let drag: { dx: number; dy: number } | null = null;

  function down(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { dx: e.clientX - x, dy: e.clientY - y };
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    x = Math.max(0, Math.min(window.innerWidth - 120, e.clientX - drag.dx));
    y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - drag.dy));
  }
  function up() {
    drag = null;
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

{#if open}
  <div
    class="panel"
    class:sheet={media.mobile}
    style={media.mobile ? '' : `left:${x}px;top:${y}px;width:${width}px`}
    role="dialog"
    aria-label={title}
    tabindex="-1"
    onkeydown={key}
  >
    <div class="bar" onpointerdown={down} onpointermove={move} onpointerup={up} role="presentation">
      <strong>{title}</strong>
      <button class="btn icon small" onclick={onClose} aria-label="סגירה">✕</button>
    </div>
    <div class="content">{@render children()}</div>
  </div>
{/if}

<style>
  .panel {
    position: fixed;
    z-index: 40;
    max-height: calc(100vh - 90px);
    max-width: calc(100vw - 20px);
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px 8px 14px;
    border-bottom: 1px solid var(--border);
    cursor: move;
    user-select: none;
    touch-action: none;
    font-size: 16px;
  }
  .content {
    overflow-y: auto;
    padding: 14px;
  }
  .sheet {
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    width: auto;
    max-height: 72vh;
    border-radius: 16px 16px 0 0;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .sheet .bar {
    cursor: default;
  }
</style>
