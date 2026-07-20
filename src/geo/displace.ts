// Формулы-смещения: скалярное поле d(u,v,P), прибавляемое вдоль нормали
// базовой поверхности. Стек с весами — аналог суммы генераторов в
// formula-synth. u ∈ [0,2π) — азимут (замкнут: целые частоты по u дают
// бесшовный узор), v ∈ [0,1] — параметр вдоль профиля, P — точка базовой
// поверхности (для 3D-шума: бесшовно и изотропно в реальном пространстве).

import type { Grid } from './surface';
import { gridRows } from './surface';
import { simplex3, fbm3 } from './noise';
import { sphericalHarmonic } from './harmonics';

export type Params = Record<string, number>;

export type DisplaceFn = (u: number, v: number, px: number, py: number, pz: number) => number;

export interface DisplaceEntry {
  fn: DisplaceFn;
  weight: number;
}

export const DISPLACE_IDS = ['ripples', 'lissajous', 'harmonics', 'noise', 'waves', 'gyroid', 'bytebeat'] as const;
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
  gyroid: { amp: 0.02, scale: 12 },
  bytebeat: { amp: 0.02, cells: 16, recipe: 1 },
};

const num = (p: Params, k: string, d: number): number => (Number.isFinite(p[k]) ? p[k] : d);

/**
 * Кернел: формула с параметрами, подставляемыми в момент вычисления точки —
 * так матрица модуляции может менять параметры от точки к точке. Дискретные
 * параметры (сид/октавы шума, l/m гармоник, форма волны) фиксируются при
 * создании кернела и не модулируются.
 */
export type DisplaceKernel = (u: number, v: number, px: number, py: number, pz: number, p: Params) => number;

/** Ripples: d = A·sin(a·u + b·2π·v + φ) — кольца/грани/спирали. */
function ripplesKernel(): DisplaceKernel {
  return (u, v, _px, _py, _pz, p) =>
    num(p, 'amp', 0.02) * Math.sin(num(p, 'freqU', 12) * u + num(p, 'freqV', 6) * 2 * Math.PI * v + num(p, 'phase', 0));
}

/** Lissajous-интерференция: d = A·sin(a·u+φ₁)·sin(b·2π·v+φ₂) — плетёнка. */
function lissajousKernel(): DisplaceKernel {
  return (u, v, _px, _py, _pz, p) =>
    num(p, 'amp', 0.02) *
    Math.sin(num(p, 'freqU', 8) * u + num(p, 'phaseU', 0)) *
    Math.sin(num(p, 'freqV', 5) * 2 * Math.PI * v + num(p, 'phaseV', 0));
}

/** Сферические гармоники: d = A·Yₗₘ(θ,φ), θ = π·(1−v), φ = u. */
function harmonicsKernel(staticP: Params): DisplaceKernel {
  const l = num(staticP, 'l', 5);
  const m = num(staticP, 'm', 3);
  return (u, v, _px, _py, _pz, p) =>
    num(p, 'amp', 0.05) * sphericalHarmonic(l, m, Math.PI * (1 - v), u, num(p, 'phase', 0));
}

/** fBm simplex-шум по 3D-точке поверхности — камень/керамика ручной лепки. */
function noiseKernel(staticP: Params): DisplaceKernel {
  const octaves = num(staticP, 'octaves', 3);
  const seed = Math.round(num(staticP, 'seed', 42));
  const f = fbm3(simplex3(seed), octaves);
  return (_u, _v, px, py, pz, p) => {
    const scale = num(p, 'scale', 3);
    return num(p, 'amp', 0.03) * f(px * scale, py * scale, pz * scale);
  };
}

const frac = (x: number): number => x - Math.floor(x);

