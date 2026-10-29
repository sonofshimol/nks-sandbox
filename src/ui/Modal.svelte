<script lang="ts">
  // Large modal (gallery and similar). Full screen on phones.
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    open: boolean;
    onClose: () => void;
    children: Snippet;
    actions?: Snippet;
  }

  let { title, open, onClose, children, actions }: Props = $props();
  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} onclose={onClose} onclick={(e) => e.target === dialog && onClose()}>
  {#if open}
    <div class="inner">
      <div class="bar">
        <strong>{title}</strong>
        <div class="row">
          {@render actions?.()}
          <button class="btn icon small" onclick={onClose} aria-label="סגירה">✕</button>
        </div>
      </div>
      <div class="content">{@render children()}</div>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    padding: 0;
    border: 0;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    width: min(1100px, 94vw);
    height: min(88vh, 900px);
    background: var(--surface);
    color: var(--text);
  }
  dialog::backdrop {
    background: rgba(20, 28, 40, 0.35);
  }
  .inner {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    font-size: 17px;
  }
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
  }
  @media (max-width: 820px) {
    dialog {
      width: 100vw;
      height: 100dvh;
      max-width: 100vw;
      max-height: 100dvh;
      border-radius: 0;
    }
  }
</style>
