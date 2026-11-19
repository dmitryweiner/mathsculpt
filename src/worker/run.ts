// Что строит задача воркера: полную сетку модели в миллиметрах, её отчёт
// (проверка кита) и свесы. Без воркера и DOM — проверяется в node.

import type { JobProgress } from 'maker-kit/core/progress';
import { validateMesh } from 'maker-kit/3d/validate';
import { buildMesh } from '../geo/build';
import { toMillimetres } from '../geo/millimetres';
import { overhangFraction } from '../geo/overhang';
import { buildParamsOf, cleanState } from '../state/schema';
import type { BuildJob, BuildResult } from './protocol';

export function runJob(job: BuildJob, progress?: (p: JobProgress) => void): BuildResult {
  // состояние пришло через postMessage: чистится, как любое извне
  const state = cleanState(job.state);
  const params = { ...buildParamsOf(state), nu: job.resolution, nv: job.resolution };
  // этапы ядра — коды словаря `stage.<phase>`: переводит главный поток
  const model = buildMesh(params, (share, phase) =>
    progress?.({ step: Math.round(share * 100), total: 100, label: { code: `stage.${phase}` } }),
  );
  const mesh = toMillimetres(model, state.heightMm);
  return { mesh, report: validateMesh(mesh), overhang: overhangFraction(mesh) };
}
