// Встроенные пресеты: id уникальны, имя каждого — в словаре
// (`preset.<id>.name`), состояние проходит sanitize без потерь (все
// id/ключи валидны) и собирается в валидный закрытый меш.
import { PRESETS, PRESET_STATES, presetById } from '../src/state/presets';
import { completeState, defaultState, sanitizeState, stateToParams } from '../src/state/schema';
import { buildMesh } from '../src/geo/build';
import { validateMesh } from 'maker-kit/3d/validate';
import { en } from '../src/i18n/en';

describe('встроенные пресеты', () => {
  it('id уникальны и в виде слага', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('у каждого есть имя в словаре', () => {
    for (const { id } of PRESETS) expect(Object.hasOwn(en, `preset.${id}.name`), id).toBe(true);
  });

  it('presetById находит пресет и не находит чужой', () => {
    expect(presetById('classic-vase')?.id).toBe('classic-vase');
    expect(presetById('nope')).toBeUndefined();
  });

  it.each(PRESETS.map((p) => [p.id] as const))('%s: sanitize ничего не отбрасывает', (id) => {
    const partial = PRESET_STATES[id];
    expect(sanitizeState(partial)).toEqual(partial);
  });

  it.each(PRESETS.map((p) => [p.id] as const))('%s: полное состояние — дефолты под пресетом', (id) => {
    const state = presetById(id)?.build();
    expect(state).toEqual(completeState(PRESET_STATES[id] ?? {}));
    // высоту и стенку пресеты не задают: берутся дефолтные
    expect(state?.heightMm).toBe(defaultState().heightMm);
    expect(state?.wallMm).toBe(defaultState().wallMm);
  });

  it.each(PRESETS.map((p) => [p.id] as const))('%s: строится валидный закрытый меш', (id) => {
    const params = stateToParams(PRESET_STATES[id] ?? {});
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
