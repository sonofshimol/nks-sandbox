<script lang="ts" module>
  export interface TourParams {
    slide: number;
  }
</script>

<script lang="ts">
  // A guided tour of the later chapters (7–12): short explanations in our own
  // words, each with a live picture and a link into the sandbox.
  import { codeToRule, run1D } from '../../engine/ca1d';
  import { makeRow } from '../../engine/init1d';
  import { colorsFor, hexToRgb } from '../../engine/palette';
  import { blockFrequencies, rule30Bits, secondOrder, snowflake } from '../../engine/tour';
  import { palettes } from '../../lib/palettes.svelte';
  import CommonTools from '../../ui/CommonTools.svelte';
  import GridCanvas from '../../ui/GridCanvas.svelte';
  import Shell from '../../ui/Shell.svelte';
  import type { SystemViewProps } from '../types';

  let { params, setParams }: SystemViewProps<TourParams> = $props();

  const SLIDES = [
    { id: 'random', title: 'כלל 30 כמחולל מספרים אקראיים', chapter: 'פרקים 7, 10' },
    { id: 'nature', title: 'תבניות בטבע: פתיתי שלג וצדפים', chapter: 'פרק 8' },
    { id: 'reversible', title: 'אוטומטים הפיכים', chapter: 'פרק 9' },
    { id: 'r110', title: 'כלל 110: אוניברסליות', chapter: 'פרק 11' },
    { id: 'pce', title: 'עקרון השקילות החישובית', chapter: 'פרק 12' },
  ];
  const slide = $derived(Math.min(SLIDES.length - 1, Math.max(0, params.slide)));
  const go = (i: number) => setParams({ slide: Math.min(SLIDES.length - 1, Math.max(0, i)) });
  const colors = $derived(colorsFor(palettes.current, 2));

  // ---- slide 1: rule 30 randomness ----
  let nBits = $state(20000);
  const bits = $derived(slide === 0 ? rule30Bits(nBits) : new Uint8Array(0));
  const freq = $derived([1, 2, 3].map((L) => blockFrequencies(bits, L)));
  const strip = $derived.by(() => {
    const w = 100;
    const h = Math.min(60, Math.ceil(bits.length / w));
    return { w, h, cells: bits.slice(0, w * h) };
  });
  const r30pic = $derived.by(() => {
    if (slide !== 0) return null;
    const W = 161;
    const init = new Uint8Array(W);
    init[80] = 1;
    return run1D({ rule: codeToRule(30n, 2, 1, false), init, steps: 80, boundary: 'infinite' });
  });

  // ---- slide 2: snowflake ----
  let flakeSteps = $state(40);
  let flakeCanvas = $state<HTMLCanvasElement>();
  $effect(() => {
    if (slide !== 1 || !flakeCanvas) return;
    const N = 2 * flakeSteps + 5;
    const g = snowflake(N, flakeSteps);
    const ctx = flakeCanvas.getContext('2d')!;
    const S = flakeCanvas.width;
    ctx.clearRect(0, 0, S, S);
    const size = S / (N * 1.8);
    const [a, b] = colorsFor(palettes.current, 2).map(hexToRgb);
    const c = Math.floor(N / 2);
    for (let r = 0; r < N; r++)
      for (let q = 0; q < N; q++) {
        const v = g[r * N + q];
        if (!v) continue;
        const t = Math.min(1, v / (flakeSteps + 2));
        const col = b.map((x, i) => Math.round(x + (a[i] - x) * t * 0.7));
        ctx.fillStyle = `rgb(${col.join(',')})`;
        const x = S / 2 + size * Math.sqrt(3) * (q - c + (r - c) / 2);
        const y = S / 2 + size * 1.5 * (r - c);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const ang = (Math.PI / 3) * k + Math.PI / 6;
          ctx.lineTo(x + size * Math.cos(ang), y + size * Math.sin(ang));
        }
        ctx.fill();
      }
  });
  const shellPic = $derived.by(() => {
    if (slide !== 1) return null;
    const W = 200;
    return run1D({ rule: codeToRule(30n, 2, 1, false), init: makeRow({ kind: 'random', density: 0.5, seed: 3 }, W, 2), steps: 140, boundary: 'periodic' });
  });

  // ---- slide 3: reversible ----
  let revCode = $state(37);
  const rev = $derived.by(() => {
    if (slide !== 2) return null;
    const W = 120;
    const init = new Uint8Array(W);
    for (let i = 55; i < 65; i++) init[i] = (i * 7) % 3 === 0 ? 1 : 0;
    const steps = 100;
    const fwd = secondOrder(revCode, init, steps);
    // Run backwards: start from the last two rows in reverse order.
    const back = secondOrderFrom(revCode, fwd[fwd.length - 1], fwd[fwd.length - 2], steps);
    const ok = back[back.length - 1].every((v, i) => v === init[i]);
    const cells = new Uint8Array(W * (2 * steps + 1));
    fwd.forEach((r, t) => cells.set(r, t * W));
    for (let x = 0; x < W; x++) cells[steps * W + x] = 2;
    back.slice(2).forEach((r, t) => cells.set(r, (steps + 1 + t) * W));
    return { W, H: 2 * steps + 1, cells, ok };
  });
  function secondOrderFrom(code: number, a: Uint8Array, b: Uint8Array, steps: number) {
    const table = codeToRule(BigInt(code), 2, 1, false).table;
    const W = a.length;
    const rows = [a.slice(), b.slice()];
    for (let t = 1; t < steps; t++) {
      const cur = rows[t];
      const prev = rows[t - 1];
      const next = new Uint8Array(W);
      for (let x = 0; x < W; x++) next[x] = table[(cur[(x - 1 + W) % W] << 2) | (cur[x] << 1) | cur[(x + 1) % W]] ^ prev[x];
      rows.push(next);
    }
    return rows;
  }

  // ---- slide 4: rule 110 ----
  const r110 = $derived.by(() => {
    if (slide !== 3) return null;
    return run1D({ rule: codeToRule(110n, 2, 1, false), init: makeRow({ kind: 'random', density: 0.5, seed: 9 }, 300, 2), steps: 300, boundary: 'periodic' });
  });
