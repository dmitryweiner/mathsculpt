// English dictionary: the reference. `Key` is its keys; the other languages
// (plans/PLAN-MAKER-KIT.md, m5-i18n) will repeat it key for key. The kit's
// strings (`kit.*`) are spread in: its components translate by them.
//
// Templates are maker-kit's core/format: `{name}` is a parameter,
// `{n|form|form}` picks a word by the number n (one/other in English).

import { kitEn } from 'maker-kit/i18n/index';

export const en = {
  ...kitEn,
  'app.title': 'MathSculpt — printable surfaces from formulas',

  // --- presets: the built-in ones by id (core/presets), the auto name of a saved one ---
  'preset.classic-vase.name': 'Classic vase',
  'preset.twisted-column.name': 'Twisted column',
  'preset.faceted-tumbler.name': 'Faceted tumbler',
  'preset.stone-amphora.name': 'Stone amphora',
  'preset.wicker-bowl.name': 'Wicker bowl',
  'preset.harmonic-goblet.name': 'Harmonic goblet',
  'preset.spiral-shell.name': 'Spiral shell',
  'preset.hand-thrown-pot.name': 'Hand-thrown pot',
  'preset.fading-flutes.name': 'Fading flutes',
  'preset.gyroid-sphere.name': 'Gyroid sphere',
  'preset.pixel-torus.name': 'Pixel torus',
  'preset.supershape-flower.name': 'Supershape flower',
  'preset.rounded-dice.name': 'Rounded dice',
  'preset.low-poly-goblet.name': 'Low-poly goblet',
  'preset.fibonacci-bloom.name': 'Fibonacci bloom',
  'preset.voronoi-stone.name': 'Voronoi stone',
  'preset.marble-flow.name': 'Marble flow',
  'preset.neovius-vessel.name': 'Neovius vessel',
  'preset.chaotic-knurl.name': 'Chaotic knurl',
  'preset.star-polygon.name': 'Star polygon',
  'presets.auto': 'Preset',
  'presets.prompt': 'Preset name:',
};
