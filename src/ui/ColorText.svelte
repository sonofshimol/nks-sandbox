<script lang="ts">
  // Renders text with {n} tokens as color swatches of state n.
  interface Props {
    text: string;
    colors: string[];
  }
  let { text, colors }: Props = $props();

  const parts = $derived(text.split(/(\{\d+\})/g).filter(Boolean));
</script>

{#each parts as part, i (i)}
  {@const m = /^\{(\d+)\}$/.exec(part)}
  {#if m}
    <span class="swatch" style:background={colors[Number(m[1])] ?? '#ccc'} title={`מצב ${m[1]}`}></span>
  {:else}
    {part}
  {/if}
{/each}
