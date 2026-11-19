// The built-in presets: partial states over the defaults (see state/schema).
// A test checks every preset: stable under sanitize, a watertight mesh.
//
// A preset is known by its id (the kit's `core/presets`): its name is in the
// dictionaries (`preset.<id>.name`), one per language. Presets set no height
// or wall — an opened preset takes the defaults.
import type { BuiltInPreset } from 'maker-kit/core/presets';
import type { AppState, PartialAppState } from './schema';
import { completeState, defaultState } from './schema';

/** What each preset changes in the default model, in the list's order. */
export const PRESET_STATES: Readonly<Record<string, PartialAppState>> = {
  'classic-vase': {
    profile: 'vase',
    displace: { ripples: { on: true, params: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 } } },
  },
  'twisted-column': {
    profile: 'bottle',
    displace: { waves: { on: true, params: { amp: 0.025, shape: 0, freqU: 10, freqV: 0, phase: 0 } } },
    deform: { twist: { on: true, params: { turns: 0.5 } } },
  },
  'faceted-tumbler': {
    profile: 'goblet',
    displace: { waves: { on: true, params: { amp: 0.02, shape: 2, freqU: 7, freqV: 0, phase: 0 } } },
  },
  'stone-amphora': {
    profile: 'amphora',
    displace: { noise: { on: true, params: { amp: 0.035, scale: 3.5, octaves: 4, seed: 42 } } },
  },
  'wicker-bowl': {
    profile: 'bowl',
    displace: { lissajous: { on: true, params: { amp: 0.022, freqU: 14, freqV: 8, phaseU: 0, phaseV: 0 } } },
  },
  'harmonic-goblet': {
    profile: 'goblet',
    displace: { harmonics: { on: true, params: { amp: 0.05, l: 6, m: 4, phase: 0 } } },
  },
  'spiral-shell': {
    profile: 'amphora',
    displace: { ripples: { on: true, params: { amp: 0.04, freqU: 3, freqV: 8, phase: 0 } } },
    deform: { twist: { on: true, params: { turns: 0.35 } } },
  },
  'hand-thrown-pot': {
    profile: 'vase',
    displace: {
      ripples: { on: true, params: { amp: 0.012, freqU: 0, freqV: 18, phase: 0 } },
      noise: { on: true, params: { amp: 0.02, scale: 5, octaves: 3, seed: 7 } },
    },
    deform: { symmetry: { on: true, params: { k: 1, mix: 0 } } },
  },
  'fading-flutes': {
    profile: 'vase',
    displace: { ripples: { on: true, params: { amp: 0.03, freqU: 14, freqV: 0, phase: 0 } } },
    mod: {
      lfos: [
        { source: 'z', shape: 'saw', rate: 1, phase: 0.5, k: 1 },
        { source: 'z', shape: 'sine', rate: 2, phase: 0, k: 1 },
        { source: 'z', shape: 'sine', rate: 2, phase: 0, k: 1 },
      ],
      routes: [{ src: 0, card: 'ripples', param: 'amp', depth: -0.35 }],
    },
  },
  'gyroid-sphere': {
    profile: 'sphere',
    displace: {
      ripples: { on: false, params: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 } },
      gyroid: { on: true, params: { amp: 0.035, scale: 16 } },
    },
  },
  'pixel-torus': {
    profile: 'torus',
    shapes: { torus: { R: 0.35, r: 0.16 } },
    displace: {
      ripples: { on: false, params: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 } },
      bytebeat: { on: true, params: { amp: 0.02, cells: 24, recipe: 2 } },
    },
  },
  'supershape-flower': {
    profile: 'supershape',
    shapes: { supershape: { m1: 6, n11: 1, n12: 7, n13: 8, m2: 4, n21: 10, n22: 10, n23: 10 } },
    displace: { ripples: { on: false, params: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 } } },
  },
  'rounded-dice': {
    profile: 'superellipsoid',
    shapes: { superellipsoid: { e1: 0.35, e2: 0.35 } },
    displace: { ripples: { on: false, params: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 } } },
  },
  'low-poly-goblet': {
    profile: 'goblet',
    displace: { ripples: { on: false, params: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 } } },
    deform: { quantize: { on: true, params: { step: 0.035 } } },
  },
  'fibonacci-bloom': {
    profile: 'gaussian-profile',
    displace: {
      ripples: { on: false },
      phyllotaxis: { on: true, params: { amp: 0.025, turns: 13, slope: 8, phase: 0 } },
      gaussian: { on: true, params: { amp: 0.025, center: 0.72, width: 0.18, lobes: 8, phase: 0 } },
    },
  },
  'voronoi-stone': {
    profile: 'catenary',
    displace: {
      ripples: { on: false },
      cellular: { on: true, params: { amp: 0.025, scale: 9, seed: 17, sharpness: 2.4 } },
    },
    deform: { flare: { on: true, params: { amount: 0.2, start: 0.78, power: 1.5 } } },
  },
  'marble-flow': {
    profile: 'bezier',
    displace: {
      ripples: { on: false },
      warp: { on: true, params: { amp: 0.035, scale: 5, warp: 0.8, seed: 23 } },
    },
    deform: { axial: { on: true, params: { amp: 0.04, freq: 1.5, phase: 0 } } },
  },
  'neovius-vessel': {
    profile: 'superellipse-profile',
    displace: {
      ripples: { on: false },
      tpms: { on: true, params: { amp: 0.025, scale: 12, family: 4, sharpness: 0.8 } },
    },
    deform: { elliptic: { on: true, params: { ratio: 1.2, phase: 0.4 } } },
  },
  'chaotic-knurl': {
    profile: 'piecewise',
    displace: {
      ripples: { on: false },
      logistic: { on: true, params: { amp: 0.018, rate: 3.86, seed: 0.37, layers: 32, freqU: 7 } },
      knurl: { on: true, params: { amp: 0.012, freqU: 14, freqV: 9, sharpness: 2 } },
    },
    deform: { taubin: { on: true, params: { iterations: 1, lambda: 0.5, mu: -0.53 } } },
  },
  'star-polygon': {
    profile: 'stem-bowl',
    displace: {
      ripples: { on: false },
      polygon: { on: true, params: { amp: 0.04, sides: 7, roundness: 0.9, phase: 0 } },
      star: { on: true, params: { amp: 0.012, order: 7, freqV: 4, layers: 2, phase: 0 } },
      superformula: { on: true, params: { amp: 0.02, m: 7, n1: 1, n2: 7, n3: 8, mix: 0.6 } },
    },
    deform: { corrugate: { on: true, params: { amp: 0.025, folds: 14, phase: 0 } } },
  },
};

/** 📄 New opens this preset: the default model, not in the presets list (the kit's rule). */
export const BLANK_ID = 'blank';

export const PRESETS: readonly BuiltInPreset<AppState>[] = [
  { id: BLANK_ID, build: defaultState, listed: false },
  ...Object.entries(PRESET_STATES).map(([id, partial]) => ({ id, build: () => completeState(partial) })),
];

export function presetById(id: string): BuiltInPreset<AppState> | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
