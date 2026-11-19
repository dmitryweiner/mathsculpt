// Web Worker полной сборки — тонкий переходник: очередь и протокол —
// китовые (`serveJobs`), что строит задача — `run.ts`. Меш уходит обратно
// переносом буферов, а не копией: на 512² это мегабайты.

import { serveJobs } from 'maker-kit/worker/serve';
import type { BuildJob, BuildResult } from './protocol';
import { isBuildJob } from './protocol';
import { runJob } from './run';

serveJobs<BuildJob, BuildResult>({
  isJob: isBuildJob,
  handle(job, progress) {
    const result = runJob(job, progress);
    const { positions, normals, indices } = result.mesh;
    return { result, transfer: [positions.buffer, normals.buffer, indices.buffer] };
  },
});
