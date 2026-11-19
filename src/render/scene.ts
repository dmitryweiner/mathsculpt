// The 3D view is the kit's (`maker-kit/3d/viewer`): the light, the bed grid,
// the camera, frames on demand, room for the phone's sheet. The app's own is
// only the material: the blue-grey plastic it had before the kit. The mesh
// comes in millimetres, z up. Keep it thin: vitest does not load it; the
// smoke checks it.

import * as THREE from 'three';
import type { IndexedMesh } from 'maker-kit/3d/mesh';
import { createViewer } from 'maker-kit/3d/viewer';

const MATERIAL_COLOR = 0xb8c7d8;
/** the printer's bed: the grid is at least this big */
const BED_MM = 200;

export interface SceneView {
  show(mesh: IndexedMesh): void;
  /** how much of the view's bottom the phone's sheet covers, px (the kit's `ui/sheet`) */
  setInset(px: number): void;
}

/** The view, or null without WebGL: the app works without it. */
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