/** Зубцы/пила/меандр: формы LFO как прямое смещение (shape: 0=tri,1=saw,2=square). */
function wavesKernel(staticP: Params): DisplaceKernel {
  const shape = Math.round(num(staticP, 'shape', 0));
  const wave = (x: number): number => {
    const t = frac(x);
    if (shape === 1) return 2 * t - 1;
    if (shape === 2) return t < 0.5 ? 1 : -1;
    return 4 * Math.abs(t - 0.5) - 1;
  };
  return (u, v, _px, _py, _pz, p) =>
    num(p, 'amp', 0.02) *
    wave((num(p, 'freqU', 8) * u) / (2 * Math.PI) + num(p, 'freqV', 0) * v + num(p, 'phase', 0) / (2 * Math.PI));
}

/** Гироид-узор в точке поверхности — тканый TPMS-рельеф без решётки. */
function gyroidKernel(): DisplaceKernel {
  return (_u, _v, px, py, pz, p) => {
    const s = num(p, 'scale', 12);
    const x = px * s;
    const y = py * s;
    const z = pz * s;
    const g = Math.sin(x) * Math.cos(y) + Math.sin(y) * Math.cos(z) + Math.sin(z) * Math.cos(x);
    return (num(p, 'amp', 0.02) * g) / 1.5;
  };
}

/** Bytebeat-рельеф: целочисленные формулы по ячейкам (u,v) — пиксельный орнамент. */
function bytebeatKernel(staticP: Params): DisplaceKernel {
  const recipe = Math.round(num(staticP, 'recipe', 1));
  return (u, v, _px, _py, _pz, p) => {
    const cells = Math.max(2, Math.round(num(p, 'cells', 16)));
    const ix = Math.floor(((u / (2 * Math.PI)) % 1) * cells);
    const iy = Math.floor(v * cells);
    let b: number;
    switch (recipe) {
      case 2: b = ((ix ^ iy) % 9) / 8; break; // munching squares
      case 3: b = (((ix * iy) >> 1) & 7) / 7; break;
      case 4: b = ((ix + iy * 3) & (ix >> 1) & 15) / 15; break;
      default: b = ((ix | iy) & 15) / 15; break;
    }
    return num(p, 'amp', 0.02) * (2 * b - 1);
  };
}

export function makeKernel(id: DisplaceId, staticParams: Params): DisplaceKernel {
  switch (id) {
    case 'ripples': return ripplesKernel();
    case 'lissajous': return lissajousKernel();
    case 'harmonics': return harmonicsKernel(staticParams);
    case 'noise': return noiseKernel(staticParams);
    case 'waves': return wavesKernel(staticParams);
    case 'gyroid': return gyroidKernel();
    case 'bytebeat': return bytebeatKernel(staticParams);
  }
}

/** Смещение с фиксированными параметрами (без модуляции). */
export function makeDisplace(id: DisplaceId, p: Params): DisplaceFn {
  const kernel = makeKernel(id, p);
  return (u, v, px, py, pz) => kernel(u, v, px, py, pz, p);
}

/**
 * Применяет стек смещений к сетке на месте: P += n̂ · Σ wᵢ·dᵢ(u,v,P).
 * Нормали — базовые (до смещения), длина совпадает с positions сетки.
 */
export function applyDisplacements(
  grid: Grid,
  normals: Float32Array,
  stack: DisplaceEntry[],
  onRow?: (j: number, nv: number) => void,
  atten?: (v: number) => number,
): void {
  if (stack.length === 0) return;
  const { nu, nv, positions } = grid;
  const rows = gridRows(grid);
  for (let j = 0; j < rows; j++) {
    onRow?.(j, rows - 1);
    const v = j / nv;
    const w = atten ? atten(v) : 1;
    for (let i = 0; i < nu; i++) {
      const u = (2 * Math.PI * i) / nu;
      const k = (j * nu + i) * 3;
      const px = positions[k];
      const py = positions[k + 1];
      const pz = positions[k + 2];
      let d = 0;
      for (const e of stack) d += e.weight * e.fn(u, v, px, py, pz);
      d *= w;
      positions[k] += normals[k] * d;
      positions[k + 1] += normals[k + 1] * d;
      positions[k + 2] += normals[k + 2] * d;
    }
  }
}
