<script lang="ts">
  // Picks the system from the URL, keeps the URL in sync with its parameters
  // and the palette, and renders the system's view.
  import { onMount } from 'svelte';
  import { app } from './lib/app.svelte';
  import { palettes } from './lib/palettes.svelte';
  import { buildQuery, readQuery, writeQuery } from './lib/url';
  import { findSystem, systems } from './systems/registry';
  import ReloadPrompt from './ui/ReloadPrompt.svelte';

  const initial = readQuery();
  const first = findSystem(initial.get('sys'));
  let system = $state(first);
  let params = $state(first.fromQuery(initial));
  palettes.fromQuery(initial.get('pal'));
  app.systems = systems.map((s) => ({ id: s.id, title: s.title, chapter: s.chapter }));

  const query = $derived(
    buildQuery({
      sys: system.id === 'ca1d' ? null : system.id,
      ...system.toQuery(params),
      pal: palettes.toQuery(),
    }),
  );

  $effect(() => {
    app.systemId = system.id;
    app.query = query;
    writeQuery(query);
  });

  onMount(() => {
    const onPop = () => {
      const q = readQuery();
      system = findSystem(q.get('sys'));
      params = system.fromQuery(q);
      palettes.fromQuery(q.get('pal'));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  function setParams(p: unknown) {
    params = p;
  }
</script>

<svelte:head>
  <title>{system.title} · ארגז חול לאוטומטים תאיים</title>
</svelte:head>

<system.View {params} {setParams} />
<ReloadPrompt />
