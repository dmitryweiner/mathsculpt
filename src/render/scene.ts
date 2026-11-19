// 3D-вид — китовый (`maker-kit/3d/viewer`): свет, сетка стола, камера,
// кадры по запросу, место под листом на телефоне. Своё — только материал:
// голубовато-серый пластик, как был до кита. Меш приходит в миллиметрах,
// z вверх. Держать тонким: в vitest не грузится, проверяется смоуком.

import * as THREE from 'three';
import type { IndexedMesh } from 'maker-kit/3d/mesh';
import { createViewer } from 'maker-kit/3d/viewer';

const MATERIAL_COLOR = 0xb8c7d8;
/** стол принтера: сетка не меньше него */
const BED_MM = 200;

export interface SceneView {
  show(mesh: IndexedMesh): void;
  /** сколько низа вида закрывает лист на телефоне, px (`ui/sheet` кита) */
  setInset(px: number): void;
}

/** Вид или null без WebGL: приложение работает и без него. */
export function createScene(canvas: HTMLCanvasElement): SceneView | null {
  const viewer = createViewer(canvas);
  if (!viewer) return null;
  viewer.fitBed(BED_MM, BED_MM);
  const material = new THREE.MeshStandardMaterial({ color: MATERIAL_COLOR, metalness: 0.05, roughness: 0.55 });
  return {
    show: (mesh) => viewer.setMeshes([{ mesh, material }]),
    setInset: (px) => viewer.setInset(px),
  };
}
