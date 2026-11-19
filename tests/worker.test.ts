// Граница воркера — такая же внешняя граница, как файл или хранилище:
// задачу проверяет isBuildJob (serveJobs кита отвечает ошибкой на чужую),
// а состояние в ней воркер чистит сам. Сборка задачи — в node.
import type { JobProgress } from 'maker-kit/core/progress';
import { isBuildJob, RESOLUTIONS } from '../src/worker/protocol';
import { runJob } from '../src/worker/run';
import { defaultState } from '../src/state/schema';

describe('isBuildJob', () => {
  it('берёт задачу полной сборки и выгрузки', () => {
    expect(isBuildJob({ kind: 'full', state: defaultState(), resolution: 256 })).toBe(true);
    expect(isBuildJob({ kind: 'export', state: defaultState(), resolution: 512 })).toBe(true);
  });

  it('чужое — нет', () => {
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

  it('детализации — те, что в строке «Full res»', () => {
    expect(RESOLUTIONS).toEqual([192, 256, 384, 512]);
  });
});

describe('runJob', () => {
  it('меш в миллиметрах, его отчёт и свесы; этапы ядра — коды stage.*', () => {
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

  it('состояние из задачи чистится: высота за пределом — в предел', () => {
    const result = runJob({ kind: 'full', state: { ...defaultState(), heightMm: 99999 }, resolution: 192 });
    expect(result.report.extents[2]).toBeCloseTo(400, 2);
  });
});
