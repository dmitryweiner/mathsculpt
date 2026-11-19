# CLAUDE.md — working notes for this repo

MathSculpt builds printable surfaces from math formulas: a carrier (a solid
of revolution with an editable profile, or a sphere, torus, superellipsoid,
supershape), a stack of displacements along the normals, deformers, spatial
LFOs routed to any slider — and exports a watertight binary STL in
millimetres. Rules for agents: `AGENTS.md`.

## maker-kit — the shared pieces of the 3D tools

The panel and its rows (`ui/controls`, −/+ held, exact fields), folding
cards, undo (`core/history`, `ui/historyKeys`), storage records, presets and
their dialog, the phone sheet, the banner, the progress bar, the message
list, the list card (modulation routes), the language picker, the worker
queue (`WorkerClient`, `serveJobs`), meshes and normals, STL, the export
gate (`3d/validate`), the 3D view, the smoke harness and the design code are
maker-kit's ([maker-kit](https://github.com/dmitryweiner/maker-kit),
`~/projects/maker-kit`, by tag: `#v0.5.1`). The kit's docs are in its
`docs/` (the package ships none); the showcase is
<https://dmitryweiner.github.io/maker-kit/>.

MathSculpt's own: the geometry core (`src/geo/`), the card schema
(`src/formulas.ts`), the panel's rows as data (`src/ui/rows.ts`), the
modulation card, the profile graph, the overhang and amplitude warnings
(`src/ui/report.ts`), millimetres at the boundary (`geo/millimetres.ts`),
the worker's job (`src/worker/`), the view's material, the blue palette as
tokens over the kit's.

The rule (`~/projects/_conventions/3d-tools.md`): no copy of a kit piece. A
bug or a missing case in the kit is a kit PR with its test and a patch tag,
then the app moves to the tag; joint work is `npm link ../maker-kit`. An
option goes into the kit only when two apps need it; otherwise the app wraps
the kit's piece. MathSculpt is the kit without booleans: no manifold-3d, its
worker builds the surface in plain TypeScript.

## Plans

Plans live in `plans/` (in Russian). Decisions taken with the user go in a
plan's head, its outcome and deviations at its end. A new plan is
`plans/PLAN-<TOPIC>.md` and a line here.

- `plans/PLAN.md` — the app's architecture and milestones (done).
- `plans/IMPLEMENTATION_PLAN.md` — the expansion: formula registry, export
  gate, undo, hollow vessels, new formulas (done).
- `plans/PLAN-MAKER-KIT.md` — the move to maker-kit (M5), PR by PR: the
  toolchain, core, controls, ui, i18n, 3d, harness, docs; then 📄 New, the
  project file, the model kept in the browser, PWA.

## Commands

Node — the version in `.node-version` (24); check `node -v`.

```bash
npm run check     # tsc (TypeScript 7) + oxlint --type-aware (bans `as` casts) + prettier --check + vitest
npm run format    # prettier --write (not *.md and golden: .prettierignore)
npm run smoke     # browser smoke (dev :5287); --preview rebuilds and checks the prod build (:4287)
npm run shot      # profile screenshots → ./shots
npm run build     # production build → ./dist (with sw.js)
npm run icons     # the PWA's PNG icons from public/icon.svg
```

The lint is oxlint (`.oxlintrc.json`): typescript-eslint does not support
TS 7. Each rule switched off there says why. The prettier reformatting is
in `.git-blame-ignore-revs` (`git config blame.ignoreRevsFile
.git-blame-ignore-revs`).

GitHub Pages is published by `.github/workflows/deploy.yml` on every push
to `main`: `npm ci`, `npm run check`, `npm run build`, the smoke on the
production build, then `dist/`. A PR runs the same without publishing.
The build is not committed (`dist/` is ignored).

Golden geometry tests pin exact per-profile output; regenerate consciously
with `UPDATE_GOLDEN=1 npx vitest run tests/golden.test.ts` after an
intentional geometry change.

## Scripts: permanent ones, not throwaway

Do **not** write a temporary Playwright/Node script via `cat > tmp.mjs <<EOF`
every time something needs to be checked or screenshotted — regenerating the
same boilerplate each cycle is a big waste of tokens. Reusable tooling lives
in `scripts/` with CLI flags; a new check is a flag or a step of an existing
script, not a clone.

All of them are on maker-kit's harness (`scripts/lib/harness.mjs`):

- `scripts/snap.mjs` — single debug screenshot of the app. Flags:
  `--out <path>` (required), `--lang <en|ru|uk|he>` (the browser's language;
  the app picks by it), `--preset <id>` (`gyroid-sphere`, …; applied first,
  the other flags edit it), `--profile <id>`, `--caps <both|bottom>`,
  `--wall <mm>`, `--set <id>=<value>` (repeatable — a panel slider or select
  by its id, set as released; a folded card is opened first; e.g.
  `--set p_profileShape_belly=0.6`), `--eval <js>` (repeatable — prints the
  value of an expression in the page before the shot: where an element is,
  what it holds; it may act too, e.g.
  `--eval "document.getElementById('addRouteBtn').click()"`), `--width`,
  `--height`, `--wait <ms>`, `--full` (wait for the worker's full build:
  `#status[data-build="full"]`, any language), `--preview` (the production
  build). Fails on console/page errors, prints `#status`. Ids:
  `shape_profile`, `shape_caps`, `shape_wall`, `shape_height`,
  `export_resolution`; a card's switch `p_<card>_on`, its parameters
  `p_<card>_<key>`; `lfo<i>_<key>`, `route<i>_<key>`.
