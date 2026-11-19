# MathSculpt — how to use it

MathSculpt builds a printable surface from formulas: you pick a carrier
shape, stack displacements and deformers on it, optionally drive their
sliders with spatial LFOs, and download a binary STL in millimetres.

## The screen

The panel sits beside the model on a wide screen. On a phone it is a sheet
over the model's lower part: its handle (or a tap on the model) lowers it,
**Settings** raises it again. Drag the model to turn it, pinch or scroll to
zoom; the grid under it is a 200 × 200 mm printer bed with 1 cm cells.

The top bar holds the presets button (it shows the open preset's name, with
● once you have changed the model), 📄 to start a new model from the
defaults (one undo step: ↶ brings the previous one back), 💾 to save the
model as a preset of yours, 📂 and ⬇️ to open and save the model as a file,
↶ ↷ to undo and redo, and 🌐 for the language.

## The panel, top to bottom

1. **Shape**
   - **Profile** — the carrier: a solid of revolution (vase, amphora,
     bottle, bowl, goblet, Bézier curve, Gaussian mixture, superellipse,
     catenary, tractrix, stem and bowl, smooth piecewise), a Fourier
     profile r(z) you set by its harmonics, or a sphere, torus,
     superellipsoid or supershape.
   - **Mode** — *Solid (closed)*, or *Open top (hollow vase)*.
   - **Wall** — for an open top of a solid of revolution only: the wall
     thickness in mm. At 0 the model is a zero-wall shell for the slicer's
     vase mode; above 0 it is a real hollow vessel with a flat floor.
   - **Height** — the printed height in mm; the model is scaled to it.
   - The graph under the rows is the profile's silhouette r(z).
2. **The carrier's card** — only the selected carrier's: *Profile shape*
   (widen or narrow the base, belly and neck of a profile), *Fourier
   profile*, or the parameters of the torus, superellipsoid or supershape.
3. **Displacements** — reliefs added along the surface normals: ripples,
   Lissajous weave, spherical harmonics, fBm noise, waves, gyroid, bytebeat
   relief, Gaussian rings, phyllotaxis, cellular relief, warped noise, the
   TPMS family, logistic ribs, superformula section, diamond knurl, polygon
   facets, star interference. Any number of them at once; they add up.
4. **Deformers** — bend the whole surface after the reliefs: twist, taper,
   k-fold symmetry, smoothing, quantize, bulge/pinch, bend, shear, axial
   wave, elliptic section, neck flare, corrugation, Taubin smoothing.
5. **Modulation** — three spatial LFOs and the routes from them to any
   slider of the displacement and deformer cards (below).
6. **STL export** — the resolution of the full build, the **Export STL**
   button, the status line and the messages.

Each displacement and deformer is switched on by **On**, the first row of
its card; the card's head only folds and unfolds it. Every slider has an
exact field next to it and − / + buttons (hold one to repeat).

## Spatial LFOs

An LFO here is not a function of time but of a point on the surface: its
**Source** is the height z, the angle θ around the axis, a spiral z+k·θ,
the radius or the distance from the centre. Its **Shape** (sine, triangle,
saw, square, sample-and-hold), **Rate** and **Phase** set how it varies.
A **route** sends an LFO to one slider of a card with a **Depth** from −1
to 1: the slider's value then changes over the surface — ripples that grow
towards the rim, a twist that tightens along a spiral. A modulated slider
is marked ∿.

## Preview and the full build

The model is rebuilt at 96 × 96 on every move of a slider. Shortly after
the last edit the full build (192² to 512², the **Full res** row) replaces
it; the bar over the view shows its stages. The status line says how many
triangles, whether the solid is closed (watertight ✓), which build is
shown and how long it took.

## Export

**Export STL** downloads a binary STL in millimetres, named after the open
preset (or the profile). The file is the full build at the chosen
resolution; when the full build is not ready yet, it is built for the
export, with the bar shown at once.

The messages under the button say what is wrong with the mesh:

- **Blockers** (red) stop the export: a mesh with broken coordinates or
  triangles, an empty or flat one, one that is not closed or is inside out
  when it should be a solid, or one with more than 1 % degenerate
  triangles.
- **Warnings** (yellow) do not: overhangs steeper than 60° over more than
  2 % of the surface (hard to print without supports), and a displacement
  amplitude larger than the profile's radius (the surface may cut through
  itself).

## Presets and undo

The presets button opens the dialog: your presets first (rename one in its
field, ↗ to open it, the bin and then **Delete?** to remove it), then the
built-in ones. 💾 saves the model under a name; a name you already have
replaces that preset.

The model itself — with the open preset and the name you gave its file —
is kept in this browser after every edit: closing the tab or reloading the
page brings it back as it was. Presets are kept in the browser too. If the
browser refuses to keep them (a private window, full storage) a banner
under the top bar says so; save the model to a file with ⬇️ then.

Every finished edit — a released slider, a chosen option, a ticked box,
a preset opened — is one undo step: ↶ ↷, or Ctrl/⌘+Z and Ctrl/⌘+Shift+Z
(Ctrl+Y) on any keyboard layout.

## The model as a file

⬇️ saves the model as a project file, `<name>.mathsculpt.json`, under the
name you give it; the name then shows on the presets button. 📂 opens such a
file back — on another machine or browser too — as one undo step. A file
of another app, a broken one or one from a newer version of MathSculpt is
refused with the reason in the messages, and the model stays as it was.

## Languages

English, Russian, Ukrainian and Hebrew. The app opens in your browser's
language if it has it, English otherwise; 🌐 switches, and the choice is
remembered. In Hebrew the whole page runs right to left.
