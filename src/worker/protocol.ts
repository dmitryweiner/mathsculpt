// Задача воркера и её проверка. Граница воркера — такая же внешняя граница,
// как файл или хранилище: `serveJobs` кита отвечает ошибкой на то, что
// `isBuildJob` не берёт, а состояние задачи воркер всё равно чистит сам
// (`runJob`).

import type { SurfaceMesh } from 'maker-kit/3d/mesh';
import type { MeshReport } from 'maker-kit/3d/validate';
import type { AppState } from '../state/schema';
import { sanitizeState } from '../state/schema';

/** Детализации полной сборки — строка «Full res». */
export const RESOLUTIONS = [192, 256, 384, 512] as const;

export interface BuildJob {
  /** full — модель после правки; export — по кнопке: свежая правка её не вытесняет */
  kind: 'full' | 'export';
  state: AppState;
  resolution: number;
}

export interface BuildResult {
  /** меш в миллиметрах */
  mesh: SurfaceMesh;
  report: MeshReport;
  /** доля свесов круче 60° */
  overhang: number;
}

export function isBuildJob(raw: unknown): raw is BuildJob {
  if (typeof raw !== 'object' || raw === null) return false;
  const kind: unknown = Reflect.get(raw, 'kind');
  const resolution: unknown = Reflect.get(raw, 'resolution');
  return (
    (kind === 'full' || kind === 'export') && RESOLUTIONS.some((r) => r === resolution) && sanitizeState(Reflect.get(raw, 'state')) !== null
  );
}
