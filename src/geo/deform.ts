// Деформеры позиций (аналог FX-цепочки): применяются к сетке целиком после
// смещений, по порядку. Работают на Grid (знают v = j/nv и замкнутость по u).
// evalAt — необязательный расчёт эффективных параметров в точке (матрица
// модуляции); без него параметры статичны.

import type { Grid } from './surface';
import { gridRows } from './surface';
import type { Params } from './displace';

export const DEFORM_IDS = [
  'twist',
  'taper',
  'symmetry',
  'smooth',
  'quantize',
  'bulge',
  'bend',
  'shear',
  'axial',
  'elliptic',
  'flare',
  'corrugate',
  'taubin',
] as const;
export type DeformId = (typeof DEFORM_IDS)[number];

export function isDeformId(x: string): x is DeformId {
  return DEFORM_IDS.some((id) => id === x);
}

/** Дефолты параметров = дефолты слайдеров UI-схемы (сверяется тестом). */
export const DEFAULT_DEFORM_PARAMS: Record<DeformId, Params> = {
  twist: { turns: 0.25 },
  taper: { amount: 0.3, power: 1 },
  symmetry: { k: 6, mix: 1 },
  smooth: { iterations: 2, strength: 0.5 },
  quantize: { step: 0.02 },
  bulge: { amount: 0.25, center: 0.5, width: 0.2 },
  bend: { amount: 0.2, power: 1 },
  shear: { x: 0.15, y: 0 },
  axial: { amp: 0.08, freq: 2, phase: 0 },
  elliptic: { ratio: 1.3, phase: 0 },
  flare: { amount: 0.3, start: 0.75, power: 1.5 },
  corrugate: { amp: 0.05, folds: 12, phase: 0 },
  taubin: { iterations: 2, lambda: 0.5, mu: -0.53 },
};

/** Эффективные параметры в точке (u, v, P) — для модуляции. */
export type ParamEval = (u: number, v: number, px: number, py: number, pz: number) => Params;

const num = (p: Params, k: string, d: number): number => (Number.isFinite(p[k]) ? p[k] : d);

/** Спиральный перекрут: поворот xy на 2π·turns·v. */
function twist(grid: Grid, p: Params, evalAt?: ParamEval): void {
  const { nu, nv, positions } = grid;
  const rows = gridRows(grid);
  for (let j = 0; j < rows; j++) {
    const v = j / nv;
    for (let i = 0; i < nu; i++) {
      const k = (j * nu + i) * 3;
      const x = positions[k];
      const y = positions[k + 1];
      const u = (2 * Math.PI * i) / nu;
      const pp = evalAt ? evalAt(u, v, x, y, positions[k + 2]) : p;
      const ang = 2 * Math.PI * num(pp, 'turns', 0.25) * v;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      positions[k] = x * c - y * s;
      positions[k + 1] = x * s + y * c;
    }
  }
}

/** Сужение по v: масштаб xy на 1 − amount·vᵖ (amount < 0 — расширение). */
function taper(grid: Grid, p: Params, evalAt?: ParamEval): void {
  const { nu, nv, positions } = grid;
  const rows = gridRows(grid);
  for (let j = 0; j < rows; j++) {
    const v = j / nv;
    for (let i = 0; i < nu; i++) {
      const k = (j * nu + i) * 3;
      const u = (2 * Math.PI * i) / nu;
      const pp = evalAt ? evalAt(u, v, positions[k], positions[k + 1], positions[k + 2]) : p;
      const amount = Math.min(0.95, num(pp, 'amount', 0.3));
      const power = Math.max(0.1, num(pp, 'power', 1));
      const s = 1 - amount * Math.pow(v, power);
      positions[k] *= s;
      positions[k + 1] *= s;
    }
  }
}

/**
 * Симметрия k-fold: усреднение по k поворотам на 2π/k («гончарная»
 * правильность), mix — доля симметризованной формы. Дробные колонки
 * берутся линейной интерполяцией по кольцу. Модулируется только mix —
 * k дискретен и фиксируется базовым параметром.
 */
function symmetry(grid: Grid, p: Params, evalAt?: ParamEval): void {
  const k = Math.max(1, Math.round(num(p, 'k', 6)));
  const baseMix = Math.max(0, Math.min(1, num(p, 'mix', 1)));
  if (k === 1 || (baseMix === 0 && !evalAt)) return;
  const { nu, nv, positions } = grid;
  const ring = new Float64Array(nu * 3);
  const rows = gridRows(grid);
  for (let j = 0; j < rows; j++) {
    const v = j / nv;
    const base = j * nu * 3;
    for (let t = 0; t < nu * 3; t++) ring[t] = positions[base + t];
    for (let i = 0; i < nu; i++) {
      let ax = 0,
        ay = 0,
        az = 0;
      for (let m = 0; m < k; m++) {
        // точка кольца на угле u + m·2π/k, повёрнутая назад на −m·2π/k
        const col = i + (m * nu) / k;
        const c0 = Math.floor(col);
        const frac = col - c0;
        const i0 = ((c0 % nu) + nu) % nu;
        const i1 = (i0 + 1) % nu;
        const sx = ring[i0 * 3] * (1 - frac) + ring[i1 * 3] * frac;
        const sy = ring[i0 * 3 + 1] * (1 - frac) + ring[i1 * 3 + 1] * frac;
        const sz = ring[i0 * 3 + 2] * (1 - frac) + ring[i1 * 3 + 2] * frac;
        const ang = (-2 * Math.PI * m) / k;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        ax += sx * c - sy * s;
        ay += sx * s + sy * c;
        az += sz;
      }
      const kk = base + i * 3;
      const u = (2 * Math.PI * i) / nu;
      const pp = evalAt ? evalAt(u, v, positions[kk], positions[kk + 1], positions[kk + 2]) : p;
      const mix = Math.max(0, Math.min(1, num(pp, 'mix', 1)));
      positions[kk] += mix * (ax / k - positions[kk]);
      positions[kk + 1] += mix * (ay / k - positions[kk + 1]);
      positions[kk + 2] += mix * (az / k - positions[kk + 2]);
    }
  }
}

