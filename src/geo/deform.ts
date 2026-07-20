// Деформеры позиций (аналог FX-цепочки): применяются к сетке целиком после
// смещений, по порядку. Работают на Grid (знают v = j/nv и замкнутость по u).

import type { Grid } from './surface';
import type { Params } from './displace';

export const DEFORM_IDS = ['twist', 'taper', 'symmetry'] as const;
export type DeformId = (typeof DEFORM_IDS)[number];

export function isDeformId(x: string): x is DeformId {
  return DEFORM_IDS.some((id) => id === x);
}

/** Дефолты параметров = дефолты слайдеров UI-схемы (сверяется тестом). */
export const DEFAULT_DEFORM_PARAMS: Record<DeformId, Params> = {
  twist: { turns: 0.25 },
  taper: { amount: 0.3, power: 1 },
  symmetry: { k: 6, mix: 1 },
};

const num = (p: Params, k: string, d: number): number => (Number.isFinite(p[k]) ? p[k] : d);

/** Спиральный перекрут: поворот xy на 2π·turns·v. */
function twist(grid: Grid, p: Params): void {
  const turns = num(p, 'turns', 0.25);
  if (turns === 0) return;
  const { nu, nv, positions } = grid;
  for (let j = 0; j <= nv; j++) {
    const ang = 2 * Math.PI * turns * (j / nv);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    for (let i = 0; i < nu; i++) {
      const k = (j * nu + i) * 3;
      const x = positions[k];
      const y = positions[k + 1];
      positions[k] = x * c - y * s;
      positions[k + 1] = x * s + y * c;
    }
  }
}

/** Сужение по v: масштаб xy на 1 − amount·vᵖ (amount < 0 — расширение). */
function taper(grid: Grid, p: Params): void {
  const amount = Math.min(0.95, num(p, 'amount', 0.3));
  const power = Math.max(0.1, num(p, 'power', 1));
  if (amount === 0) return;
  const { nu, nv, positions } = grid;
  for (let j = 0; j <= nv; j++) {
    const s = 1 - amount * Math.pow(j / nv, power);
    for (let i = 0; i < nu; i++) {
      const k = (j * nu + i) * 3;
      positions[k] *= s;
      positions[k + 1] *= s;
    }
  }
}

/**
 * Симметрия k-fold: усреднение по k поворотам на 2π/k («гончарная»
 * правильность), mix — доля симметризованной формы. Дробные колонки
 * берутся линейной интерполяцией по кольцу.
 */
function symmetry(grid: Grid, p: Params): void {
  const k = Math.max(1, Math.round(num(p, 'k', 6)));
  const mix = Math.max(0, Math.min(1, num(p, 'mix', 1)));
  if (k === 1 || mix === 0) return;
  const { nu, nv, positions } = grid;
  const ring = new Float64Array(nu * 3);
  for (let j = 0; j <= nv; j++) {
    const base = j * nu * 3;
    for (let t = 0; t < nu * 3; t++) ring[t] = positions[base + t];
    for (let i = 0; i < nu; i++) {
      let ax = 0, ay = 0, az = 0;
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
      positions[kk] += mix * (ax / k - positions[kk]);
      positions[kk + 1] += mix * (ay / k - positions[kk + 1]);
      positions[kk + 2] += mix * (az / k - positions[kk + 2]);
    }
  }
}

export function applyDeformer(id: DeformId, grid: Grid, p: Params): void {
  switch (id) {
    case 'twist': return twist(grid, p);
    case 'taper': return taper(grid, p);
    case 'symmetry': return symmetry(grid, p);
  }
}
