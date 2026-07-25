# MathSculpt — implementation plan

This plan covers the agreed expansion while keeping every intermediate commit
buildable and old share links/user presets readable.

## 1. Formula registry and state safety

- Make card parameter metadata the canonical source for defaults, ranges,
  select options and modulation targets.
- Clamp imported share-link/localStorage parameters to their declared ranges;
  discard unknown keys and invalid select values.
- Add registry tests so a new formula cannot be registered only in the UI or
  only in the geometry core.

## 2. Mesh diagnostics and safe export

- Extend reports with index validity, orientation, bounding-box extents and
  degenerate-triangle ratio.
- Show orientation, degenerate geometry and physical STL dimensions in the UI.
- Refuse export for non-finite, empty, zero-height or topologically invalid
  solid meshes. Offer an explicit confirmation for printable warnings.
- Reverse a wholly inward closed mesh automatically instead of exporting it
  inside-out.

## 3. Undo / Redo

- Store bounded snapshots of serializable application state.
- Coalesce continuous slider input into one history operation.
- Add toolbar buttons and keyboard shortcuts (`Ctrl/Cmd+Z`,
  `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y`).
- Do not add history entries while restoring a snapshot.

## 4. Hollow vessels

- For surfaces of revolution, construct the inner wall radially from each
  deformed ring instead of applying a generic vertex-normal offset.
- Clamp wall thickness per ring and preserve a flat cavity floor.
- Report the achieved minimum wall thickness and warn when the requested wall
  had to be reduced.
- Keep normal-offset hollowing only as a future fallback for non-revolution
  carriers.

## 5. Displacement formulas

Implement and test:

1. Gaussian rings / localized lobes
2. Phyllotaxis / Fibonacci spirals
3. Cellular (seamless 3D Voronoi) relief
4. Domain-warped noise
5. TPMS family: Gyroid, Schwarz P, Schwarz D, Neovius
6. Logistic-map ribs
7. Superformula cross-section
8. Knurling / diamond weave
9. Exact polygonal/faceted radius
10. Star/interference ornament

Each formula receives finite-output, seam, range, serialization and mesh
integration tests plus at least one curated preset where useful.

## 6. Profiles and deformers

Profiles:

- editable cubic Bezier/B-spline profile
- Gaussian-mixture profile
- superellipse profile
- catenary and tractrix profiles
- parametric stem-and-bowl profile
- piecewise profile with smooth joins

Deformers:

- bulge/pinch
- bend
- shear/slant
- axial wave
- elliptic cross-section
- neck flare
- corrugation
- Taubin smoothing

The first release exposes formula-based profiles as parameter cards. Direct
dragging of spline points remains separate UI work.

## 7. Verification and release

- Unit/property/golden tests for every geometry addition.
- Browser smoke over every new card, profile and preset.
- Update README, formula descriptions and expected test counts.
- Run `npm run check`, production build and preview smoke before release.

