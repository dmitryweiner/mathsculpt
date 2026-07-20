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
];