/**
 * Лапласово сглаживание сетки: P += λ·(среднее 4 соседей − P), 1–5 итераций.
 * Соседи по u — с заворотом; по v — кламп на краях (или заворот при wrapV).
 */
function smooth(grid: Grid, p: Params): void {
  const iterations = Math.max(1, Math.min(5, Math.round(num(p, 'iterations', 2))));
  const lambda = Math.max(0, Math.min(1, num(p, 'strength', 0.5)));
  if (lambda === 0) return;
  const { nu, positions } = grid;
  const rows = gridRows(grid);
  const src = new Float32Array(positions.length);
  for (let it = 0; it < iterations; it++) {
    src.set(positions);
    for (let j = 0; j < rows; j++) {
      const jUp = grid.wrapV ? (j + 1) % rows : Math.min(rows - 1, j + 1);
      const jDn = grid.wrapV ? (j - 1 + rows) % rows : Math.max(0, j - 1);
      for (let i = 0; i < nu; i++) {
        const k = (j * nu + i) * 3;
        const kL = (j * nu + ((i - 1 + nu) % nu)) * 3;
        const kR = (j * nu + ((i + 1) % nu)) * 3;
        const kU = (jUp * nu + i) * 3;
        const kD = (jDn * nu + i) * 3;
        for (let c = 0; c < 3; c++) {
          const avg = (src[kL + c] + src[kR + c] + src[kU + c] + src[kD + c]) / 4;
          positions[k + c] = src[k + c] + lambda * (avg - src[k + c]);
        }
      }
    }
  }
}

/** Квантование позиций к шагу — вокселизация/лоуполи. */
function quantize(grid: Grid, p: Params): void {
  const step = Math.max(0.002, num(p, 'step', 0.02));
  const { positions } = grid;
  for (let i = 0; i < positions.length; i++) {
    positions[i] = Math.round(positions[i] / step) * step;
  }
}

function scaleRings(grid: Grid, scaleAt: (u: number, v: number, x: number, y: number, z: number) => number): void {
  const { nu, nv, positions } = grid;
  const rows = gridRows(grid);
  for (let j = 0; j < rows; j++) {
    const v = j / nv;
    for (let i = 0; i < nu; i++) {
      const k = (j * nu + i) * 3;
      const u = (2 * Math.PI * i) / nu;
      const s = scaleAt(u, v, positions[k], positions[k + 1], positions[k + 2]);
      positions[k] *= s;
      positions[k + 1] *= s;
    }
  }
}

function bulge(grid: Grid, p: Params, evalAt?: ParamEval): void {
  scaleRings(grid, (u, v, x, y, z) => {
    const pp = evalAt ? evalAt(u, v, x, y, z) : p;
    const width = Math.max(0.02, num(pp, 'width', 0.2));
    return Math.max(0.1, 1 + num(pp, 'amount', 0.25) * Math.exp(-Math.pow((v - num(pp, 'center', 0.5)) / width, 2)));
  });
}

function bend(grid: Grid, p: Params, evalAt?: ParamEval): void {
  const { nu, nv, positions } = grid;
  const rows = gridRows(grid);
  let zMin = Infinity,
    zMax = -Infinity;
  for (let i = 2; i < positions.length; i += 3) {
    zMin = Math.min(zMin, positions[i]);
    zMax = Math.max(zMax, positions[i]);
  }
  const height = zMax - zMin;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < nu; i++) {
      const k = (j * nu + i) * 3;
      const v = j / nv;
      const u = (2 * Math.PI * i) / nu;
      const pp = evalAt ? evalAt(u, v, positions[k], positions[k + 1], positions[k + 2]) : p;
      positions[k] += height * num(pp, 'amount', 0.2) * Math.pow(v, Math.max(0.2, num(pp, 'power', 1)));
    }
}

function shear(grid: Grid, p: Params, evalAt?: ParamEval): void {
  const { nu, nv, positions } = grid;
  const rows = gridRows(grid);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < nu; i++) {
      const k = (j * nu + i) * 3,
        v = j / nv,
        u = (2 * Math.PI * i) / nu;
      const pp = evalAt ? evalAt(u, v, positions[k], positions[k + 1], positions[k + 2]) : p;
      positions[k] += num(pp, 'x', 0.15) * v;
      positions[k + 1] += num(pp, 'y', 0) * v;
    }
}

