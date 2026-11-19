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

export const DISPLACE_IDS = [
  'ripples',
  'lissajous',
  'harmonics',
  'noise',
  'waves',
  'gyroid',
  'bytebeat',
  'gaussian',
  'phyllotaxis',
  'cellular',
  'warp',
  'tpms',
  'logistic',
  'superformula',
  'knurl',
  'polygon',
  'star',
] as const;
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
  gaussian: { amp: 0.04, center: 0.55, width: 0.15, lobes: 6, phase: 0 },
  phyllotaxis: { amp: 0.025, turns: 13, slope: 8, phase: 0 },
  cellular: { amp: 0.025, scale: 8, seed: 17, sharpness: 2 },
  warp: { amp: 0.03, scale: 5, warp: 0.5, seed: 23 },
  tpms: { amp: 0.025, scale: 12, family: 1, sharpness: 1 },
  logistic: { amp: 0.03, rate: 3.8, seed: 0.37, layers: 24, freqU: 8 },
  superformula: { amp: 0.04, m: 6, n1: 1, n2: 7, n3: 8, mix: 1 },
  knurl: { amp: 0.025, freqU: 12, freqV: 8, sharpness: 2 },
  polygon: { amp: 0.04, sides: 6, roundness: 0.8, phase: 0 },
  star: { amp: 0.025, order: 8, freqV: 5, layers: 3, phase: 0 },
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
  return (u, v, _px, _py, _pz, p) => num(p, 'amp', 0.05) * sphericalHarmonic(l, m, Math.PI * (1 - v), u, num(p, 'phase', 0));
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
    num(p, 'amp', 0.02) * wave((num(p, 'freqU', 8) * u) / (2 * Math.PI) + num(p, 'freqV', 0) * v + num(p, 'phase', 0) / (2 * Math.PI));
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
      case 2:
        b = ((ix ^ iy) % 9) / 8;
        break; // munching squares
      case 3:
        b = (((ix * iy) >> 1) & 7) / 7;
        break;
      case 4:
        b = ((ix + iy * 3) & (ix >> 1) & 15) / 15;
        break;
      default:
        b = ((ix | iy) & 15) / 15;
        break;
    }
    return num(p, 'amp', 0.02) * (2 * b - 1);
  };
}

function gaussianKernel(): DisplaceKernel {
  return (u, v, _px, _py, _pz, p) => {
    const width = Math.max(0.01, num(p, 'width', 0.15));
    const envelope = Math.exp(-Math.pow((v - num(p, 'center', 0.55)) / width, 2));
    return num(p, 'amp', 0.04) * envelope * Math.cos(num(p, 'lobes', 6) * u + num(p, 'phase', 0));
  };
}

function phyllotaxisKernel(): DisplaceKernel {
  return (u, v, _px, _py, _pz, p) =>
    num(p, 'amp', 0.025) *
    Math.cos(num(p, 'turns', 13) * u - 2 * Math.PI * num(p, 'slope', 8) * v + num(p, 'phase', 0)) *
    Math.sin(Math.PI * Math.min(1, Math.max(0, v)));
}

function hashCell(x: number, y: number, z: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
  return frac(n);
}

function cellularKernel(staticP: Params): DisplaceKernel {
  const seed = Math.round(num(staticP, 'seed', 17));
  return (_u, _v, px, py, pz, p) => {
    const scale = num(p, 'scale', 8);
    const x = px * scale,
      y = py * scale,
      z = pz * scale;
    const ix = Math.floor(x),
      iy = Math.floor(y),
      iz = Math.floor(z);
    let f1 = Infinity,
      f2 = Infinity;
    for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx,
            cy = iy + dy,
            cz = iz + dz;
          const ox = hashCell(cx, cy, cz, seed);
          const oy = hashCell(cx, cy, cz, seed + 11);
          const oz = hashCell(cx, cy, cz, seed + 29);
          const d = Math.hypot(cx + ox - x, cy + oy - y, cz + oz - z);
          if (d < f1) {
            f2 = f1;
            f1 = d;
          } else if (d < f2) f2 = d;
        }
    const edge = Math.min(1, Math.max(0, (f2 - f1) * num(p, 'sharpness', 2)));
    return num(p, 'amp', 0.025) * (2 * edge - 1);
  };
}

function warpKernel(staticP: Params): DisplaceKernel {
  const seed = Math.round(num(staticP, 'seed', 23));
  const n1 = simplex3(seed);
  const n2 = simplex3(seed + 101);
  return (_u, _v, px, py, pz, p) => {
    const scale = num(p, 'scale', 5);
    const amount = num(p, 'warp', 0.5);
    const q = n1(px * scale, py * scale, pz * scale) * amount;
    return num(p, 'amp', 0.03) * n2(px * scale + q, py * scale - q, pz * scale + 0.5 * q);
  };
}

