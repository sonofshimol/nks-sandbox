<script lang="ts">
  // Share link, favorite, PNG export, favorites list and settings: the same in every system.
  import { app } from '../lib/app.svelte';
  import { favorites } from '../lib/favorites.svelte';
  import { theme } from '../lib/theme.svelte';

  interface Props {
    /** Title used when saving a favorite. */
    title: string;
    onExportPNG?: () => void;
    shortcuts?: [string, string][];
  }
  let { title, onExportPNG, shortcuts = [] }: Props = $props();

  let copied = $state(false);
  const isFav = $derived(favorites.has(app.query));

  // ---- video: record the main canvas while it runs ----
  let recorder: MediaRecorder | null = null;
  let recording = $state(false);
  const canRecord = typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;

  function toggleRecording() {
    if (recording) {
      recorder?.stop();
      return;
    }
    const canvas = document.querySelector<HTMLCanvasElement>('main canvas');
    if (!canvas) return;
    const type = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) return;
    const chunks: Blob[] = [];
    recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: type, videoBitsPerSecond: 6_000_000 });
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      recording = false;
      const blob = new Blob(chunks, { type });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${title.replace(/[^p{L}p{N}]+/gu, '-')}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };
    recorder.start();
    recording = true;
  }

  async function share() {
    const url = location.origin + location.pathname + app.query;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      // user cancelled
    }
  }
</script>

<div class="row">
  <button class="btn blue" onclick={share}>{copied ? 'הקישור הועתק ✓' : 'קישור לשיתוף'}</button>
  <button class="btn" class:fav={isFav} onclick={() => favorites.toggle(title, app.query)} aria-pressed={isFav}>
    {isFav ? '★ במועדפים' : '☆ למועדפים'}
  </button>
  {#if onExportPNG}
    <button class="btn purple" onclick={onExportPNG}>ייצוא PNG</button>
  {/if}
  {#if canRecord}
    <button class="btn" class:rec={recording} onclick={toggleRecording} title="מקליט את מה שרואים על המסך, עד שלוחצים שוב">
      {recording ? '■ עצירת ההקלטה' : '● הקלטת וידאו'}
    </button>
  {/if}
</div>

{#if favorites.list.length}
  <details class="favs">
    <summary>מועדפים ({favorites.list.length})</summary>
    <ul>
      {#each favorites.list as f (f.id)}
        <li>
          <a href={f.query || './'}>{f.title}</a>
          <button class="btn icon small" onclick={() => favorites.remove(f.id)} aria-label={`הסרת ${f.title} מהמועדפים`}>✕</button>
        </li>
      {/each}
    </ul>
  </details>
{/if}

<details class="favs">
  <summary>הגדרות וקיצורי מקלדת</summary>
  <label class="row" style="margin:8px 0">
    <input type="checkbox" checked={theme.dark} onchange={() => theme.toggle()} />
    מצב כהה
  </label>
  {#if shortcuts.length}
    <table class="keys">
      <tbody>
        {#each shortcuts as [k, what] (k)}
          <tr><td><kbd>{k}</kbd></td><td>{what}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
</details>

<style>
  .rec {
    background: #ffe3e3;
    border-color: #e03131;
    color: #c92a2a;
  }
  .fav {
    color: #b7791f;
    border-color: #f0c36d;
    background: #fff8e6;
  }
  .favs {
    margin-top: 10px;
    font-size: 14px;
  }
  summary {
    cursor: pointer;
    color: var(--text-muted);
    font-weight: 600;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  a {
    color: var(--accent-2);
  }
  .keys td {
    padding: 2px 6px;
  }
  kbd {
    font-family: var(--font-mono);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 5px;
  }
</style>