- `scripts/smoke.mjs` — the browser smoke in the kit's steps, each on a fresh
  page: every profile, card and preset (through the kit's dialog) builds
  watertight; undo/redo; 📄 New and its undo; 💾 + reload; the model kept
  over a reload; blocked storage's banner; the project file (⬇️, 📂 back, a
  foreign file refused); open top and the wall; the worker's
  full build; profile-shape and Fourier cards; a modulation route and ∿; a
  real STL download, its height in mm; languages (ru-RU browser, 🌐, Hebrew
  mirrored, the choice kept); no sideways scroll; the phone sheet; with
  `--preview` also offline after a first visit (the page, the worker, an
  STL from the cache) and a new `sw.js` reloading an open page.
  `--preview` rebuilds and checks the production build; `--shots <dir>`
  saves a frame per step. A failed step names itself and leaves
  `smoke-fail.png` (in `--shots` or the temp dir).
- `scripts/shot.mjs` — one screenshot per profile into `./shots` (`--out <dir>`).
- `scripts/icons.mjs` — `npm run icons`: the PWA's PNG icons (192, 512, a
  maskable 512, the 180 apple-touch-icon) from `public/icon.svg` in
  Chromium; the SVG is the only source (the template's script).
- `scripts/lib/harness.mjs` — the kit's harness on ports 5287 (dev) and 4287
  (preview) with `--strictPort`: 5173 is every project's default, and a
  stale server of another project there would be tested by mistake. With
  `--preview` it builds first, and a busy preview port is an error.
  `PLAYWRIGHT_BROWSER` gives a chromium path where Playwright misses its
  own.

## Offline (PWA)

The app is a PWA (`_conventions/pwa.md`, the template's pieces in Case
Constructor's variant): `src/sw-plugin.ts` writes `dist/sw.js`, which
precaches the build and `public/` (the worker chunk included) under the
cache `mathsculpt-<hash>` (the package name: every app on the
`github.io` origin has its own), `skipWaiting` and `clients.claim`.
`src/pwa.ts` registers it in the build only, asks for an update on every
return to the page and reloads it on `controllerchange` — the model is
kept in the browser (`mathsculpt_project`), so a reload loses only the
undo history. `public/manifest.webmanifest`; `public/icon.svg` is the only
source of the icons.

## Architectural invariants

- `src/geo/` is the pure geometry core — **never** import Three.js there (the
  same DSP-vs-Web-Audio separation as the sibling `formula-synth`). It may
  import the kit's three-free modules (`3d/mesh`, `3d/validate`).
- The core works in **relative model units**; millimetres live in the state
  (`heightMm`, `wallMm`) and the boundary converts: `buildParamsOf` turns the
  wall into model units, `toMillimetres` scales a finished mesh so its height
  is `heightMm`. The preview, the worker, the view, the checks and the STL
  work in mm; the golden tests stay in model units.
- One state, immutable: `AppState` (`src/state/schema.ts`) is what the kit's
  history holds, presets store and the panel's rows read and write
  (`set(state, value)` gives a new one). A finished edit (`final` from the
  kit's controls: a released slider, a chosen option, −/+ let go) is one
  undo step; frames of a gesture are `live`. Opening a preset is one step.
- Everything from outside (storage, a project file, a worker job) goes through
  `sanitizeState`: unknown keys dropped, values clamped to the card schema's
  ranges, never throwing. The open preset is a `PresetRef` beside the
  history, not in the state.
- The main thread builds a 96×96 preview at once; the full build (192–512²)
  runs in `src/worker/build.worker.ts` on the kit's queue: one lane, a
  waiting build replaced by a fresher one, an export (a `kept` job) never.
  A running build is not interrupted; its result is dropped when a newer
  one was ordered (`fullSerial`). The worker checks its job (`isBuildJob`)
  and cleans the state itself.
- UI-schema slider defaults (`src/formulas.ts`) must match the core's
  `DEFAULT_*_PARAMS`; a test enforces this. Card texts are dictionary keys
  (`card.<id>.*`, `param.*`, `option.*`); formula notation is `{ text }`.
- Interface texts only through the dictionaries: en is the reference
  (`Key`), ru, uk, he repeat it key for key (tsc) with the same template
  parameters; a test bans Cyrillic and Hebrew in string literals outside
  `src/i18n`. Hebrew mirrors the page (`dir="rtl"`); own CSS uses logical
  properties only. A language switch redraws the panel and every text
  without rebuilding the model.
- Storage keys are unique per app on the shared `github.io` origin:
  `mathsculpt_project` (the kit's record: the model, the open preset and
  the file's given name; written after every finished edit, undo, preset or
  name change, opened at start; a failed write is the kit's banner),
  `mathsculpt_user_presets_v1` (the kit's record, version 1; the bare list of
  old is read as version 0), `mathsculpt_lang`.

## What costs what

Measured on an M-series Mac, 2026-11-19.

| What | Cost |
|---|---|
| `npm run check` | ~3 s (464 tests) |
| `npm run smoke` / `-- --preview` | ~45 s (17 steps; the preview builds first and adds offline and the update) |
| Preview 96×96 on the main thread | ≤ 25 ms (worst preset, Voronoi stone) |
| Full build in the worker (from the job's arrival, with the checks) | 170 ms at 256², 712 ms at 512² (Voronoi stone); ~80 ms at 256² for the default vase |
| Main chunk | ~655 KB (~173 KB gzip): three is most of it; the worker 44 KB |
| CI (check, build, preview smoke) | ~1–5 min |
