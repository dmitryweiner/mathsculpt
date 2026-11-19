// The worker's boundary is as much an outer one as a file or storage:
// isBuildJob checks the job (the kit's serveJobs answers a foreign one with
// an error), and the worker cleans its state itself. A job's build is tested
// in node.
import type { JobProgress } from 'maker-kit/core/progress';
import { isBuildJob, RESOLUTIONS } from '../src/worker/protocol';
import { runJob } from '../src/worker/run';
import { defaultState } from '../src/state/schema';

describe('isBuildJob', () => {
  it('takes a full build job and an export job', () => {
    expect(isBuildJob({ kind: 'full', state: defaultState(), resolution: 256 })).toBe(true);
    expect(isBuildJob({ kind: 'export', state: defaultState(), resolution: 512 })).toBe(true);
  });

  it('nothing foreign', () => {
    for (const raw of [
      null,
      42,
      {},
      { kind: 'full', state: defaultState() },
      { kind: 'full', state: defaultState(), resolution: 100000 },
      { kind: 'full', state: defaultState(), resolution: '256' },
      { kind: 'preview', state: defaultState(), resolution: 256 },
      { kind: 'full', state: 'vase', resolution: 256 },
    ]) {
      expect(isBuildJob(raw), JSON.stringify(raw)).toBe(false);
    }
  });

  it('the resolutions are those of the Full res row', () => {
    expect(RESOLUTIONS).toEqual([192, 256, 384, 512]);
  });
});

describe('runJob', () => {
  it('a mesh in millimetres, its report and overhangs; the core stages are stage.* codes', () => {
    const progress: JobProgress[] = [];
    const result = runJob({ kind: 'full', state: { ...defaultState(), heightMm: 80 }, resolution: 192 }, (p) => progress.push(p));
    expect(result.report.watertight).toBe(true);
    expect(result.report.extents[2]).toBeCloseTo(80, 3);
    expect(result.report.triangleCount).toBe(result.mesh.indices.length / 3);
    expect(result.overhang).toBeGreaterThanOrEqual(0);
    expect(progress.length).toBeGreaterThan(2);
    for (const p of progress) expect(p.label?.code).toMatch(/^stage\./);
    expect(progress.at(-1)).toMatchObject({ step: 100, total: 100 });
  });

  it('the job state is cleaned: a height past the limit is clamped', () => {
    const result = runJob({ kind: 'full', state: { ...defaultState(), heightMm: 99999 }, resolution: 192 });
    expect(result.report.extents[2]).toBeCloseTo(400, 2);
  });
});
