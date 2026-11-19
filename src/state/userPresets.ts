// The user's presets in localStorage — the kit's record (`core/storage`).
// Reading never throws: storage may be unavailable (a private window) or
// hold garbage of past versions — the app must open regardless. A failed
// write says why (`StorageWrite`), and the app shows it.
//
// The key is the old one. Before the kit presets were a bare list of
// `{ name, state }` known by their names: the kit reads it as version 0 and
// gives out `u<n>` ids, which then survive renames.

import type { StoredRecord } from 'maker-kit/core/storage';
import type { UserPreset } from 'maker-kit/core/presets';
import { addUserPreset, readUserPresets } from 'maker-kit/core/presets';
import type { AppState } from './schema';
import { cleanState } from './schema';

export const USER_PRESETS_KEY = 'mathsculpt_user_presets_v1';

export type SculptPreset = UserPreset<AppState>;

export const userPresetsRecord: StoredRecord<SculptPreset[]> = {
  key: USER_PRESETS_KEY,
  version: 1,
  write: (presets) => ({ presets }),
  read: (data, version) =>
    readUserPresets(version === 0 ? data : typeof data === 'object' && data !== null ? Reflect.get(data, 'presets') : null, cleanState),
};

/**
 * 💾 under a name: a taken name replaces that preset — its id and place in
 * the list stay, as before the kit, when a preset was its name.
 */
export function savePresetAs(list: readonly SculptPreset[], name: string, state: AppState): { list: SculptPreset[]; id: string } {
  const same = list.find((preset) => preset.name === name);
  if (!same) return addUserPreset(list, name, state);
  return { list: list.map((preset) => (preset === same ? { ...preset, state } : preset)), id: same.id };
}
