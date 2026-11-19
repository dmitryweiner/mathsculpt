// The worker's job and its check. The worker's boundary is as much an outer
// boundary as a file or storage: the kit's `serveJobs` answers what
// `isBuildJob` refuses with an error, and the worker cleans the job's state
// itself anyway (`runJob`).

import type { SurfaceMesh } from 'maker-kit/3d/mesh';
import type { MeshReport } from 'maker-kit/3d/validate';
import type { AppState } from '../state/schema';
import { sanitizeState } from '../state/schema';

/** The full build's resolutions — the Full res row. */
export const RESOLUTIONS = [192, 256, 384, 512] as const;

export interface BuildJob {
  /** full — the model after an edit; export — by the button: a fresh edit never replaces it */
  kind: 'full' | 'export';
  state: AppState;
  resolution: number;
}

export interface BuildResult {
  /** the mesh in millimetres */
  mesh: SurfaceMesh;
  report: MeshReport;
  /** the share of overhangs steeper than 60° */
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
