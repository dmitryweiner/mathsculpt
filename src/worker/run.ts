// What the worker's job builds: the model's full grid in millimetres, its
// report (the kit's check) and its overhangs. No worker or DOM — tested in
// node.

import type { JobProgress } from 'maker-kit/core/progress';
import { validateMesh } from 'maker-kit/3d/validate';
import { buildMesh } from '../geo/build';
import { toMillimetres } from '../geo/millimetres';
import { overhangFraction } from '../geo/overhang';
import { buildParamsOf, cleanState } from '../state/schema';
import type { BuildJob, BuildResult } from './protocol';

export function runJob(job: BuildJob, progress?: (p: JobProgress) => void): BuildResult {
  // the state came through postMessage: cleaned like any from outside
  const state = cleanState(job.state);
  const params = { ...buildParamsOf(state), nu: job.resolution, nv: job.resolution };
  // the core's stages are dictionary codes `stage.<phase>`: the main thread translates them
  const model = buildMesh(params, (share, phase) =>
    progress?.({ step: Math.round(share * 100), total: 100, label: { code: `stage.${phase}` } }),
  );
  const mesh = toMillimetres(model, state.heightMm);
  return { mesh, report: validateMesh(mesh), overhang: overhangFraction(mesh) };
}
