// Свесы для FDM-печати: доля поверхности, нависающей круче предела.
// Своё у MathSculpt; проверка меша и сито экспорта — китовые (`maker-kit/3d/validate`).

import type { SurfaceMesh } from './surface';

/**
 * Доля площади, нависающей круче limitDeg от вертикали (плохо для FDM).
 * Грани у самого дна (первые слои на столе) не считаются.
 */
export function overhangFraction(mesh: Pick<SurfaceMesh, 'positions' | 'indices'>, limitDeg = 60): number {
  const { positions, indices } = mesh;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 2; i < positions.length; i += 3) {
    if (positions[i] < zMin) zMin = positions[i];
    if (positions[i] > zMax) zMax = positions[i];
  }
  const bedZ = zMin + 0.02 * (zMax - zMin);
  const sinLimit = Math.sin((limitDeg * Math.PI) / 180);
  let total = 0;
  let bad = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    if (positions[a + 2] < bedZ && positions[b + 2] < bedZ && positions[c + 2] < bedZ) continue;
    const abx = positions[b] - positions[a];
    const aby = positions[b + 1] - positions[a + 1];
    const abz = positions[b + 2] - positions[a + 2];
    const acx = positions[c] - positions[a];
    const acy = positions[c + 1] - positions[a + 1];
    const acz = positions[c + 2] - positions[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-30) continue;
    total += len;
    if (nz / len < -sinLimit) bad += len;
  }
  return total > 0 ? bad / total : 0;
}