</script>

{#snippet panel()}
  <section>
    <h3>סיור בפרקים 7–12</h3>
    <ol class="toc">
      {#each SLIDES as s, i (s.id)}
        <li><button aria-current={i === slide} onclick={() => go(i)}>{s.title} <span class="muted">({s.chapter})</span></button></li>
      {/each}
    </ol>
  </section>
  <section><CommonTools title={SLIDES[slide].title} /></section>
{/snippet}

{#snippet quick()}
  <div class="row nav">
    <button class="btn" onclick={() => go(slide - 1)} disabled={slide === 0}>הקודם</button>
    <span>{slide + 1} / {SLIDES.length}</span>
    <button class="btn primary" onclick={() => go(slide + 1)} disabled={slide === SLIDES.length - 1}>הבא</button>
  </div>
{/snippet}

{#snippet pic(cells: Uint8Array, w: number, h: number, cols: string[], height = 260)}
  <div class="pic" style:height="{height}px">
    <GridCanvas {cells} width={w} height={h} colors={cols} grid={palettes.current.grid} />
  </div>
{/snippet}

{#snippet main()}
  <article class="slide">
    <header>
      <span class="badge">{SLIDES[slide].chapter}</span>
      <h2>{SLIDES[slide].title}</h2>
    </header>

    {#if slide === 0}
      <p>
        העמודה האמצעית של כלל 30, שמתחיל מתא שחור יחיד, נראית אקראית לגמרי, למרות שהכלל פשוט ודטרמיניסטי. בגלל זה השתמשו בה
        במשך שנים כמחולל מספרים אקראיים בתוכנה Mathematica. כאן אפשר לבדוק בעצמכם: אם הסדרה אקראית, כל רצף של L ספרות אמור
        להופיע בתדירות של בערך 1/2<sup>L</sup>.
      </p>
      {#if r30pic}{@render pic(r30pic.cells, r30pic.width, r30pic.height, colors, 200)}{/if}
      <p class="muted">הספרות הראשונות של העמודה האמצעית, משמאל לימין ושורה אחרי שורה:</p>
      {@render pic(strip.cells, strip.w, strip.h, colors, 140)}
      <label class="field"><span>כמה ספרות לבדוק: {nBits.toLocaleString('he-IL')}</span>
        <input type="range" min="1000" max="60000" step="1000" value={nBits} onchange={(e) => (nBits = Number(e.currentTarget.value))} /></label>
      <div class="freqs">
        {#each freq as f, L (L)}
          <table>
            <thead><tr><th>רצף</th><th>תדירות</th><th>צפוי</th></tr></thead>
            <tbody>
              {#each f as row (row.block)}
                <tr>
                  <td class="ltr mono">{row.block}</td>
                  <td>
                    <span class="bar" style:width="{row.freq * (2 ** (L + 1)) * 40}px"></span>
                    {(row.freq * 100).toFixed(2)}%
                  </td>
                  <td class="muted">{(100 / 2 ** (L + 1)).toFixed(2)}%</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/each}
      </div>
      <a class="btn blue" href="./?rule=30&t=1000">לפתוח את כלל 30 בארגז החול</a>
    {:else if slide === 1}
      <p>
        פתיתי שלג גדלים כשמולקולות מים נצמדות לקצוות של הגביש. מודל פשוט: רשת משושים, ותא קופא כשבדיוק אחד מששת שכניו כבר
        קפוא. מתא אחד צומחת צורה עם שש זרועות, שמתפצלת ושוב מתמלאת, כמו פתיתי שלג אמיתיים בשלבי גדילה שונים.
      </p>
      <div class="flake">
        <canvas bind:this={flakeCanvas} width="420" height="420" aria-label="פתית שלג על רשת משושים"></canvas>
      </div>
      <label class="field"><span>צעדים: {flakeSteps}</span>
        <input type="range" min="1" max="80" bind:value={flakeSteps} /></label>
      <p>
        גם הדוגמאות על צדפים של חלזונות ים נוצרות שורה אחרי שורה: הצדף גדל בשפתו, ותאי הפיגמנט בשפה מתנהגים כמו אוטומט תאי
        חד־ממדי. משולשים בגדלים שונים, כמו בכלל 30 מתנאי התחלה אקראיים, מופיעים על צדפים מסוג קונוס.
      </p>
      {#if shellPic}{@render pic(shellPic.cells, shellPic.width, shellPic.height, colors, 220)}{/if}
      <a class="btn blue" href="./?rule=30&init=random&d=0.5&seed=3&b=per&w=300&t=300">לפתוח בארגז החול</a>
    {:else if slide === 2}
      <p>
        ברוב האוטומטים התאיים מידע הולך לאיבוד: כמה מצבים שונים יכולים להוביל לאותו מצב, ואי אפשר לדעת מאיפה הגענו. אוטומט
        <b>הפיך</b> שומר על כל המידע. דרך פשוטה לבנות כזה: "אוטומט מסדר שני", שבו המצב החדש הוא הכלל הרגיל XOR המצב שלפני שני
        צעדים. אז אפשר לרוץ גם אחורה. כאן החצי העליון רץ קדימה, והתחתון מתחיל מהשורות האחרונות בסדר הפוך וחוזר להתחלה.
        מרגולוס הציע גם שיטה אחרת: אוטומטים של בלוקים, שבהם כל בלוק של 2×2 מוחלף בבלוק אחר לפי טבלה הפיכה.
      </p>
      <label class="field"><span>הכלל הבסיסי: {revCode}</span>
        <input type="range" min="0" max="255" bind:value={revCode} /></label>
      {#if rev}
        {@render pic(rev.cells, rev.W, rev.H, [...colors, '#e8590c'], 360)}
        <p class:ok={rev.ok}>{rev.ok ? '✓ הריצה אחורה החזירה בדיוק את שורת ההתחלה.' : '✗ משהו לא חזר (זה לא אמור לקרות).'}</p>
      {/if}
    {:else if slide === 3}
      <p>
        בכלל 110 מופיעים מבנים ממוקמים, "רחפנים", שנעים על רקע חזרתי ומתנגשים זה בזה. מתיו קוק הוכיח (פורסם ב־2004) שבעזרת
        סידור מתאים של רחפנים אפשר לחקות מערכת תגים מחזורית, ולכן כלל 110 הוא <b>אוניברסלי</b>: הוא יכול לחשב כל דבר שמחשב
        יכול לחשב. זה אחד הכללים הפשוטים ביותר שידוע שהם אוניברסליים.
      </p>
      {#if r110}{@render pic(r110.cells, r110.width, r110.height, colors, 380)}{/if}
      <a class="btn blue" href="./?rule=110&init=random&d=0.5&seed=9&b=per&w=600&t=1500">לפתוח את כלל 110 בארגז החול</a>
    {:else}
      <p>
        המסקנה הגדולה של הספר: כמעט כל תהליך שאינו פשוט באופן מובהק הוא חישוב מתוחכם באותה מידה. אין סולם הדרגתי של
        מורכבות: ברגע שמערכת עוברת סף נמוך מאוד, כמו כלל 110 או מכונת טיורינג קטנה, היא כבר שקולה לכל מחשב.
      </p>
      <p>
        מכאן נובעת <b>אי־פריקות חישובית</b>: כדי לדעת מה מערכת כזו תעשה, לרוב אין קיצור דרך. צריך פשוט להריץ אותה, צעד אחרי
        צעד. זה בדיוק מה שאתם עושים בארגז החול הזה.
      </p>
      <ul class="links">
        <li><a href="./?rule=30&t=1000">כלל 30: אקראיות מכלל פשוט</a></li>
        <li><a href="./?rule=110&init=random&d=0.5&seed=4&b=per&w=400&t=300&diff=1">כלל 110 עם תצוגת הבדל</a></li>
        <li><a href="?sys=programs&kind=tm">מכונות טיורינג קטנות</a></li>
        <li><a href="?sys=programs&kind=ctag">מערכות תגים מחזוריות</a></li>
      </ul>
    {/if}

    <nav class="row nav">
      <button class="btn" onclick={() => go(slide - 1)} disabled={slide === 0}>→ הקודם</button>
      <span class="muted">{slide + 1} / {SLIDES.length}</span>
      <button class="btn primary" onclick={() => go(slide + 1)} disabled={slide === SLIDES.length - 1}>הבא ←</button>
    </nav>
  </article>
{/snippet}

<Shell title={SLIDES[slide].title} subtitle="סיור" {main} {panel} {quick} />

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  h3 {
    margin: 0;
    font-size: 15px;
    color: var(--accent-strong);
  }
  .toc {
    margin: 0;
    padding-inline-start: 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .toc button {
    border: 0;
    background: none;
    text-align: start;
    padding: 4px 0;
    font-size: 14px;
  }
  .toc button[aria-current='true'] {
    color: var(--accent-strong);
    font-weight: 700;
  }
  .slide {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    padding: 20px max(16px, calc(50% - 380px)) 40px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    line-height: 1.65;
  }
  .slide header h2 {
    margin: 6px 0 0;
    color: var(--accent-strong);
  }
  .slide p {
    margin: 0;
  }
  .pic {
    position: relative;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    flex: none;
  }
  .freqs {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    font-size: 13px;
  }
  .freqs td,
  .freqs th {
    padding: 1px 6px;
  }
  .bar {
    display: inline-block;
    height: 10px;
    background: var(--accent-2);
    border-radius: 2px;
    vertical-align: middle;
    max-width: 80px;
  }
  .mono {
    font-family: var(--font-mono);
  }
  .flake {
    display: flex;
    justify-content: center;
  }
  .flake canvas {
    width: min(420px, 100%);
    height: auto;
  }
  .ok {
    color: var(--accent-strong);
    font-weight: 700;
  }
  .links {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .links a {
    color: var(--accent-2);
  }
  .nav {
    justify-content: space-between;
    margin-top: 10px;
  }
  a.btn {
    text-decoration: none;
    align-self: flex-start;
  }
</style>
