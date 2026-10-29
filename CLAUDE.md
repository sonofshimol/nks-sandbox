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
| Rule digits | Rules can be typed as base-k digits, most significant first; "abc|" means the palindrome abccba (odd length: middle digit shared). Palindromes are displayed with a "|" | User request |
| Locks | Locked table entries (`lock=` in URL, default `0` so all-white stays white) are kept by "random rule" | User request |
| Ring view | 1D option: row t is a ring of W equal sectors at radius t; middle cell at the top. Rendered by mapping each pixel back to (t, x), exact render after the view stops moving | User request |
| Letters automaton | Port of the user's HTML (symmetric 23-symbol rule, hill climbing). Rows read right to left, so the grid is drawn mirrored. State in URL as seed + used entries (base 36). Built-in dictionary = the ~8000 words from the user's HTML, lazy-loaded; users can load their own (e.g. Hspell) into localStorage, so no AGPL list ships in the repo | Licensing |
| 2D on GPU | Life-like, Generations, Larger than Life and WireWorld share one WebGL2 shader (RG8UI: state + age). History = ring of GPU snapshots (blitFramebuffer), ~48 MB | 1024² at 60 fps |
| Wolfram codes 2D | Outer totalistic code: bit 2s+c = new color for own color c and neighbor sum s (5 or 9 neighbors). Checked: Game of Life = 224 | Book chapter 5 |
| Lenia | R32F textures, needs EXT_color_buffer_float (shows a message otherwise) | Continuous values |
| Svelte effects | Effects that call functions which read $state must wrap them in `untrack` (this caused loops twice) | Avoid effect_update_depth_exceeded |
| Example rules | Mobile automata, TMs and register machines examples were found by a search for incompressible behavior (our own numbering, not Wolfram's TM numbering) | Book rule numbers for these were not verifiable |

## Architecture

```
src/engine/        pure TS, no DOM: simulations, rule codes, init, palettes, PRNG
src/render/        drawing helpers (cell grid → image, PNG export)
src/systems/       one folder per kind of system + registry.ts
  types.ts         SystemModule: defaults, fromQuery/toQuery, View, examples
  ca1d/            1D CA: params, describe (Hebrew rule sentence), examples, View, RuleIcons, Gallery
  programs/        ch. 3: mobile automata, TMs, substitution (1D/2D), sequential, tag, cyclic tag, register, continuous
  numbers/         ch. 4: digits, multiplication, 3/2, reverse-add, sieve, recursive sequences, π, √n
  ant/             2D Turing machines (Langton's ant / turmites), CPU
  life/            Life-like family on WebGL2 (src/render/lifeGL.ts), RLE, patterns
  networks/        multiway systems and causal networks (SVG)
  lenia/           Lenia and SmoothLife (src/render/leniaGL.ts)
  tour/            chapters 7–12: rule 30 randomness, snowflakes, reversible CA, rule 110, PCE
  letters/         the letters automaton (src/engine/letters.ts)
src/ui/            shared components: Shell (side panel / bottom sheet, system menu), GridCanvas
                   (zoom/pan/click, labels, boxes), PolarCanvas (ring view), panzoom.ts, FloatingPanel
                   (rules window), Modal, PalettePicker, CommonTools (share, favorites, PNG, video), ReloadPrompt
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

- Stage 1 (done): skeleton, PWA, 1D engine, gallery, pyramid, rules window, palettes, URL, favorites.
- After stage 1 (done): rule digits with symmetry bar, locks, ring view, letters automaton.
- Stage 2 (done): Life-like family on the GPU, drawing, RLE, pattern library, age colors, history.
- Stage 3 (done): simple programs (ch. 3), numbers (ch. 4), 2D TMs, 5/9-neighbor codes from a single
  cell, multiway systems and causal networks, Lenia and SmoothLife, difference view and four classes,
  tour of chapters 7–12.
- Stage 5 (partly): PWA verified (service worker + precache incl. dictionary), PNG and video export
  (MediaRecorder, webm/mp4).
- Not done / open: network systems (ch. 5, nodes with two connections), 3D CAs, generalized mobile
  automata, symbolic systems (ch. 3), Hashlife, GIF export, local visual comparison against book
  figures (needs a PDF renderer; poppler is not installed), site name (the user will choose).
