# MathSculpt

**Printable surfaces from math formulas.** A web app that builds parametric
3D shapes — vases, bowls, tori, supershapes — from a stack of mathematical
displacement formulas, and exports them as binary STL ready for 3D printing.

**Open it:** <https://dmitryweiner.github.io/mathsculpt/> · How to use it:
[docs/README.md](docs/README.md).

A geometric sibling of [formula-synth](../formula-synth/): where the synth
sums formula generators into a sound wave, MathSculpt sums formula
displacements over a base surface and prints the result.

## Features

- **Carriers**: solids of revolution (12 profiles — vase, amphora, bottle,
  bowl, goblet, Bézier, Gaussian mixture, superellipse, catenary, tractrix,
  stem and bowl, smooth piecewise — and a Fourier-series profile r(z)),
  sphere, torus, superellipsoid, Gielis supershape.
- **Editable profile shape**: the profiles have base/belly/neck sliders to
  widen or narrow the base, body and neck; Fourier and abstract shapes
  expose their own parameters.
- **Displacement stack** (applied along surface normals): ripples,
  Lissajous interference, real spherical harmonics Yₗₘ, seeded simplex fBm
  noise, LFO waves, TPMS fields, cellular/Voronoi and domain-warped noise,
  phyllotaxis, localized Gaussian lobes, logistic chaos, knurling, polygonal,
  superformula and star-interference relief.
- **Deformers**: twist, taper, bulge/pinch, bend, shear, axial waves, elliptic
  sections, neck flare, corrugation, k-fold symmetry, Laplacian/Taubin
  smoothing and quantize.
- **Spatial LFO mod matrix** — modulators are functions of *coordinates*
  (height z, azimuth θ, spiral z+k·θ, radius, distance), not time. The
  preview is static and deterministic; a phase slider replaces time.
- **Live preview**: a 96×96 grid rebuilds instantly on the main thread; the
  full-resolution mesh (up to 512×512) is built in a Web Worker with a
  progress bar. A 2D silhouette graph shows the profile r(z).
- **Print-ready export**: watertight, consistently oriented binary STL in
  millimetres at the height you set (welded seams, fan caps). Revolution
  vessels get a flat base for bed adhesion. Two open-top modes: a zero-wall
  shell (slicer vase mode) or a real hollow vessel with a wall thickness in
  mm, giving a watertight solid. An export gate blocks meshes a slicer would
  not print; warnings for steep overhangs (>60°) and possible
  self-intersections.
- **Presets**: 20 built-in ones and your own (💾), renamed and deleted in the
  presets dialog, kept in the browser.
- **Undo and redo**: every finished edit is one step; ↶ ↷, Ctrl/⌘+Z on any
  keyboard layout.
- **English, Russian, Ukrainian and Hebrew** (the page mirrors right to left);
  the browser's language by default, 🌐 to switch.
- On a phone the panel is a bottom sheet over the model.
- **Works offline** after the first visit and installs as an app (PWA); an
  update arrives by itself on return to the page, and the model is kept.

## Development

```bash
npm ci
npm run dev       # Vite dev server
npm run check     # tsc (TypeScript 7) + oxlint + prettier + vitest (437 tests)
npm run smoke     # the browser smoke: every profile/card/preset, undo, presets,
                  # languages, the phone sheet, a real STL in mm; --preview for the build
npm run shot      # screenshots of every profile → ./shots
npm run build     # production build → ./dist (GitHub Pages by Actions)
```

Golden geometry tests pin the exact output of every profile; regenerate
consciously with `UPDATE_GOLDEN=1 npx vitest run tests/golden.test.ts`.

## Architecture

MathSculpt is built on [maker-kit](https://github.com/dmitryweiner/maker-kit),
the shared pieces of the 3D-printing tools: the panel and its controls,
undo, storage, presets, the phone sheet, the progress bar, the worker queue,
STL, the export gate, the 3D view and the smoke harness.

```
src/geo/       pure geometry core (no Three.js), in relative model units:
               grids, shapes, profiles, displacements, deformers, spatial
               LFOs, overhangs; millimetres at the boundary (millimetres.ts)
src/worker/    the full build's job on the kit's worker queue
src/render/    the kit's 3D view with the app's material
src/state/     the serializable state, sanitize, presets, user presets
src/ui/        the panel's rows and cards, modulation, verdicts, profile graph
src/i18n/      en (reference), ru, uk, he — over the kit's strings
```

The geometry core never imports Three.js — the same separation as DSP vs
Web Audio in formula-synth.

## License

GPL-3.0-or-later — see [LICENSE](LICENSE).
