// Web Worker: тяжёлая перестройка полной сетки с прогрессом (паттерн
// mandelbulb-worker). Валидация тоже здесь — на полных сетках edge-map дорог
// для главного потока. Буферы уходят обратно transfer'ом.

import { buildMesh } from '../geo/build';
import type { BuildParams } from '../geo/build';
import { validateMesh, overhangFraction } from '../geo/validate';

export interface WorkerProgress {
  type: 'progress';
  t: number;
  phase: string;
}

export interface WorkerDone {
  type: 'done';
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  report: ReturnType<typeof validateMesh>;
  overhang: number;
  buildMs: number;
}

addEventListener('message', (e: MessageEvent) => {
  const params: BuildParams = e.data;
  const t0 = performance.now();
  let lastSent = 0;
  const mesh = buildMesh(params, (t, phase) => {
    // не заливать канал сообщениями: шлём не чаще раза в ~30 мс
    const now = performance.now();
    if (now - lastSent > 30 || t >= 1) {
      lastSent = now;
      const msg: WorkerProgress = { type: 'progress', t: t * 0.85, phase };
      postMessage(msg);
    }
  });
  const report = validateMesh(mesh);
  const overhang = overhangFraction(mesh);
  const done: WorkerDone = {
    type: 'done',
    positions: mesh.positions,
    normals: mesh.normals,
    indices: mesh.indices,
    report,
    overhang,
    buildMs: performance.now() - t0,
  };
  postMessage(done, {
    transfer: [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer],
  });
});
