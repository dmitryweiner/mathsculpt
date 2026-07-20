// Нормали: по сетке (для направления смещений) и по мешу (для рендера/STL).
// Шов u=0/2π учитывается автоматически: сетка замкнута по u индексной
// арифметикой, меш — общими вершинами.

import type { Grid } from './surface';
import { gridRows } from './surface';

/**
 * Нормали в узлах сетки центральными разностями:
 * n = ∂P/∂u × ∂P/∂v (наружу при обходе u против часовой и v вверх).
 * На краях v — односторонние разности. Вырожденные — fallback (0,0,±1).
 */
export function gridNormals(grid: Grid): Float32Array {
  const { nu, nv, positions } = grid;
  const rows = gridRows(grid);
  const normals = new Float32Array(nu * rows * 3);
  const p = (i: number, j: number, c: number): number => positions[(j * nu + ((i + nu) % nu)) * 3 + c];
  for (let j = 0; j < rows; j++) {
    const j0 = grid.wrapV ? (j - 1 + rows) % rows : Math.max(0, j - 1);
    const j1 = grid.wrapV ? (j + 1) % rows : Math.min(nv, j + 1);
    for (let i = 0; i < nu; i++) {
      const tux = p(i + 1, j, 0) - p(i - 1, j, 0);
      const tuy = p(i + 1, j, 1) - p(i - 1, j, 1);
      const tuz = p(i + 1, j, 2) - p(i - 1, j, 2);
      const tvx = p(i, j1, 0) - p(i, j0, 0);
      const tvy = p(i, j1, 1) - p(i, j0, 1);
      const tvz = p(i, j1, 2) - p(i, j0, 2);
      let nx = tuy * tvz - tuz * tvy;
      let ny = tuz * tvx - tux * tvz;
      let nz = tux * tvy - tuy * tvx;
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-12) {
        nx /= len;
        ny /= len;
        nz /= len;
      } else {
        nx = 0;
        ny = 0;
        nz = j === 0 ? -1 : 1;
      }
      const k = (j * nu + i) * 3;
      normals[k] = nx;
      normals[k + 1] = ny;
      normals[k + 2] = nz;
    }
  }
  return normals;
}

/** Пер-вершинные нормали меша: сумма нормалей граней (взвешено площадью), нормировка. */
export function meshNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const abx = positions[b] - positions[a];
    const aby = positions[b + 1] - positions[a + 1];
    const abz = positions[b + 2] - positions[a + 2];
    const acx = positions[c] - positions[a];
    const acy = positions[c + 1] - positions[a + 1];
    const acz = positions[c + 2] - positions[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const v of [a, b, c]) {
      normals[v] += nx;
      normals[v + 1] += ny;
      normals[v + 2] += nz;
    }
  }
  for (let v = 0; v < normals.length; v += 3) {
    const len = Math.hypot(normals[v], normals[v + 1], normals[v + 2]);
    if (len > 1e-12) {
      normals[v] /= len;
      normals[v + 1] /= len;
      normals[v + 2] /= len;
    }
  }
  return normals;
}
