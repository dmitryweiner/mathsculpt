# MathSculpt

**Printable surfaces from math formulas.** A web app that builds parametric
3D shapes — vases, bowls, tori, supershapes — from a stack of mathematical
displacement formulas, and exports them as binary STL ready for 3D printing.

A geometric sibling of [formula-synth](../formula-synth/): where the synth
sums formula generators into a sound wave, MathSculpt sums formula
displacements over a base surface and prints the result.

## Features

- **Carriers**: solids of revolution (5 preset profiles + Fourier-series
  profile r(z)), sphere, torus, superellipsoid, Gielis supershape.
- **Displacement stack** (applied along surface normals): ripples,
  Lissajous interference, real spherical harmonics Yₗₘ, seeded simplex fBm
  noise, LFO waves (triangle/saw/square), gyroid pattern, bytebeat relief.
- **Deformers**: twist, taper, k-fold symmetry, Laplacian smoothing, quantize.
- **Spatial LFO mod matrix** — modulators are functions of *coordinates*
  (height z, azimuth θ, spiral z+k·θ, radius, distance), not time. The
  preview is static and deterministic; a phase slider replaces time.
- **Live preview**: 96×96 grid rebuilds instantly on the main thread; the
  full-resolution mesh (up to 512×512) is built in a Web Worker with a
  progress bar.
- **Print-ready export**: watertight, consistently oriented binary STL in
  millimetres (welded seams, fan caps). Warnings for steep overhangs (>60°)
  and possible self-intersections.
- Presets, shareable `#s=…` links (base64url state), user presets in
  localStorage.

## Development

```bash
npm install
npm run dev       # Vite dev server
npm run check     # tsc + eslint + vitest (174 tests)
npm run smoke     # headless-Chromium smoke: every profile/card/preset builds
                  # without console errors, STL export works
npm run shot      # screenshots of every profile → ./shots
npm run build     # production build → ./docs (GitHub Pages)
```

Golden geometry tests pin the exact output of every profile; regenerate
consciously with `UPDATE_GOLDEN=1 npm test`.

## Architecture

```
src/geo/       pure geometry core (no Three.js): grids, shapes, profiles,
               displacements, deformers, spatial LFOs, validation, STL
src/worker/    full-resolution builds with progress
src/render/    thin Three.js layer (scene, lights, orbit camera)
src/state/     serializable state v1, sanitize, share links, user presets
src/ui/        cards, mod matrix panel, profile graph, DOM helpers
```

The geometry core never imports Three.js — the same separation as DSP vs
Web Audio in formula-synth.
