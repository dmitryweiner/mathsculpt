# CLAUDE.md — working notes for this repo

## Tooling: prefer permanent scripts over throwaway ones

Do **not** write a temporary Playwright/Node script via `cat > tmp.mjs <<EOF`
every time something needs to be checked or screenshotted — regenerating the
same boilerplate each cycle is a big waste of tokens. Instead, put reusable
tooling in `scripts/` **once**, give it CLI flags, and call it thereafter.
Extend an existing script with a new flag rather than cloning it.

Existing helpers:

- `scripts/snap.mjs` — single debug screenshot of the app. Flags:
  `--out <path>` (required), `--profile <id>`, `--preset <id>` (`gyroid-sphere`, …),
  `--hash <token>`, `--caps <both|bottom>`, `--wall <mm>`,
  `--set <id>=<value>` (repeatable — a panel slider or select by its id, set
  as released; a folded card is opened first; e.g.
  `--set p_profileShape_belly=0.6`), `--eval <js>` (repeatable — prints the
  value of an expression in the page before the shot: where an element is,
  what it holds; it may act too, e.g.
  `--eval "document.getElementById('addRouteBtn').click()"`), `--width`,
  `--height`, `--wait <ms>`, `--full` (wait for the Web Worker full-res
  build). Auto-starts the dev server, captures console/page errors, prints
  `#status`. Ids: `shape_profile`, `shape_caps`, `shape_wall`,
  `shape_height`, `export_resolution`; a card's switch `p_<card>_on`, its
  parameters `p_<card>_<key>`; `lfo<i>_<key>`, `route<i>_<key>`.
- `scripts/smoke.mjs` — headless smoke over every profile/card/preset + worker,
  modulation, wall/open-top, profile-shape, share round-trip. `--preview` runs
  the prod build.
- `scripts/shot.mjs` — one screenshot per profile into `./shots`.

When a new one-off check is needed more than once, add it to `snap.mjs`/`smoke.mjs`
as a flag or step instead of spawning a temp file.

## Plans

Plans live in `plans/`. A new plan is `plans/PLAN-<TOPIC>.md` and a line
here.

- `plans/PLAN.md` — the app's architecture and milestones (done).
- `plans/IMPLEMENTATION_PLAN.md` — the expansion: formula registry, export
  gate, undo, hollow vessels, new formulas (done).
- `plans/PLAN-MAKER-KIT.md` — the move to maker-kit (M5), PR by PR; in
  progress.

## Build / test commands

Node — the version in `.node-version` (24); check `node -v`.

```bash
npm run check     # tsc (TypeScript 7) + oxlint --type-aware (bans `as` casts) + prettier --check + vitest
npm run format    # prettier --write (not *.md and golden: .prettierignore)
npm run smoke     # browser smoke (dev :5287); --preview for the prod build (:4287) — build first
npm run shot      # profile screenshots → ./shots
npm run build     # production build → ./dist
```

The lint is oxlint (`.oxlintrc.json`): typescript-eslint does not support
TS 7. Each rule switched off there says why. The prettier reformatting is
in `.git-blame-ignore-revs` (`git config blame.ignoreRevsFile
.git-blame-ignore-revs`).

GitHub Pages is published by `.github/workflows/deploy.yml` on every push
to `main`: `npm ci`, `npm run check`, `npm run build`, the smoke on the
production build, then `dist/`. A PR runs the same without publishing.
The build is not committed (`dist/` is ignored).

The smoke scripts use the ports 5287 (dev) and 4287 (preview) with
`--strictPort`: 5173 is every project's default, and a stale server of
another project there would be tested by mistake. The old scripts kill
`npx`, and `vite preview` under it may survive on 4287: stop it before the
next `--preview` (fixed when the scripts move to maker-kit's harness,
m5-harness).

Golden geometry tests pin exact per-profile output; regenerate consciously with
`UPDATE_GOLDEN=1 npx vitest run tests/golden.test.ts` after an intentional
geometry change.

## Architecture notes

- `src/geo/` is the pure geometry core — **never** import Three.js there (same
  DSP-vs-WebAudio separation as the sibling `formula-synth` project). The core
  works in **relative model units**; millimetres live only in the UI/state and
  are converted at the boundary (`main.ts`, export scale, wall-thickness).
- Heavy full-resolution builds run in `src/worker/build.ts`; the main thread
  builds a 96×96 preview instantly. When params change, the in-flight worker is
  killed so a stale `done` can't overwrite a fresher preview.
- UI-schema slider defaults (`src/formulas.ts`) must match core
  `DEFAULT_*_PARAMS`; a test enforces this.
