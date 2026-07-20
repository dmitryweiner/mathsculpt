// Встроенные пресеты: частичные состояния поверх дефолтов (см. state/schema).
// Каждый пресет проверяется тестом: sanitize-стабильность и watertight-меш.
import type { PartialAppState } from './state/schema';

export interface BuiltinPreset {
  name: string;
  state: PartialAppState;
}

export const PRESETS: BuiltinPreset[] = [
  {
    name: 'Classic vase',
    state: {
      profile: 'vase',
      displace: { ripples: { on: true, params: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 } } },
    },
  },
  {
    name: 'Twisted column',
    state: {
      profile: 'bottle',
      displace: { waves: { on: true, params: { amp: 0.025, shape: 0, freqU: 10, freqV: 0, phase: 0 } } },
      deform: { twist: { on: true, params: { turns: 0.5 } } },
    },
  },
  {
    name: 'Faceted tumbler',
    state: {
      profile: 'goblet',
      displace: { waves: { on: true, params: { amp: 0.02, shape: 2, freqU: 7, freqV: 0, phase: 0 } } },
    },
  },
  {
    name: 'Stone amphora',
    state: {
      profile: 'amphora',
      displace: { noise: { on: true, params: { amp: 0.035, scale: 3.5, octaves: 4, seed: 42 } } },
    },
  },
  {
    name: 'Wicker bowl',
    state: {
      profile: 'bowl',
      displace: { lissajous: { on: true, params: { amp: 0.022, freqU: 14, freqV: 8, phaseU: 0, phaseV: 0 } } },
    },
  },
  {
    name: 'Harmonic goblet',
    state: {
      profile: 'goblet',
      displace: { harmonics: { on: true, params: { amp: 0.05, l: 6, m: 4, phase: 0 } } },
    },
  },
  {
    name: 'Spiral shell',
    state: {
      profile: 'amphora',
      displace: { ripples: { on: true, params: { amp: 0.04, freqU: 3, freqV: 8, phase: 0 } } },
      deform: { twist: { on: true, params: { turns: 0.35 } } },
    },
  },
  {
    name: 'Hand-thrown pot',
    state: {
      profile: 'vase',
      displace: {
        ripples: { on: true, params: { amp: 0.012, freqU: 0, freqV: 18, phase: 0 } },
        noise: { on: true, params: { amp: 0.02, scale: 5, octaves: 3, seed: 7 } },
      },
      deform: { symmetry: { on: true, params: { k: 1, mix: 0 } } },
    },
  },
  {
    name: 'Fading flutes',
    state: {
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
  },
  {
    name: 'Gyroid sphere',
    state: {
      profile: 'sphere',
      displace: {
        ripples: { on: false, params: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 } },
        gyroid: { on: true, params: { amp: 0.035, scale: 16 } },
      },
    },
  },
  {
    name: 'Pixel torus',
    state: {
      profile: 'torus',
      shapes: { torus: { R: 0.35, r: 0.16 } },
      displace: {
        ripples: { on: false, params: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 } },
        bytebeat: { on: true, params: { amp: 0.02, cells: 24, recipe: 2 } },
      },
    },
  },
  {
    name: 'Supershape flower',
    state: {
      profile: 'supershape',
      shapes: { supershape: { m1: 6, n11: 1, n12: 7, n13: 8, m2: 4, n21: 10, n22: 10, n23: 10 } },
      displace: { ripples: { on: false, params: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 } } },
    },
  },
  {
    name: 'Rounded dice',
    state: {
      profile: 'superellipsoid',
      shapes: { superellipsoid: { e1: 0.35, e2: 0.35 } },
      displace: { ripples: { on: false, params: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 } } },
    },
  },
  {
    name: 'Low-poly goblet',
    state: {
      profile: 'goblet',
      displace: { ripples: { on: false, params: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 } } },
      deform: { quantize: { on: true, params: { step: 0.035 } } },
    },
  },
];
