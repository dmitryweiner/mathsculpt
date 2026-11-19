// THE CORE: a (u,v) grid → positions/indices. Plain typed arrays, no
// Three.js. The model's axis is z (the printing convention); the view turns it.
//
// The grid is closed in u (the u=0/2π seam is joined by indices, not by
// duplicated vertices): vertex (i, j) → index j*nu + i, i ∈ [0, nu), j ∈ [0, nv].

import type { SurfaceMesh } from 'maker-kit/3d/mesh';

export type CapMode = 'both' | 'bottom' | 'none';

/**
 * The grid's vertex positions; u is closed. Usually v is an open edge (nv+1
 * rows, the bottom j=0, the top j=nv); with wrapV (a torus) v is closed too:
 * nv rows, v = j/nv.
 */
export interface Grid {
  nu: number;
  nv: number;
  /** length nu*gridRows(grid)*3, layout: (j*nu + i)*3 */
  positions: Float32Array;
  wrapV?: boolean;
}

/** The number of the grid's vertex rows. */
export function gridRows(grid: Grid): number {
  return grid.wrapV ? grid.nv : grid.nv + 1;
}

export type GridFn = (u: number, v: number, out: Float64Array) => void;

/** Samples a surface function at the grid's nodes: u = 2π·i/nu, v = j/nv. */
export function sampleGrid(nu: number, nv: number, f: GridFn): Grid {
  if (nu < 3 || nv < 1) throw new Error(`sampleGrid: bad dims ${nu}x${nv}`);
  const positions = new Float32Array(nu * (nv + 1) * 3);
  const out = new Float64Array(3);
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i < nu; i++) {
      const u = (2 * Math.PI * i) / nu;
      f(u, v, out);
      const k = (j * nu + i) * 3;
      positions[k] = out[0];
      positions[k + 1] = out[1];
      positions[k + 2] = out[2];
    }
  }
  return { nu, nv, positions };
}

/**
 * The side surface's indices: quad (i,j) → two triangles, counter-clockwise
 * seen from outside (normals outwards for a solid of revolution with r>0).
 * wrapV closes v too (a torus): the last row of quads joins j=0, and there
 * are nv vertex rows (the grid is sampled with nv rows, not nv+1).
 */
export function gridIndices(nu: number, nv: number, wrapV = false): Uint32Array {
  const rows = wrapV ? nv : nv;
  const rowCount = wrapV ? nv : nv + 1; // vertex rows
  const indices = new Uint32Array(nu * rows * 6);
  let k = 0;
  for (let j = 0; j < rows; j++) {
    const j1 = wrapV ? (j + 1) % rowCount : j + 1;
    for (let i = 0; i < nu; i++) {
      const i1 = (i + 1) % nu;
      const a = j * nu + i;
      const b = j * nu + i1;
      const c = j1 * nu + i1;
      const d = j1 * nu + i;
      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = a;
      indices[k++] = c;
      indices[k++] = d;
    }
  }
  return indices;
}

/** A grid closed in both u and v (a torus): nu×nv vertices, v = j/nv. */
export function sampleTorusGrid(nu: number, nv: number, f: GridFn): Grid {
  if (nu < 3 || nv < 3) throw new Error(`sampleTorusGrid: bad dims ${nu}x${nv}`);
  const positions = new Float32Array(nu * nv * 3);
  const out = new Float64Array(3);
  for (let j = 0; j < nv; j++) {
    const v = j / nv;
    for (let i = 0; i < nu; i++) {
      const u = (2 * Math.PI * i) / nu;
      f(u, v, out);
      const k = (j * nu + i) * 3;
      positions[k] = out[0];
      positions[k + 1] = out[1];
      positions[k + 2] = out[2];
    }
  }
  return { nu, nv, positions, wrapV: true };
}

/** A torus mesh: no caps, the u and v seams joined by indices. */
export function assembleTorusMesh(grid: Grid): Omit<SurfaceMesh, 'normals'> {
  return { positions: new Float32Array(grid.positions), indices: gridIndices(grid.nu, grid.nv, true) };
}

/**
 * A hollow vessel with an open top: the outer shell (walls + floor) + the
 * inner one (walls + the cavity's floor) + a ring rim on top. Unlike
 * caps='bottom' (zero thickness, vase mode), this is a watertight solid that
 * prints as an ordinary model. `inner` holds the positions moved inwards,
 * laid out as outer.positions (nu*(nv+1)).
 */
