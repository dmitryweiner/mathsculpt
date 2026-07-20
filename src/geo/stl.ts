// Binary STL (little-endian): 80 байт заголовок, uint32 число треугольников,
// на треугольник — нормаль (3×f32), три вершины (9×f32), uint16 атрибут.
// Единицы — миллиметры: scale переводит единицы модели в мм.

import type { SurfaceMesh } from './surface';

export interface StlOptions {
  /** множитель модель→мм */
  scale: number;
  /** до 80 ASCII-символов в заголовок */
  name?: string;
}

export function encodeSTL(mesh: Pick<SurfaceMesh, 'positions' | 'indices'>, o: StlOptions): ArrayBuffer {
  const { positions, indices } = mesh;
  const triCount = indices.length / 3;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const dv = new DataView(buf);
  const header = `MathSculpt ${o.name ?? ''}`.slice(0, 80);
  const enc = new TextEncoder();
  enc.encodeInto(header, new Uint8Array(buf, 0, 80));
  dv.setUint32(80, triCount, true);
  let off = 84;
  const s = o.scale;
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
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-30) {
      nx /= len;
      ny /= len;
      nz /= len;
    }
    dv.setFloat32(off, nx, true);
    dv.setFloat32(off + 4, ny, true);
    dv.setFloat32(off + 8, nz, true);
    off += 12;
    for (const v of [a, b, c]) {
      dv.setFloat32(off, positions[v] * s, true);
      dv.setFloat32(off + 4, positions[v + 1] * s, true);
      dv.setFloat32(off + 8, positions[v + 2] * s, true);
      off += 12;
    }
    dv.setUint16(off, 0, true);
    off += 2;
  }
  return buf;
}
