<script lang="ts">
  // PWA: when a new version is ready, offer to reload instead of silently
  // staying on the cached one.
  import { useRegisterSW } from 'virtual:pwa-register/svelte';

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for updates every hour while the app stays open.
      if (reg) setInterval(() => reg.update(), 60 * 60 * 1000);
    },
  });
</script>

{#if $needRefresh}
  <div class="toast" role="status">
    <span>יש גרסה חדשה, לרענן?</span>
    <button class="btn small primary" onclick={() => updateServiceWorker(true)}>רענון</button>
    <button class="btn small" onclick={() => needRefresh.set(false)}>לא עכשיו</button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    z-index: 100;
    top: calc(var(--header-height) + 10px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: 999px;
    box-shadow: var(--shadow);
    white-space: nowrap;
  }
</style>
