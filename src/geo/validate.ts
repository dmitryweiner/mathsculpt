// Чистые проверки меша. Валидатор сообщает, не блокирует (см. план).

import type { SurfaceMesh } from './surface';

export interface MeshReport {
  /** все позиции и нормали конечны */
  finite: boolean;
  /** indices are complete integer triangles and point at existing vertices */
  indicesValid: boolean;
  /** каждое ребро ровно в 2 треугольниках с противоположной ориентацией */
  watertight: boolean;
  /** знаковый объём; > 0 — нормали наружу */
  volume: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  /** треугольники с площадью < eps */
  degenerateTriangles: number;
  triangleCount: number;
  vertexCount: number;
  extents: [number, number, number];
}

export interface ExportAssessment {
  blocking: string[];
  warnings: string[];
}

/** Central export gate shared by the UI and tests. */
export function assessExport(report: MeshReport, shouldBeClosed: boolean): ExportAssessment {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (!report.finite) blocking.push('Mesh contains non-finite coordinates or normals.');
  if (!report.indicesValid) blocking.push('Mesh contains invalid triangle indices.');
  if (report.triangleCount === 0 || report.vertexCount === 0) blocking.push('Mesh is empty.');
  if (report.extents.some((extent) => !Number.isFinite(extent) || extent <= 1e-9)) {
    blocking.push('Mesh has zero extent on at least one axis.');
  }
  if (shouldBeClosed && !report.watertight) blocking.push('Solid mesh is not watertight.');
  if (shouldBeClosed && report.volume < 0) blocking.push('Solid mesh is oriented inside-out.');
  if (report.degenerateTriangles > 0) {
    const ratio = report.triangleCount > 0 ? report.degenerateTriangles / report.triangleCount : 1;
    const message = `${report.degenerateTriangles} degenerate triangle(s) (${(ratio * 100).toFixed(2)}%).`;
    if (ratio > 0.01) blocking.push(message);
    else warnings.push(message);
  }
  return { blocking, warnings };
}

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

export function validateMesh(mesh: SurfaceMesh, areaEps = 1e-12): MeshReport {
  const { positions, indices } = mesh;

  let finite = true;
  for (const values of [positions, mesh.normals]) {
    for (let i = 0; i < values.length; i++) {
      if (Number.isFinite(values[i])) continue;
      finite = false;
      break;
    }
    if (!finite) break;
  }

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      const x = positions[i + c];
      if (x < min[c]) min[c] = x;
      if (x > max[c]) max[c] = x;
    }
  }

  // Рёбра: ключ — упорядоченная пара; balance считает ориентацию (a→b: +1,
  // b→a: −1). Watertight ⇔ каждое ребро встречено дважды и balance = 0.
  const edges = new Map<number, { count: number; balance: number }>();
  const nVerts = positions.length / 3;
  let indicesValid = indices.length % 3 === 0;
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] >= nVerts) {
      indicesValid = false;
      break;
    }
  }
  const edgeKey = (a: number, b: number): number => (a < b ? a * nVerts + b : b * nVerts + a);
  let volume6 = 0;
  let degenerate = 0;
  for (let t = 0; indicesValid && t < indices.length; t += 3) {
    const ia = indices[t];
    const ib = indices[t + 1];
    const ic = indices[t + 2];
    for (const [a, b] of [[ia, ib], [ib, ic], [ic, ia]]) {
      const key = edgeKey(a, b);
      let e = edges.get(key);
      if (!e) {
        e = { count: 0, balance: 0 };
        edges.set(key, e);
      }
      e.count++;
      e.balance += a < b ? 1 : -1;
    }
    const a = ia * 3, b = ib * 3, c = ic * 3;
    const abx = positions[b] - positions[a];
    const aby = positions[b + 1] - positions[a + 1];
    const abz = positions[b + 2] - positions[a + 2];
    const acx = positions[c] - positions[a];
    const acy = positions[c + 1] - positions[a + 1];
    const acz = positions[c + 2] - positions[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const area2 = Math.hypot(nx, ny, nz);
    if (area2 * 0.5 < areaEps) degenerate++;
    // знаковый объём тетраэдра (0, A, B, C) × 6
    volume6 +=
      positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) -
      positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c]) +
      positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  let watertight = indicesValid && indices.length > 0;
  for (const e of edges.values()) {
    if (e.count !== 2 || e.balance !== 0) {
      watertight = false;
      break;
    }
  }

  const extents: [number, number, number] = [
    max[0] - min[0],
    max[1] - min[1],
    max[2] - min[2],
  ];
  return {
    finite,
    indicesValid,
    watertight,
    volume: volume6 / 6,
    bbox: { min, max },
    degenerateTriangles: degenerate,
    triangleCount: indices.length / 3,
    vertexCount: nVerts,
    extents,
  };
}
