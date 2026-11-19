// The user's presets are the kit's record: the old bare list by names is
// read as version 0 and gets ids; it is written as version 1.
import { loadRecord, saveRecord } from 'maker-kit/core/storage';
import type { KeyValueStorage } from 'maker-kit/core/storage';
import { USER_PRESETS_KEY, savePresetAs, userPresetsRecord } from '../src/state/userPresets';
import type { AppState } from '../src/state/schema';
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

function state(profile: string, heightMm = 120): AppState {
  return { ...defaultState(), profile, heightMm };
}

describe('user presets', () => {
  it('the key is the old one', () => {
    expect(USER_PRESETS_KEY).toBe('mathsculpt_user_presets_v1');
  });

  it('the bare list from before the kit is read and gets ids in order', () => {
    const legacy = [
      { name: 'Preset 1', state: { v: 1, profile: 'goblet', heightMm: 90, presetName: 'Preset 1' } },
      { name: 'Tall', state: { v: 1, profile: 'bottle' } },
      { name: 'broken' },
    ];
    const storage = memoryStorage({ [USER_PRESETS_KEY]: JSON.stringify(legacy) });
    const list = loadRecord(storage, userPresetsRecord);
    expect(list?.map((p) => [p.id, p.name, p.state.profile])).toEqual([
      ['u1', 'Preset 1', 'goblet'],
      ['u2', 'Tall', 'bottle'],
    ]);
    // the state is whole and clean: the defaults under what was saved, no preset name
    expect(list?.[0]?.state.heightMm).toBe(90);
    expect(list?.[1]?.state.heightMm).toBe(120);
    expect(list?.[0]?.state).not.toHaveProperty('presetName');
  });

  it('written as version 1 and read back', () => {
    const storage = memoryStorage();
    const { list } = savePresetAs([], 'Mine', state('torus'));
    expect(saveRecord(storage, userPresetsRecord, list)).toBe('ok');
    expect(JSON.parse(storage.data[USER_PRESETS_KEY] ?? '{}')).toMatchObject({ version: 1, presets: [{ id: 'u1', name: 'Mine' }] });
    expect(loadRecord(storage, userPresetsRecord)).toEqual(list);
  });

  it('a taken name replaces that preset, its id and place stay', () => {
    const first = savePresetAs([], 'A', state('vase'));
    const second = savePresetAs(first.list, 'B', state('bottle'));
    const again = savePresetAs(second.list, 'A', state('goblet'));
    expect(again.id).toBe('u1');
    expect(again.list.map((p) => [p.id, p.name, p.state.profile])).toEqual([
      ['u1', 'A', 'goblet'],
      ['u2', 'B', 'bottle'],
    ]);
  });

  it('garbage in storage is a fresh start, not an exception', () => {
    expect(loadRecord(memoryStorage({ [USER_PRESETS_KEY]: '{oops' }), userPresetsRecord)).toBeNull();
    expect(loadRecord(memoryStorage({ [USER_PRESETS_KEY]: '{"version":1,"presets":42}' }), userPresetsRecord)).toEqual([]);
  });

  it('blocked storage: the write says so', () => {
    expect(saveRecord(null, userPresetsRecord, [])).toBe('blocked');
  });
});
