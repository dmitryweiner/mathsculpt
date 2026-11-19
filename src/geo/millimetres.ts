// The boundary of units. The core works in relative model units; the kit's
// view, the checks and the STL in millimetres. A mesh is scaled as a whole
// so that its height in z becomes the model's height in mm: the same
// proportions, the same normal and index arrays.

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
