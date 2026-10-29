# CLAUDE.md: ארגז חול לאוטומטים תאיים

The full spec is `PROMPT-ארגז-חול.md` (Hebrew). This file records decisions made along the way;
update it whenever a decision changes.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest (tests/*.test.ts)
npm run check    # svelte-check + TypeScript
npm run build    # static site in dist/ (+ service worker)
npm run icons    # regenerate public/icon*.{svg,png}
```

## Decisions

| Topic | Decision | Why |
|---|---|---|
| UI framework | Svelte 5 (runes) + Vite + TypeScript | Small bundles for phones, little boilerplate per component |
| TypeScript | pinned to 6.x | svelte-check 4 supports TS ≤ 6 |
| Hosting | Cloudflare Pages, connected to the GitHub repo `nks-sandbox` (public) | Free, unlimited bandwidth, a preview URL per branch, fast in Israel |
| PWA | `vite-plugin-pwa`, `registerType: 'prompt'` → toast "יש גרסה חדשה, לרענן?" (`src/ui/ReloadPrompt.svelte`) | Works offline after the first visit, never stuck on an old cache |
| Direction | The UI is RTL Hebrew; canvases and rule icons are **always LTR** like the book | Left/right of a neighborhood and Wolfram codes depend on it |
| Terms | `docs/glossary.md` is the source for Hebrew terms ("כלל", never "חוק") | The user's translation of chapters 1–4 |
| Rule names | Elementary rules: "כלל 30". Other families: "קוד 1599" | The translation keeps "rule 30" in English; the UI uses Hebrew |
| Colors | All UI colors are CSS variables in `src/styles/theme.css`; light by default, dark only by explicit choice | Spec |
| Cell palettes | `src/engine/palette.ts`. Default "ירוק" (light/dark green, very dark green grid). "שחור על לבן" like the book. Ramp palettes interpolate between two colors for k>2 (the book's grays). Multi-color palettes use Okabe–Ito (color-blind safe) | Spec |
| Grid lines | Fade in once a cell is ≥4 device pixels, fully visible at ≥12 | Spec ("disappear gradually") |
| URL state | Everything is in the query string; defaults are omitted (`?rule=30`). `sys` is omitted for the default system, `pal` is a built-in id or encoded colors | Shareable links |
| Local storage | Favorites (`ca.favorites`), saved palettes (`ca.palettes`), theme (`ca.theme`); all access goes through `src/lib/storage.ts`, which never throws | Private mode / blocked storage |
| 1D boundaries | `infinite` (default for finite seeds): exact simulation of an unbounded line; the background outside the window evolves by the rule too (rules with 000→1). `periodic`, `fixed` (0) | Book pictures assume an infinite line |
| Pyramid view | Cells outside the light cone of the seed are `MASKED` (255) and drawn as page background | Spec |
| Big codes | Rule codes are `bigint` in the engine and decimal strings in params/URL | k=3 r=2 has 3^243 rules |
| Rule families allowed | General rules only while k^(2r+1) ≤ 1024 (icons stay usable); otherwise totalistic only | UI limits |
| Size limits | 1D: at most 9M cells (`LIMITS.maxCells`); steps are clamped and the UI says so | Keeps phones responsive |
| Random rules | Always keep the all-0 neighborhood → 0, so patterns grow from a seed | More interesting results |
| Book pages | Verified against the figure references in the Hebrew translation ("איור 1, עמוד 27 במקור"). The book PDF is a scan without a text layer | Don't guess page numbers; leave `page` empty if unsure |

## Architecture

```
src/engine/        pure TS, no DOM: simulations, rule codes, init, palettes, PRNG
src/render/        drawing helpers (cell grid → image, PNG export)
src/systems/       one folder per kind of system + registry.ts
  types.ts         SystemModule: defaults, fromQuery/toQuery, View, examples
  ca1d/            1D CA: params, describe (Hebrew rule sentence), examples, View, RuleIcons, Gallery
src/ui/            shared components: Shell (side panel / bottom sheet), GridCanvas (zoom/pan/click),
                   FloatingPanel (rules window), Modal, PalettePicker, CommonTools, ReloadPrompt
src/lib/           app-wide state (palettes, favorites, theme, media query, URL)
tests/             vitest unit tests (engine + URL)
docs/glossary.md   Hebrew terms
```

To add a system: create `src/systems/<id>/` with an `index.ts` exporting a `SystemModule`, and add it
to `src/systems/registry.ts`. Engine code goes to `src/engine/` and must not import from the UI.

Every system view must offer: a prominent "כללי העדכון" button that opens `FloatingPanel` with the
rules (editable, in the simulation colors, with a one-sentence Hebrew explanation), clicking a cell
to show which rule produced it, the shared `PalettePicker` and `CommonTools`.

## Copyright

The book PDF and the translations live in the parent folder and are git-ignored (`*.pdf`, `*.docx`).
Explanations on the site are written in new words; no text or images from the book.
Local visual comparisons go to `tests/visual/book/` and `tests/visual/out/` (git-ignored).

## Status

- Stage 1 (done): skeleton, PWA, 1D engine (k, r, totalistic), elementary rules with gallery and
  pyramid, rule window, palettes (incl. green and book), share URL, favorites, PNG export.
- Next: stage 2: Life-like in WebGL2, drawing cells, RLE.
- Deferred from stage 1: Web Worker for 1D (not needed yet: 1000×1000 computes in a few ms),
  animation of 1D growth, four classes and the difference view (stage 3).
