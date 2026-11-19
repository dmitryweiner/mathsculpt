# AGENTS.md — rules for agents

Working notes on the repository are in `CLAUDE.md`; plans are in `plans/`
(their index is in `CLAUDE.md`, section "Plans"). The shared conventions of
every project here are `~/projects/CLAUDE.md` and `~/projects/_conventions/`;
this file and `CLAUDE.md` win where they say otherwise.

## Language

Code comments, test titles, README, `docs/`, `CLAUDE.md` and this file are
in English, as the conventions say (the comments were translated from
Russian on 2026-11-19). `plans/` stay in Russian, as they were written.
Conversations with the user are in Russian.

## Commits and pull requests

A plan's group of work goes on its **own branch**, never on `main`, and gets
a pull request (CI runs on it). The user merges; never merge, rebase onto or
push to `main` (every push to `main` deploys to GitHub Pages). A PR may be
opened before the previous one is merged: the branch then starts from the
previous one, the PR's base is `main`, and they are merged in order with
merge commits. Before each commit: `npm run check`, and `npm run smoke` for
anything a browser shows. TDD: red → green → refactor; golden tests pin the
geometry. Selectors of the smoke change in a commit of their own.

## maker-kit

The panel, undo, storage, presets, the sheet, the dialog, the banner, the
progress bar, the message list, the language picker, the worker queue, STL,
the export gate and the 3D view are maker-kit's (`~/projects/maker-kit`, by
tag). Never copy a kit piece into the app or patch it in `node_modules`: a
fix or a missing case is a kit PR with its test and a patch tag, then the
app moves to the tag (`~/projects/_conventions/3d-tools.md`).

## Documentation

User documentation lives in `docs/` (index: `docs/README.md`). A feature, a
parameter, its range or default, or an export mode added or changed —
update the matching part of `docs/` in the same commit.

## Translations

New visible text lands in all four dictionaries (`src/i18n/en.ts`, `ru.ts`,
`uk.ts`, `he.ts`) in the same commit. English is the reference; formula
notation stays as text (`{ text: 'n₁' }`), never translated.
