// Built-in presets: unique ids, each one's name in the dictionary
// (`preset.<id>.name`), the state passes sanitize with no loss (every id and
// key valid) and builds a valid closed mesh.
import { BLANK_ID, PRESETS, PRESET_STATES, presetById } from '../src/state/presets';
import { completeState, defaultState, sanitizeState, stateToParams } from '../src/state/schema';
import { buildMesh } from '../src/geo/build';
import { validateMesh } from 'maker-kit/3d/validate';
import { en } from '../src/i18n/en';

describe('built-in presets', () => {
  it('ids are unique slugs', () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('each has a name in the dictionary', () => {
    for (const { id } of PRESETS) expect(Object.hasOwn(en, `preset.${id}.name`), id).toBe(true);
  });

  it('📄 New is the blank preset: the default model, not listed', () => {
    const blank = presetById(BLANK_ID);
    expect(blank?.listed).toBe(false);
    expect(blank?.build()).toEqual(defaultState());
    expect(PRESETS.filter((p) => p.listed !== false).map((p) => p.id)).toEqual(Object.keys(PRESET_STATES));
  });

  it('presetById finds a preset and no foreign one', () => {
    expect(presetById('classic-vase')?.id).toBe('classic-vase');
    expect(presetById('nope')).toBeUndefined();
  });

  it.each(Object.keys(PRESET_STATES).map((id) => [id] as const))('%s: sanitize drops nothing', (id) => {
    const partial = PRESET_STATES[id];
    expect(sanitizeState(partial)).toEqual(partial);
  });

  it.each(Object.keys(PRESET_STATES).map((id) => [id] as const))('%s: the whole state is the defaults under the preset', (id) => {
    const state = presetById(id)?.build();
    expect(state).toEqual(completeState(PRESET_STATES[id] ?? {}));
    // presets set no height or wall: the defaults are taken
    expect(state?.heightMm).toBe(defaultState().heightMm);
    expect(state?.wallMm).toBe(defaultState().wallMm);
  });

  it.each(Object.keys(PRESET_STATES).map((id) => [id] as const))('%s: builds a valid closed mesh', (id) => {
    const params = stateToParams(PRESET_STATES[id] ?? {});
    params.nu = 48;
    params.nv = 48;
    const report = validateMesh(buildMesh(params));
    expect(report.finite).toBe(true);
    expect(report.watertight).toBe(true);
    expect(report.volume).toBeGreaterThan(0);
    // quantize collapses some triangles flat by its nature
    if (!params.deform.quantize.on) expect(report.degenerateTriangles).toBe(0);
  });
});
