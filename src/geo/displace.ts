// Формулы-смещения: скалярное поле d(u,v,P), прибавляемое вдоль нормали
// базовой поверхности. Стек с весами — аналог суммы генераторов в
// formula-synth. u ∈ [0,2π) — азимут (замкнут: целые частоты по u дают
// бесшовный узор), v ∈ [0,1] — параметр вдоль профиля, P — точка базовой
// поверхности (для 3D-шума: бесшовно и изотропно в реальном пространстве).

import type { Grid } from './surface';
import { simplex3, fbm3 } from './noise';
import { sphericalHarmonic } from './harmonics';

export type Params = Record<string, number>;

export type DisplaceFn = (u: number, v: number, px: number, py: number, pz: number) => number;

export interface DisplaceEntry {
  fn: DisplaceFn;
  weight: number;
}

export const DISPLACE_IDS = ['ripples', 'lissajous', 'harmonics', 'noise', 'waves'] as const;
export type DisplaceId = (typeof DISPLACE_IDS)[number];

export function isDisplaceId(x: string): x is DisplaceId {
  return DISPLACE_IDS.some((id) => id === x);
}

/** Дефолты параметров = дефолты слайдеров UI-схемы (сверяется тестом). */
export const DEFAULT_DISPLACE_PARAMS: Record<DisplaceId, Params> = {
  ripples: { amp: 0.02, freqU: 12, freqV: 6, phase: 0 },
  lissajous: { amp: 0.02, freqU: 8, freqV: 5, phaseU: 0, phaseV: 0 },
  harmonics: { amp: 0.05, l: 5, m: 3, phase: 0 },
  noise: { amp: 0.03, scale: 3, octaves: 3, seed: 42 },
  waves: { amp: 0.02, shape: 0, freqU: 8, freqV: 0, phase: 0 },
};

const num = (p: Params, k: string, d: number): number => (Number.isFinite(p[k]) ? p[k] : d);

/** Ripples: d = A·sin(a·u + b·2π·v + φ) — кольца/грани/спирали. */
function ripplesFn(p: Params): DisplaceFn {
  const amp = num(p, 'amp', 0.02);
  const a = num(p, 'freqU', 12);
  const b = num(p, 'freqV', 6);
  const phase = num(p, 'phase', 0);
  return (u, v) => amp * Math.sin(a * u + b * 2 * Math.PI * v + phase);
}

/** Lissajous-интерференция: d = A·sin(a·u+φ₁)·sin(b·2π·v+φ₂) — плетёнка. */
function lissajousFn(p: Params): DisplaceFn {
  const amp = num(p, 'amp', 0.02);
  const a = num(p, 'freqU', 8);
  const b = num(p, 'freqV', 5);
  const p1 = num(p, 'phaseU', 0);
  const p2 = num(p, 'phaseV', 0);
  return (u, v) => amp * Math.sin(a * u + p1) * Math.sin(b * 2 * Math.PI * v + p2);
}

/** Сферические гармоники: d = A·Yₗₘ(θ,φ), θ = π·(1−v), φ = u. */
function harmonicsFn(p: Params): DisplaceFn {
  const amp = num(p, 'amp', 0.05);
  const l = num(p, 'l', 5);
  const m = num(p, 'm', 3);
  const phase = num(p, 'phase', 0);
  return (u, v) => amp * sphericalHarmonic(l, m, Math.PI * (1 - v), u, phase);
}

/** fBm simplex-шум по 3D-точке поверхности — камень/керамика ручной лепки. */
function noiseFn(p: Params): DisplaceFn {
  const amp = num(p, 'amp', 0.03);
  const scale = num(p, 'scale', 3);
  const octaves = num(p, 'octaves', 3);
  const seed = Math.round(num(p, 'seed', 42));
  const f = fbm3(simplex3(seed), octaves);
  return (_u, _v, px, py, pz) => amp * f(px * scale, py * scale, pz * scale);
}

const frac = (x: number): number => x - Math.floor(x);

/** Зубцы/пила/меандр: формы LFO как прямое смещение (shape: 0=tri,1=saw,2=square). */
function wavesFn(p: Params): DisplaceFn {
  const amp = num(p, 'amp', 0.02);
  const shape = Math.round(num(p, 'shape', 0));
  const a = num(p, 'freqU', 8);
  const b = num(p, 'freqV', 0);
  const phase = num(p, 'phase', 0);
  const wave = (x: number): number => {
    const t = frac(x);
    if (shape === 1) return 2 * t - 1;
    if (shape === 2) return t < 0.5 ? 1 : -1;
    return 4 * Math.abs(t - 0.5) - 1;
  };
  return (u, v) => amp * wave((a * u) / (2 * Math.PI) + b * v + phase / (2 * Math.PI));
}

export function makeDisplace(id: DisplaceId, p: Params): DisplaceFn {
  switch (id) {
    case 'ripples': return ripplesFn(p);
    case 'lissajous': return lissajousFn(p);
    case 'harmonics': return harmonicsFn(p);
    case 'noise': return noiseFn(p);
    case 'waves': return wavesFn(p);
  }
}

/**
 * Применяет стек смещений к сетке на месте: P += n̂ · Σ wᵢ·dᵢ(u,v,P).
 * Нормали — базовые (до смещения), длина совпадает с positions сетки.
 */
export function applyDisplacements(grid: Grid, normals: Float32Array, stack: DisplaceEntry[]): void {
  if (stack.length === 0) return;
  const { nu, nv, positions } = grid;
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i < nu; i++) {
      const u = (2 * Math.PI * i) / nu;
      const k = (j * nu + i) * 3;
      const px = positions[k];
      const py = positions[k + 1];
      const pz = positions[k + 2];
      let d = 0;
      for (const e of stack) d += e.weight * e.fn(u, v, px, py, pz);
      positions[k] += normals[k] * d;
      positions[k + 1] += normals[k + 1] * d;
      positions[k + 2] += normals[k + 2] * d;
    }
  }
}
