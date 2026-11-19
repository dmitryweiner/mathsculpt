// Граница единиц. Ядро считает в относительных единицах модели; вид кита,
// проверки и STL — в миллиметрах. Меш масштабируется целиком так, чтобы
// его высота по z стала высотой модели в мм: пропорции те же, нормали и
// индексы — те же массивы.

import type { SurfaceMesh } from 'maker-kit/3d/mesh';

export function toMillimetres(mesh: SurfaceMesh, heightMm: number): SurfaceMesh {
  const { positions } = mesh;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 2; i < positions.length; i += 3) {
    const z = positions[i] ?? 0;
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }
  const extent = zMax - zMin;
  const scale = extent > 0 ? heightMm / extent : 1;
  const scaled = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i++) scaled[i] = (positions[i] ?? 0) * scale;
  return { positions: scaled, normals: mesh.normals, indices: mesh.indices };
}
