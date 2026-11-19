// The model in the browser is the kit's record `mathsculpt_project`: the
// model, the open preset and the given name survive a reload (the PWA
// updates by one). What storage returns is cleaned; garbage is a fresh
// start, not an exception.
import { loadRecord, saveRecord } from 'maker-kit/core/storage';
import type { KeyValueStorage } from 'maker-kit/core/storage';
import { PROJECT_KEY, projectRecord } from '../src/state/project';
import { defaultState } from '../src/state/schema';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('the model in the browser', () => {
  it('a key of its own on the shared github.io origin', () => {
    expect(PROJECT_KEY).toBe('mathsculpt_project');
  });

  it('a round trip: the model, the open preset, the given name', () => {
    const storage = memoryStorage();
    const project = { state: { ...defaultState(), profile: 'torus', heightMm: 90 }, ref: 'b:pixel-torus' as const, name: 'Donut' };
    expect(saveRecord(storage, projectRecord, project)).toBe('ok');
    expect(JSON.parse(storage.data[PROJECT_KEY] ?? '{}')).toMatchObject({ version: 1, ref: 'b:pixel-torus', name: 'Donut' });
    expect(loadRecord(storage, projectRecord)).toEqual(project);
  });

  it('the state is cleaned; a foreign preset ref and a non-string name come back empty', () => {
    const storage = memoryStorage({
      [PROJECT_KEY]: JSON.stringify({ version: 1, state: { ...defaultState(), heightMm: 9999 }, ref: 'x:y', name: 42 }),
    });
    const project = loadRecord(storage, projectRecord);
    expect(project?.state.heightMm).toBe(400);
    expect(project?.ref).toBe('');
    expect(project?.name).toBe('');
  });

  it('garbage is a fresh start', () => {
    expect(loadRecord(memoryStorage({ [PROJECT_KEY]: '{oops' }), projectRecord)).toBeNull();
    expect(loadRecord(memoryStorage({ [PROJECT_KEY]: '{"version":1,"state":7}' }), projectRecord)).toBeNull();
    expect(loadRecord(memoryStorage({ [PROJECT_KEY]: '{"version":2,"state":{}}' }), projectRecord)).toBeNull();
    expect(loadRecord(memoryStorage(), projectRecord)).toBeNull();
  });
});