function tpmsKernel(staticP: Params): DisplaceKernel {
  const family = Math.round(num(staticP, 'family', 1));
  return (_u, _v, px, py, pz, p) => {
    const s = num(p, 'scale', 12);
    const x = px * s,
      y = py * s,
      z = pz * s;
    let g: number;
    if (family === 2) g = Math.cos(x) + Math.cos(y) + Math.cos(z);
    else if (family === 3) {
      g =
        Math.sin(x) * Math.sin(y) * Math.sin(z) +
        Math.sin(x) * Math.cos(y) * Math.cos(z) +
        Math.cos(x) * Math.sin(y) * Math.cos(z) +
        Math.cos(x) * Math.cos(y) * Math.sin(z);
    } else if (family === 4) {
      g = 3 * (Math.cos(x) + Math.cos(y) + Math.cos(z)) + 4 * Math.cos(x) * Math.cos(y) * Math.cos(z);
    } else {
      g = Math.sin(x) * Math.cos(y) + Math.sin(y) * Math.cos(z) + Math.sin(z) * Math.cos(x);
    }
    return num(p, 'amp', 0.025) * Math.tanh(g * num(p, 'sharpness', 1));
  };
}

function logisticKernel(staticP: Params): DisplaceKernel {
  const layers = Math.max(2, Math.round(num(staticP, 'layers', 24)));
  const rate = num(staticP, 'rate', 3.8);
  const values = new Float64Array(layers + 1);
  values[0] = num(staticP, 'seed', 0.37);
  for (let i = 1; i <= layers; i++) values[i] = rate * values[i - 1] * (1 - values[i - 1]);
  return (u, v, _px, _py, _pz, p) => {
    const at = Math.min(layers, Math.max(0, v * layers));
    const i = Math.min(layers - 1, Math.floor(at));
    const x = values[i] * (1 - (at - i)) + values[i + 1] * (at - i);
    return num(p, 'amp', 0.03) * (2 * x - 1) * Math.cos(num(p, 'freqU', 8) * u);
  };
}

function superformulaKernel(): DisplaceKernel {
  return (u, _v, _px, _py, _pz, p) => {
    const n1 = Math.max(0.1, num(p, 'n1', 1));
    const a = Math.pow(Math.abs(Math.cos((num(p, 'm', 6) * u) / 4)), num(p, 'n2', 7));
    const b = Math.pow(Math.abs(Math.sin((num(p, 'm', 6) * u) / 4)), num(p, 'n3', 8));
    const r = Math.pow(Math.max(1e-9, a + b), -1 / n1);
    return num(p, 'amp', 0.04) * num(p, 'mix', 1) * Math.max(-1, Math.min(1, r - 1));
  };
}

function knurlKernel(): DisplaceKernel {
  return (u, v, _px, _py, _pz, p) => {
    const a = Math.cos(num(p, 'freqU', 12) * u + 2 * Math.PI * num(p, 'freqV', 8) * v);
    const b = Math.cos(num(p, 'freqU', 12) * u - 2 * Math.PI * num(p, 'freqV', 8) * v);
    const value = Math.sign(a * b) * Math.pow(Math.abs(a * b), 1 / Math.max(0.2, num(p, 'sharpness', 2)));
    return num(p, 'amp', 0.025) * value;
  };
}

function polygonKernel(): DisplaceKernel {
  return (u, _v, _px, _py, _pz, p) => {
    const sides = Math.max(3, Math.round(num(p, 'sides', 6)));
    const local = ((u + num(p, 'phase', 0) + Math.PI / sides) % ((2 * Math.PI) / sides)) - Math.PI / sides;
    const exact = Math.cos(Math.PI / sides) / Math.cos(local);
    return num(p, 'amp', 0.04) * num(p, 'roundness', 0.8) * (exact - 1);
  };
}

function starKernel(): DisplaceKernel {
  return (u, v, _px, _py, _pz, p) => {
    const layers = Math.max(1, Math.round(num(p, 'layers', 3)));
    let value = 1;
    for (let i = 1; i <= layers; i++) {
      value *= Math.cos(i * num(p, 'order', 8) * u + 2 * Math.PI * (layers - i + 1) * num(p, 'freqV', 5) * v + num(p, 'phase', 0));
    }
    return num(p, 'amp', 0.025) * value;
  };
}

export function makeKernel(id: DisplaceId, staticParams: Params): DisplaceKernel {
  switch (id) {
    case 'ripples':
      return ripplesKernel();
    case 'lissajous':
      return lissajousKernel();
    case 'harmonics':
      return harmonicsKernel(staticParams);
    case 'noise':
      return noiseKernel(staticParams);
    case 'waves':
      return wavesKernel(staticParams);
    case 'gyroid':
      return gyroidKernel();
    case 'bytebeat':
      return bytebeatKernel(staticParams);
    case 'gaussian':
      return gaussianKernel();
    case 'phyllotaxis':
      return phyllotaxisKernel();
    case 'cellular':
      return cellularKernel(staticParams);
    case 'warp':
      return warpKernel(staticParams);
    case 'tpms':
      return tpmsKernel(staticParams);
    case 'logistic':
      return logisticKernel(staticParams);
    case 'superformula':
      return superformulaKernel();
    case 'knurl':
      return knurlKernel();
    case 'polygon':
      return polygonKernel();
    case 'star':
      return starKernel();
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
