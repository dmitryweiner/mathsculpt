# CLAUDE.md — working notes for this repo

## Tooling: prefer permanent scripts over throwaway ones

Do **not** write a temporary Playwright/Node script via `cat > tmp.mjs <<EOF`
every time something needs to be checked or screenshotted — regenerating the
same boilerplate each cycle is a big waste of tokens. Instead, put reusable
tooling in `scripts/` **once**, give it CLI flags, and call it thereafter.
Extend an existing script with a new flag rather than cloning it.

Existing helpers:

- `scripts/snap.mjs` — single debug screenshot of the app. Flags:
  `--out <path>` (required), `--profile <id>`, `--preset <name>`,
  `--hash <token>`, `--caps <both|bottom>`, `--wall <mm>`, `--width`,
  `--height`, `--wait <ms>`, `--full` (wait for the Web Worker full-res build).
  Auto-starts the dev server, captures console/page errors, prints `#status`.
- `scripts/smoke.mjs` — headless smoke over every profile/card/preset + worker,
  modulation, wall/open-top, share round-trip. `--preview` runs the prod build.
- `scripts/shot.mjs` — one screenshot per profile into `./shots`.

When a new one-off check is needed more than once, add it to `snap.mjs`/`smoke.mjs`
as a flag or step instead of spawning a temp file.

## Build / test commands

```bash
npm run check     # tsc + eslint (bans `as` casts) + vitest
npm run smoke     # browser smoke (see above); --preview for prod build
npm run shot      # profile screenshots → ./shots
npm run build     # production build → ./docs (GitHub Pages)
```

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