export function assembleHollowMesh(outer: Grid, inner: Float32Array): Omit<SurfaceMesh, 'normals'> {
  const { nu, nv } = outer;
  const nGrid = nu * (nv + 1);
  const outPos = new Float32Array((2 * nGrid + 2) * 3);
  outPos.set(outer.positions, 0);
  outPos.set(inner, nGrid * 3);
  const oBase = 0;
  const iBase = nGrid;
  const oCap = 2 * nGrid; // the outer floor's centroid
  const iCap = 2 * nGrid + 1; // the cavity floor's centroid

  const wallTris = nu * nv * 2 * 2; // outer + inner walls
  const capTris = nu * 2; // the outer floor + the cavity's floor
  const rimTris = nu * 2; // the top rim ring
  const indices = new Uint32Array((wallTris + capTris + rimTris) * 3);
  let k = 0;

  // outer walls (normals outwards)
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i1 = (i + 1) % nu;
      const a = oBase + j * nu + i;
      const b = oBase + j * nu + i1;
      const c = oBase + (j + 1) * nu + i1;
      const d = oBase + (j + 1) * nu + i;
      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = a;
      indices[k++] = c;
      indices[k++] = d;
    }
  }
  // inner walls (normals inwards = the reverse winding)
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i1 = (i + 1) % nu;
      const a = iBase + j * nu + i;
      const b = iBase + (j + 1) * nu + i;
      const c = iBase + (j + 1) * nu + i1;
      const d = iBase + j * nu + i1;
      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = a;
      indices[k++] = c;
      indices[k++] = d;
    }
  }

  const centroid = (base: number, dst: number): void => {
    let x = 0,
      y = 0,
      z = 0;
    for (let i = 0; i < nu; i++) {
      const p = (base + i) * 3;
      x += outPos[p];
      y += outPos[p + 1];
      z += outPos[p + 2];
    }
    outPos[dst * 3] = x / nu;
    outPos[dst * 3 + 1] = y / nu;
    outPos[dst * 3 + 2] = z / nu;
  };
  centroid(oBase, oCap);
  centroid(iBase, iCap);

  // the outer floor (normal down)
  for (let i = 0; i < nu; i++) {
    indices[k++] = oCap;
    indices[k++] = oBase + ((i + 1) % nu);
    indices[k++] = oBase + i;
  }
  // the cavity's floor (normal up)
  for (let i = 0; i < nu; i++) {
    indices[k++] = iCap;
    indices[k++] = iBase + i;
    indices[k++] = iBase + ((i + 1) % nu);
  }
  // the top rim: a ring between the outer and inner top rows (normal up)
  const oTop = oBase + nv * nu;
  const iTop = iBase + nv * nu;
  for (let i = 0; i < nu; i++) {
    const i1 = (i + 1) % nu;
    indices[k++] = oTop + i;
    indices[k++] = oTop + i1;
    indices[k++] = iTop + i1;
    indices[k++] = oTop + i;
    indices[k++] = iTop + i1;
    indices[k++] = iTop + i;
  }
  return { positions: outPos, indices };
}

/**
 * Assembles a mesh from a grid: the side triangles + caps fanned from the
 * centroid of the boundary ring. No normals here — the kit's meshNormals.
 */
export function assembleMesh(grid: Grid, caps: CapMode): Omit<SurfaceMesh, 'normals'> {
  const { nu, nv, positions } = grid;
  const side = gridIndices(nu, nv);
  const bottom = caps === 'both' || caps === 'bottom';
  const top = caps === 'both';
  const extra = (bottom ? 1 : 0) + (top ? 1 : 0);
  const nGrid = nu * (nv + 1);

  const outPos = new Float32Array((nGrid + extra) * 3);
  outPos.set(positions);
  const capTris = (bottom ? nu : 0) + (top ? nu : 0);
  const indices = new Uint32Array(side.length + capTris * 3);
  indices.set(side);
  let k = side.length;
  let nextVertex = nGrid;

  const centroid = (j: number): [number, number, number] => {
    let x = 0,
      y = 0,
      z = 0;
    for (let i = 0; i < nu; i++) {
      const p = (j * nu + i) * 3;
      x += positions[p];
      y += positions[p + 1];
      z += positions[p + 2];
    }
    return [x / nu, y / nu, z / nu];
  };

  if (bottom) {
    const c = nextVertex++;
    const [x, y, z] = centroid(0);
    outPos[c * 3] = x;
    outPos[c * 3 + 1] = y;
    outPos[c * 3 + 2] = z;
    // the bottom: clockwise (seen from outside, below), normal −z
    for (let i = 0; i < nu; i++) {
      indices[k++] = c;
      indices[k++] = (i + 1) % nu;
      indices[k++] = i;
    }
  }
  if (top) {
    const c = nextVertex;
    const [x, y, z] = centroid(nv);
    outPos[c * 3] = x;
    outPos[c * 3 + 1] = y;
    outPos[c * 3 + 2] = z;
    const ring = nv * nu;
    for (let i = 0; i < nu; i++) {
      indices[k++] = c;
      indices[k++] = ring + i;
      indices[k++] = ring + ((i + 1) % nu);
    }
  }
  return { positions: outPos, indices };
}
