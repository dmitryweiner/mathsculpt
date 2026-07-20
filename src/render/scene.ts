// Three.js-слой: сцена, свет, orbit-камера, материал. Принимает готовые
// буферы из ядра и ничего не знает о формулах. Модель в ядре z-up (печатная
// конвенция) — группа повёрнута в y-up для показа. Держать тонким: в vitest
// не грузится, проверяется смоуком.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SurfaceMesh } from '../geo/surface';

export interface SceneHandle {
  setMesh(mesh: SurfaceMesh): void;
  dispose(): void;
}

const CLEAR_COLOR = 0x11151a;
const MATERIAL_COLOR = 0xb8c7d8;

export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(CLEAR_COLOR);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(1.4, 0.9, 1.4);

  scene.add(new THREE.HemisphereLight(0xcfdfef, 0x2a3440, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 3, 2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9ab8d0, 0.5);
  fill.position.set(-2, 1, -1.5);
  scene.add(fill);

  // z-up (модель) → y-up (экран)
  const group = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  scene.add(group);

  const material = new THREE.MeshStandardMaterial({
    color: MATERIAL_COLOR,
    metalness: 0.05,
    roughness: 0.55,
  });

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  let meshObj: THREE.Mesh | null = null;
  let disposed = false;

  function resize(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function frame(): void {
    if (disposed) return;
    resize();
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setMesh(mesh: SurfaceMesh): void {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
      geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
      geometry.computeBoundingBox();
      const bb = geometry.boundingBox;
      if (meshObj) {
        meshObj.geometry.dispose();
        meshObj.geometry = geometry;
      } else {
        meshObj = new THREE.Mesh(geometry, material);
        group.add(meshObj);
      }
      if (bb) {
        // центр модели в начало координат (в z-up координатах ядра)
        const c = new THREE.Vector3();
        bb.getCenter(c);
        meshObj.position.set(-c.x, -c.y, -c.z);
        const size = new THREE.Vector3();
        bb.getSize(size);
        controls.target.set(0, 0, 0);
        const radius = Math.max(size.x, size.y, size.z);
        if (camera.position.length() < radius * 0.8 || camera.position.length() > radius * 8) {
          camera.position.setLength(radius * 1.9);
        }
      }
    },
    dispose(): void {
      disposed = true;
      controls.dispose();
      meshObj?.geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