function axial(grid: Grid, p: Params, evalAt?: ParamEval): void {
  const { nu, nv, positions } = grid;
  const rows = gridRows(grid);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < nu; i++) {
      const k = (j * nu + i) * 3,
        v = j / nv,
        u = (2 * Math.PI * i) / nu;
      const pp = evalAt ? evalAt(u, v, positions[k], positions[k + 1], positions[k + 2]) : p;
      const angle = 2 * Math.PI * num(pp, 'freq', 2) * v + num(pp, 'phase', 0);
      const amp = num(pp, 'amp', 0.08);
      positions[k] += amp * Math.cos(angle);
      positions[k + 1] += amp * Math.sin(angle);
    }
}

function elliptic(grid: Grid, p: Params, evalAt?: ParamEval): void {
  const { nu, nv, positions } = grid;
  const rows = gridRows(grid);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < nu; i++) {
      const k = (j * nu + i) * 3,
        v = j / nv,
        u = (2 * Math.PI * i) / nu;
      const pp = evalAt ? evalAt(u, v, positions[k], positions[k + 1], positions[k + 2]) : p;
      const angle = num(pp, 'phase', 0),
        c = Math.cos(angle),
        s = Math.sin(angle);
      const x = positions[k] * c + positions[k + 1] * s;
      const y = -positions[k] * s + positions[k + 1] * c;
      const ratio = Math.max(0.2, num(pp, 'ratio', 1.3));
      positions[k] = x * ratio * c - (y / ratio) * s;
      positions[k + 1] = x * ratio * s + (y / ratio) * c;
    }
}

function flare(grid: Grid, p: Params, evalAt?: ParamEval): void {
  scaleRings(grid, (u, v, x, y, z) => {
    const pp = evalAt ? evalAt(u, v, x, y, z) : p;
    const start = Math.min(0.99, num(pp, 'start', 0.75));
    const t = Math.max(0, (v - start) / (1 - start));
    return Math.max(0.1, 1 + num(pp, 'amount', 0.3) * Math.pow(t, Math.max(0.2, num(pp, 'power', 1.5))));
  });
}

function corrugate(grid: Grid, p: Params, evalAt?: ParamEval): void {
  scaleRings(grid, (u, v, x, y, z) => {
    const pp = evalAt ? evalAt(u, v, x, y, z) : p;
    return Math.max(0.1, 1 + num(pp, 'amp', 0.05) * Math.cos(num(pp, 'folds', 12) * u + num(pp, 'phase', 0)));
  });
}

function laplacePass(grid: Grid, strength: number): void {
  const { nu, positions } = grid;
  const rows = gridRows(grid);
  const src = positions.slice();
  for (let j = 0; j < rows; j++) {
    const jUp = grid.wrapV ? (j + 1) % rows : Math.min(rows - 1, j + 1);
    const jDn = grid.wrapV ? (j - 1 + rows) % rows : Math.max(0, j - 1);
    for (let i = 0; i < nu; i++) {
      const k = (j * nu + i) * 3;
      const neighbors = [(j * nu + ((i - 1 + nu) % nu)) * 3, (j * nu + ((i + 1) % nu)) * 3, (jUp * nu + i) * 3, (jDn * nu + i) * 3];
      for (let c = 0; c < 3; c++) {
        let avg = 0;
        for (const n of neighbors) avg += src[n + c];
        positions[k + c] = src[k + c] + strength * (avg / 4 - src[k + c]);
      }
    }
  }
}

function taubin(grid: Grid, p: Params): void {
  const iterations = Math.max(1, Math.min(8, Math.round(num(p, 'iterations', 2))));
  const lambda = Math.max(0, Math.min(1, num(p, 'lambda', 0.5)));
  const mu = Math.max(-1, Math.min(-0.01, num(p, 'mu', -0.53)));
  for (let i = 0; i < iterations; i++) {
    laplacePass(grid, lambda);
    laplacePass(grid, mu);
  }
}

export function applyDeformer(id: DeformId, grid: Grid, p: Params, evalAt?: ParamEval): void {
  switch (id) {
    case 'twist':
      return twist(grid, p, evalAt);
    case 'taper':
      return taper(grid, p, evalAt);
    case 'symmetry':
      return symmetry(grid, p, evalAt);
    case 'smooth':
      return smooth(grid, p);
    case 'quantize':
      return quantize(grid, p);
    case 'bulge':
      return bulge(grid, p, evalAt);
    case 'bend':
      return bend(grid, p, evalAt);
    case 'shear':
      return shear(grid, p, evalAt);
    case 'axial':
      return axial(grid, p, evalAt);
    case 'elliptic':
      return elliptic(grid, p, evalAt);
    case 'flare':
      return flare(grid, p, evalAt);
    case 'corrugate':
      return corrugate(grid, p, evalAt);
    case 'taubin':
      return taubin(grid, p);
  }
}
