// Spatial LFOs + the modulation matrix (the ideas of formula-synth's
// src/dsp/mod.ts). An LFO's argument is not time but a coordinate of the
// surface point: z (v), the azimuth θ, a spiral z+k·θ, the radius from the
// axis, the distance from the centre. An LFO's value is a pure function of
// the point: the result is deterministic, the preview static, and a phase
// slider stands in for time.

import { DISPLACE_CARDS, DEFORM_CARDS } from '../formulas';

export type LfoShape = 'sine' | 'triangle' | 'saw' | 'square' | 'random'; // random = S&H
export type LfoSource = 'z' | 'theta' | 'spiral' | 'radius' | 'dist';

export interface SpatialLfoDef {
  source: LfoSource;
  shape: LfoShape;
  /** periods over the coordinate's range (whole ones for θ/spiral → seamless) */
  rate: number;
  /** 0–1, a share of the cycle — what stands in for time */
  phase: number;
  /** a spiral: the coordinate = v + k·θ/2π */
  k: number;
}

export interface ModRoute {
  /** the LFO's index in the pool */
  src: number;
  /** the id of the receiving card (a displacement or a deformer) */
  card: string;
  /** the card parameter's key */
  param: string;
  /** bipolar, a share of the range [-1, 1] */
  depth: number;
}

export interface ModState {
  lfos: SpatialLfoDef[];
  routes: ModRoute[];
}

export const LFO_COUNT = 3;

export const LFO_SHAPES: readonly LfoShape[] = ['sine', 'triangle', 'saw', 'square', 'random'];
export const LFO_SOURCES: readonly LfoSource[] = ['z', 'theta', 'spiral', 'radius', 'dist'];

export function isLfoShape(v: unknown): v is LfoShape {
  return typeof v === 'string' && LFO_SHAPES.some((s) => s === v);
}

export function isLfoSource(v: unknown): v is LfoSource {
  return typeof v === 'string' && LFO_SOURCES.some((s) => s === v);
}

export function defaultLfo(): SpatialLfoDef {
  return { source: 'z', shape: 'sine', rate: 2, phase: 0, k: 1 };
}

export function defaultModState(): ModState {
  return { lfos: Array.from({ length: LFO_COUNT }, defaultLfo), routes: [] };
}

// --- The allowed modulation targets: card.parameter → range (clamped) ---
// The ranges must match the UI schema's sliders (a test checks).
// exp — modulation in octaves for "frequency" parameters with min > 0.
export interface ModTarget {
  card: string;
  param: string;
  range: readonly [number, number];
  exp?: boolean;
}

const NON_MODULATED = new Set(['harmonics.l', 'harmonics.m', 'noise.octaves', 'noise.seed', 'symmetry.k', 'smooth.iterations']);

export const MOD_TARGETS: readonly ModTarget[] = [...DISPLACE_CARDS, ...DEFORM_CARDS].flatMap((card) =>
  card.sliders.flatMap((slider) => {
    if (NON_MODULATED.has(`${card.id}.${slider.k}`)) return [];
    const exp = slider.min > 0 && (slider.k === 'scale' || slider.k === 'power' || slider.k === 'step');
    return [
      {
        card: card.id,
        param: slider.k,
        range: [slider.min, slider.max] as const,
        ...(exp ? { exp: true } : {}),
      },
    ];
  }),
);

export function findModTarget(card: string, param: string): ModTarget | undefined {
  return MOD_TARGETS.find((t) => t.card === card && t.param === param);
}

const TWO_PI = 2 * Math.PI;

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

// A deterministic hash of an integer → [0,1) (one mulberry32 step) — for S&H.
function hash01(n: number): number {
  let a = (n | 0) >>> 0;
  a = (a + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** The model's context for normalising the radius/dist coordinates. */
export interface ModContext {
  /** the model's height in profile units */
  height: number;
}

/**
 * The normalised source coordinate ∈ ℝ (its integer part is the cycle's
 * number at rate=1): z → v, θ → u/2π, a spiral → v + k·u/2π, the radius →
 * r/0.5, the distance from the centre → d/(height/2).
 */
export function lfoCoord(lfo: SpatialLfoDef, u: number, v: number, px: number, py: number, pz: number, ctx: ModContext): number {
  switch (lfo.source) {
    case 'z':
      return v;
    case 'theta':
      return u / TWO_PI;
    case 'spiral':
      return v + (lfo.k * u) / TWO_PI;
    case 'radius':
      return Math.hypot(px, py) / 0.5;
    case 'dist':
      return Math.hypot(px, py, pz - ctx.height / 2) / (ctx.height / 2);
  }
}

/** The LFO's value at a point → [-1, 1]. */
export function lfoValueAt(lfo: SpatialLfoDef, u: number, v: number, px: number, py: number, pz: number, ctx: ModContext): number {
  const ph = lfo.rate * lfoCoord(lfo, u, v, px, py, pz, ctx) + lfo.phase;
  const frac = ph - Math.floor(ph); // [0, 1)
  switch (lfo.shape) {
    case 'sine':
      return Math.sin(TWO_PI * ph);
    case 'triangle':
      return frac < 0.5 ? 4 * frac - 1 : 3 - 4 * frac;
    case 'saw':
      return 2 * frac - 1;
    case 'square':
      return frac < 0.5 ? 1 : -1;
    case 'random':
      return 2 * hash01(Math.floor(ph)) - 1;
  }
}

/**
 * A parameter's effective value: the base + a bipolar share of the range ·
 * LFO, clamped to [min, max]. For exp parameters (min > 0) — a mapping in
 * octaves.
 */
export function effectiveParam(base: number, l: number, depth: number, range: readonly [number, number], exp: boolean): number {
  const [min, max] = range;
  if (exp && min > 0 && max > 0) {
    const octaves = Math.log2(max / min);
    return clamp(base * Math.pow(2, depth * octaves * l), min, max);
  }
  return clamp(base + depth * (max - min) * l, min, max);
}
