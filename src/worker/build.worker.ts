// The full build's Web Worker — a thin adapter: the queue and the protocol
// are the kit's (`serveJobs`), what a job builds is `run.ts`. The mesh goes
// back by moving its buffers, not copying them: at 512² they are megabytes.

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
