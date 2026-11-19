// The base carrier shapes: a solid of revolution, a sphere, a torus, a
// superellipsoid, a supershape (Gielis's superformula). All but the torus
// are polar grids: v runs along the latitude with a small margin from the
// poles, and fan caps close the holes at the poles (see assembleMesh). The
// torus is closed in v (wrapV).

import type { Grid } from './surface';
import { sampleGrid, sampleTorusGrid } from './surface';
import type { Params } from './displace';

export interface RevolveOptions {
  nu: number;
  nv: number;
  /** the height in profile units (z = t·height) */
  height: number;
}

/** A solid of revolution: the profile r(t) around the z axis. u is the azimuth, v = t. */
export function revolveGrid(radiusFn: (t: number) => number, o: RevolveOptions): Grid {
  return sampleGrid(o.nu, o.nv, (u, v, out) => {
    const r = radiusFn(v);
    out[0] = r * Math.cos(u);
    out[1] = r * Math.sin(u);
    out[2] = v * o.height;
  });
}

export const SHAPE_IDS = ['sphere', 'torus', 'superellipsoid', 'supershape'] as const;
export type ShapeId = (typeof SHAPE_IDS)[number];

export function isShapeId(x: string): x is ShapeId {
  return SHAPE_IDS.some((id) => id === x);
}

/** The shapes' parameter defaults = the UI schema's slider defaults (a test checks). */
export const DEFAULT_SHAPE_PARAMS: Record<ShapeId, Params> = {
  sphere: {},
  torus: { R: 0.35, r: 0.15 },
  superellipsoid: { e1: 1, e2: 1 },
  supershape: { m1: 6, n11: 1, n12: 7, n13: 8, m2: 4, n21: 10, n22: 10, n23: 10 },
};

const num = (p: Params, k: string, d: number): number => (Number.isFinite(p[k]) ? p[k] : d);

/** signed power: sign(x)·|x|^e */
const spow = (x: number, e: number): number => Math.sign(x) * Math.pow(Math.abs(x), e);

/** Gielis's superformula: r(φ) = (|cos(mφ/4)/a|^n2 + |sin(mφ/4)/b|^n3)^(−1/n1). */
export function superformula(phi: number, m: number, n1: number, n2: number, n3: number): number {
  const t1 = Math.pow(Math.abs(Math.cos((m * phi) / 4)), n2);
  const t2 = Math.pow(Math.abs(Math.sin((m * phi) / 4)), n3);
  const sum = t1 + t2;
  if (sum <= 1e-12) return 10;
  const r = Math.pow(sum, -1 / Math.max(0.05, n1));
  return Math.min(10, r);
}

export interface ShapeResult {
  grid: Grid;
  /** the shape's z extent (for ModContext and the graph) */
  height: number;
}

/** The latitude with a margin from the poles: caps close the holes. */
function latitude(v: number, nv: number): number {
  const delta = Math.PI / (2 * (nv + 2));
  return -Math.PI / 2 + delta + v * (Math.PI - 2 * delta);
}

/**
 * A carrier shape by id. Polar shapes give a grid of nv+1 rows (to close
 * with caps='both'), the torus a wrapV grid with no caps. z is moved to
 * [0, height] (the printing convention, as for revolve).
 */
export function shapeGrid(id: ShapeId, p: Params, nu: number, nv: number): ShapeResult {
  switch (id) {
    case 'sphere': {
      const R = 0.5;
      return {
        height: 2 * R,
        grid: sampleGrid(nu, nv, (u, v, out) => {
          const th = latitude(v, nv);
          out[0] = R * Math.cos(th) * Math.cos(u);
          out[1] = R * Math.cos(th) * Math.sin(u);
          out[2] = R * Math.sin(th) + R;
        }),
      };
    }
    case 'torus': {
      const R = num(p, 'R', 0.35);
      const r = Math.min(num(p, 'r', 0.15), R * 0.95);
      return {
        height: 2 * r,
        grid: sampleTorusGrid(nu, nv, (u, v, out) => {
          const w = 2 * Math.PI * v;
          const rad = R + r * Math.cos(w);
          out[0] = rad * Math.cos(u);
          out[1] = rad * Math.sin(u);
          out[2] = r * Math.sin(w) + r;
        }),
      };
    }
    case 'superellipsoid': {
      const e1 = Math.max(0.1, num(p, 'e1', 1));
      const e2 = Math.max(0.1, num(p, 'e2', 1));
      const R = 0.5;
      return {
        height: 2 * R,
        grid: sampleGrid(nu, nv, (u, v, out) => {
          const th = latitude(v, nv);
          const ct = spow(Math.cos(th), e1);
          out[0] = R * ct * spow(Math.cos(u), e2);
          out[1] = R * ct * spow(Math.sin(u), e2);
          out[2] = R * spow(Math.sin(th), e1) + R;
        }),
      };
    }
    case 'supershape': {
      const m1 = num(p, 'm1', 6);
      const n11 = num(p, 'n11', 1);
      const n12 = num(p, 'n12', 7);
      const n13 = num(p, 'n13', 8);
      const m2 = num(p, 'm2', 4);
      const n21 = num(p, 'n21', 10);
      const n22 = num(p, 'n22', 10);
      const n23 = num(p, 'n23', 10);
      const grid = sampleGrid(nu, nv, (u, v, out) => {
        const th = latitude(v, nv);
        const r1 = superformula(u, m1, n11, n12, n13);
        const r2 = superformula(th, m2, n21, n22, n23);
        out[0] = r1 * Math.cos(u) * r2 * Math.cos(th);
        out[1] = r1 * Math.sin(u) * r2 * Math.cos(th);
        out[2] = r2 * Math.sin(th);
      });
      // normalise: fit into a size of ~1 and lift z to zero
      let maxAbs = 1e-9;
      let zMin = Infinity;
      const pos = grid.positions;
      for (let i = 0; i < pos.length; i += 3) {
        maxAbs = Math.max(maxAbs, Math.abs(pos[i]), Math.abs(pos[i + 1]), Math.abs(pos[i + 2]));
      }
      const s = 0.5 / maxAbs;
      for (let i = 0; i < pos.length; i++) pos[i] *= s;
      for (let i = 2; i < pos.length; i += 3) zMin = Math.min(zMin, pos[i]);
      let zMax = -Infinity;
      for (let i = 2; i < pos.length; i += 3) {
        pos[i] -= zMin;
        zMax = Math.max(zMax, pos[i]);
      }
      return { grid, height: Math.max(zMax, 1e-6) };
    }
  }
}
