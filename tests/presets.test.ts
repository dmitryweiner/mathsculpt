// Встроенные пресеты: имена уникальны, состояние проходит sanitize без потерь
// (все id/ключи валидны) и собирается в валидный закрытый меш.
import { PRESETS } from '../src/presets';
import { sanitizeState, stateToParams } from '../src/state/schema';
import { buildMesh } from '../src/geo/build';
import { validateMesh } from '../src/geo/validate';

describe('встроенные пресеты', () => {
  it('имена уникальны', () => {
    const names = PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(PRESETS.map((p) => [p.name] as const))('%s: sanitize ничего не отбрасывает', (name) => {
    const preset = PRESETS.find((p) => p.name === name);
    if (!preset) throw new Error('missing');
    const out = sanitizeState(preset.state);
    expect(out).toEqual(preset.state);
  });

  it.each(PRESETS.map((p) => [p.name] as const))('%s: строится валидный закрытый меш', (name) => {
    const preset = PRESETS.find((p) => p.name === name);
    if (!preset) throw new Error('missing');
    const params = stateToParams(preset.state);
    params.nu = 48;
    params.nv = 48;
    const report = validateMesh(buildMesh(params));
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeGreaterThan(0);
    // quantize по построению схлопывает часть треугольников в плоские
    if (!params.deform.quantize.on) expect(report.degenerateTriangles).toBe(0);
  });
});
