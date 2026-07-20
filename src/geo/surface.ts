// ЯДРО: сетка (u,v) → позиции/индексы. Чистые типизированные массивы,
// без Three.js. Ось модели — z (печатная конвенция), рендер сам повернёт.
//
// Сетка замкнута по u (шов u=0/2π сшит индексами, не дублированием вершин):
// вершина (i, j) → индекс j*nu + i, где i ∈ [0, nu), j ∈ [0, nv].

export type CapMode = 'both' | 'bottom' | 'none';

/**
 * Позиции вершин сетки; u замкнут. Обычно v — открытый край (nv+1 рядов,
 * низ j=0, верх j=nv); при wrapV (тор) v тоже замкнут: nv рядов, v = j/nv.
 */
export interface Grid {
  nu: number;
  nv: number;
  /** длина nu*gridRows(grid)*3, layout: (j*nu + i)*3 */
  positions: Float32Array;
  wrapV?: boolean;
}

/** Число вершинных рядов сетки. */
export function gridRows(grid: Grid): number {
  return grid.wrapV ? grid.nv : grid.nv + 1;
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
 * wrapV — замыкание и по v (тор): последний ряд квадов сшивается с j=0,
 * вершинных рядов при этом nv (сетка семплируется с nv рядами, не nv+1).
 */
export function gridIndices(nu: number, nv: number, wrapV = false): Uint32Array {
  const rows = wrapV ? nv : nv;
  const rowCount = wrapV ? nv : nv + 1; // вершинных рядов
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

/** Сетка, замкнутая и по u, и по v (тор): nu×nv вершин, v = j/nv. */
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

/** Меш тора: без крышек, шов по u и v сшит индексами. */
export function assembleTorusMesh(grid: Grid): Omit<SurfaceMesh, 'normals'> {
  return { positions: new Float32Array(grid.positions), indices: gridIndices(grid.nu, grid.nv, true) };
}

/**
 * Полый сосуд с открытым верхом: внешняя оболочка (стенки + дно) + внутренняя
 * (стенки + дно полости) + кольцевой ободок сверху. В отличие от caps='bottom'
 * (нулевая толщина, vase-mode), это watertight-солид, печатаемый как обычная
 * модель. `inner` — позиции, смещённые внутрь вдоль нормали, той же раскладки
 * (nu*(nv+1)), что и outer.positions.
 */
export function assembleHollowMesh(outer: Grid, inner: Float32Array): Omit<SurfaceMesh, 'normals'> {
  const { nu, nv } = outer;
  const nGrid = nu * (nv + 1);
  const outPos = new Float32Array((2 * nGrid + 2) * 3);
  outPos.set(outer.positions, 0);
  outPos.set(inner, nGrid * 3);
  const oBase = 0;
  const iBase = nGrid;
  const oCap = 2 * nGrid; // центроид внешнего дна
  const iCap = 2 * nGrid + 1; // центроид дна полости

  const wallTris = nu * nv * 2 * 2; // внешние + внутренние стенки
  const capTris = nu * 2; // внешнее дно + дно полости
  const rimTris = nu * 2; // верхний ободок-кольцо
  const indices = new Uint32Array((wallTris + capTris + rimTris) * 3);
  let k = 0;

  // внешние стенки (нормаль наружу)
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i1 = (i + 1) % nu;
      const a = oBase + j * nu + i;
      const b = oBase + j * nu + i1;
      const c = oBase + (j + 1) * nu + i1;
      const d = oBase + (j + 1) * nu + i;
      indices[k++] = a; indices[k++] = b; indices[k++] = c;
      indices[k++] = a; indices[k++] = c; indices[k++] = d;
    }
  }
  // внутренние стенки (нормаль внутрь = обратный обход)
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i1 = (i + 1) % nu;
      const a = iBase + j * nu + i;
      const b = iBase + (j + 1) * nu + i;
      const c = iBase + (j + 1) * nu + i1;
      const d = iBase + j * nu + i1;
      indices[k++] = a; indices[k++] = b; indices[k++] = c;
      indices[k++] = a; indices[k++] = c; indices[k++] = d;
    }
  }

  const centroid = (base: number, dst: number): void => {
    let x = 0, y = 0, z = 0;
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

  // внешнее дно (нормаль вниз)
  for (let i = 0; i < nu; i++) {
    indices[k++] = oCap; indices[k++] = oBase + ((i + 1) % nu); indices[k++] = oBase + i;
  }
  // дно полости (нормаль вверх)
  for (let i = 0; i < nu; i++) {
    indices[k++] = iCap; indices[k++] = iBase + i; indices[k++] = iBase + ((i + 1) % nu);
  }
  // верхний ободок: кольцо между внешним и внутренним верхними рядами (нормаль вверх)
  const oTop = oBase + nv * nu;
  const iTop = iBase + nv * nu;
  for (let i = 0; i < nu; i++) {
    const i1 = (i + 1) % nu;
    indices[k++] = oTop + i; indices[k++] = oTop + i1; indices[k++] = iTop + i1;
    indices[k++] = oTop + i; indices[k++] = iTop + i1; indices[k++] = iTop + i;
  }
  return { positions: outPos, indices };
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
