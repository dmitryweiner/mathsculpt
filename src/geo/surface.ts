// ЯДРО: сетка (u,v) → позиции/индексы. Чистые типизированные массивы,
// без Three.js. Ось модели — z (печатная конвенция), рендер сам повернёт.
//
// Сетка замкнута по u (шов u=0/2π сшит индексами, не дублированием вершин):
// вершина (i, j) → индекс j*nu + i, где i ∈ [0, nu), j ∈ [0, nv].

export type CapMode = 'both' | 'bottom' | 'none';

/** Позиции вершин сетки; u замкнут, v — открытый край (низ j=0, верх j=nv). */
export interface Grid {
  nu: number;
  nv: number;
  /** длина nu*(nv+1)*3, layout: (j*nu + i)*3 */
  positions: Float32Array;
}

/** Готовый меш: позиции + нормали вершин + индексы треугольников. */
export interface SurfaceMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export type GridFn = (u: number, v: number, out: Float64Array) => void;

/** Семплирует функцию поверхности в узлах сетки: u = 2π·i/nu, v = j/nv. */
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
 * Индексы боковой поверхности: квад (i,j) → два треугольника, обход против
 * часовой при взгляде снаружи (нормали наружу для тела вращения r>0).
 */
export function gridIndices(nu: number, nv: number): Uint32Array {
  const indices = new Uint32Array(nu * nv * 6);
  let k = 0;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i1 = (i + 1) % nu;
      const a = j * nu + i;
      const b = j * nu + i1;
      const c = (j + 1) * nu + i1;
      const d = (j + 1) * nu + i;
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

/**
 * Собирает меш из сетки: боковые треугольники + крышки веером из центроида
 * граничного кольца. Нормали не считает — см. normals.ts/meshNormals.
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
    let x = 0, y = 0, z = 0;
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
    // низ: обход по часовой (снаружи снизу), нормаль −z
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
